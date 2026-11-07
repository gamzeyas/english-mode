/**
 * Reminder delivery, independent of Next and of the push library so it can
 * run against the real database in integration tests. The Supabase client
 * must use the secret key (push subscriptions are server-only) and every
 * query is scoped to one learner.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfLocalDay } from "@/lib/learning/day";
import {
  isReminderDue,
  localClock,
  reminderMessage,
} from "@/lib/notifications/schedule";
import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

export type PushTarget = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
/** `gone`: the push service says the subscription no longer exists. */
export type PushOutcome = "sent" | "gone" | "failed";
export type PushSender = (
  target: PushTarget,
  payload: string,
) => Promise<PushOutcome>;

export type PushMessage = { title: string; body: string; url: string };

/** Sends to every device of one learner and forgets expired devices. */
export async function sendToUser(
  admin: Admin,
  userId: string,
  message: PushMessage,
  send: PushSender,
) {
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .eq("user_id", userId);
  if (error) throw error;
  const payload = JSON.stringify(message);
  const result = { sent: 0, gone: 0, failed: 0 };
  for (const row of data) {
    const outcome = await send(
      { endpoint: row.endpoint, keys: row.keys as PushTarget["keys"] },
      payload,
    );
    result[outcome] += 1;
    if (outcome === "gone") {
      await admin
        .from("push_subscriptions")
        .delete()
        .eq("id", row.id)
        .eq("user_id", userId);
    } else if (outcome === "sent") {
      await admin
        .from("push_subscriptions")
        .update({ last_success_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("user_id", userId);
    }
  }
  return result;
}

const LEARNING_STATUSES = ["new", "learning", "review", "mastered"];

/** Whether the learner already did something today (then no nudge). */
async function practisedSince(admin: Admin, userId: string, since: string) {
  const counts = await Promise.all([
    admin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("started_at", since),
    admin
      .from("review_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("reviewed_at", since),
    admin
      .from("writing_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since),
    admin
      .from("listening_exercises")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("completed_at", since),
    admin
      .from("pronunciation_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since),
  ]);
  return counts.some((c) => (c.count ?? 0) > 0);
}

async function planContext(
  admin: Admin,
  userId: string,
  day: string,
  now: Date,
) {
  const [tasks, due] = await Promise.all([
    admin
      .from("assignments")
      .select("estimated_minutes")
      .eq("user_id", userId)
      .eq("scheduled_for", day)
      .eq("status", "pending"),
    admin
      .from("learning_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", LEARNING_STATUSES)
      .lte("due_at", now.toISOString()),
  ]);
  const pending = tasks.data ?? [];
  return {
    pendingTasks: pending.length,
    pendingMinutes: pending.reduce((sum, t) => sum + t.estimated_minutes, 0),
    dueReviews: due.count ?? 0,
  };
}

/**
 * One scheduler tick: finds learners whose reminder time has arrived in
 * their own time zone, claims today's reminder (so overlapping ticks never
 * send twice), skips learners who already practised today, and sends a
 * message built from their real plan.
 */
export async function runDueReminders({
  admin,
  send,
  now = new Date(),
  onlyUserIds,
}: {
  admin: Admin;
  send: PushSender;
  now?: Date;
  /** Restricts the tick to these learners (tests). */
  onlyUserIds?: string[];
}) {
  let query = admin
    .from("notification_preferences")
    .select("user_id, reminder_time, weekdays, last_reminded_on")
    .eq("enabled", true)
    .not("reminder_time", "is", null)
    .contains("channels", ["push"]);
  if (onlyUserIds) query = query.in("user_id", onlyUserIds);
  const { data: prefs, error } = await query;
  if (error) throw error;

  const summary = {
    checked: prefs.length,
    due: 0,
    sent: 0,
    skippedActive: 0,
    noDevice: 0,
  };
  if (!prefs.length) return summary;

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("user_id, timezone")
    .in(
      "user_id",
      prefs.map((p) => p.user_id),
    );
  if (profileError) throw profileError;
  const zones = new Map(profiles.map((p) => [p.user_id, p.timezone]));

  for (const pref of prefs) {
    const timeZone = zones.get(pref.user_id) ?? "Europe/Istanbul";
    const clock = localClock(now, timeZone);
    const rule = {
      reminderTime: pref.reminder_time!,
      weekdays: pref.weekdays,
      lastRemindedOn: pref.last_reminded_on,
    };
    if (!isReminderDue(rule, clock)) continue;

    const { data: claimed, error: claimError } = await admin
      .from("notification_preferences")
      .update({ last_reminded_on: clock.date })
      .eq("user_id", pref.user_id)
      .or(`last_reminded_on.is.null,last_reminded_on.neq.${clock.date}`)
      .select("user_id");
    if (claimError) throw claimError;
    if (!claimed.length) continue;
    summary.due += 1;

    const since = startOfLocalDay(now, timeZone);
    if (await practisedSince(admin, pref.user_id, since)) {
      summary.skippedActive += 1;
      continue;
    }
    const message = reminderMessage(
      await planContext(admin, pref.user_id, clock.date, now),
    );
    const result = await sendToUser(admin, pref.user_id, message, send);
    if (result.sent) summary.sent += 1;
    else if (!result.failed) summary.noDevice += 1;
  }
  return summary;
}
