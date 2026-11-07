import "server-only";
import type { CurrentUser, Profile } from "@/lib/auth/dal";
import { activityPattern } from "@/lib/learning/skill-progress";
import { createPushSender, getVapidPublicKey } from "@/lib/notifications/push";
import type {
  ReminderSettingsInput,
  pushSubscriptionSchema,
} from "@/lib/notifications/request";
import { sendToUser } from "@/lib/notifications/runner";
import { suggestReminderTime } from "@/lib/notifications/schedule";
import { SessionError } from "@/lib/sessions/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { z } from "zod";

const DAY_MS = 86_400_000;
export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** Busiest part of the day over the last four weeks of real activity. */
async function reminderSuggestion(userId: string, timeZone: string) {
  const supabase = await createClient();
  const since = new Date(Date.now() - 28 * DAY_MS).toISOString();
  const [sessions, reviews, writing, listening, spoken] = await Promise.all([
    supabase
      .from("sessions")
      .select("started_at")
      .eq("user_id", userId)
      .gte("started_at", since),
    supabase
      .from("review_logs")
      .select("reviewed_at")
      .eq("user_id", userId)
      .gte("reviewed_at", since),
    supabase
      .from("writing_entries")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", since),
    supabase
      .from("listening_exercises")
      .select("completed_at")
      .eq("user_id", userId)
      .gte("completed_at", since),
    supabase
      .from("pronunciation_attempts")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", since),
  ]);
  const { dayparts } = activityPattern(
    [
      ...(sessions.data ?? []).map((r) => r.started_at),
      ...(reviews.data ?? []).map((r) => r.reviewed_at),
      ...(writing.data ?? []).map((r) => r.created_at),
      ...(listening.data ?? []).flatMap((r) =>
        r.completed_at ? [r.completed_at] : [],
      ),
      ...(spoken.data ?? []).map((r) => r.created_at),
    ],
    timeZone,
  );
  return suggestReminderTime(dayparts);
}

export async function getReminderSettings(user: CurrentUser, profile: Profile) {
  const supabase = await createClient();
  const [prefs, devices, suggestion] = await Promise.all([
    supabase
      .from("notification_preferences")
      .select("enabled, reminder_time, weekdays, channels")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("endpoint, user_agent, created_at, last_success_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    reminderSuggestion(user.id, profile.timezone),
  ]);
  if (prefs.error) throw prefs.error;
  if (devices.error) throw devices.error;
  return {
    enabled: prefs.data?.enabled ?? false,
    reminderTime: prefs.data?.reminder_time?.slice(0, 5) ?? null,
    weekdays: prefs.data?.weekdays ?? ALL_WEEKDAYS,
    timeZone: profile.timezone,
    devices: devices.data.map((d) => ({
      endpoint: d.endpoint,
      userAgent: d.user_agent,
      createdAt: d.created_at,
      lastSuccessAt: d.last_success_at,
    })),
    suggestion,
    vapidPublicKey: getVapidPublicKey(),
  };
}
export type ReminderSettings = Awaited<ReturnType<typeof getReminderSettings>>;

/** Preferences are learner-owned (RLS + column grants), so no secret key. */
export async function saveReminderSettings(
  user: CurrentUser,
  profile: Profile,
  input: ReminderSettingsInput,
) {
  if (input.enabled && !input.reminderTime)
    throw new SessionError("invalid_request", "Hatırlatma için bir saat seç.");
  const supabase = await createClient();
  const values = {
    enabled: input.enabled,
    reminder_time: input.reminderTime,
    weekdays: input.weekdays,
    timezone: profile.timezone,
    channels: ["push"],
  };
  const { data, error } = await supabase
    .from("notification_preferences")
    .update(values)
    .eq("user_id", user.id)
    .select("user_id");
  if (error) throw error;
  if (!data.length) {
    const { error: insertError } = await supabase
      .from("notification_preferences")
      .insert({ user_id: user.id, ...values });
    if (insertError) throw insertError;
  }
  return { ok: true };
}

/**
 * Stores this device's push subscription (server-written, PRD §8). An
 * endpoint is unique per browser profile, so re-subscribing moves it.
 */
export async function addPushSubscription(
  user: CurrentUser,
  subscription: z.infer<typeof pushSubscriptionSchema>,
  userAgent: string | null,
) {
  if (!getVapidPublicKey()) throw new SessionError("push_not_configured");
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      user_agent: userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
  return { ok: true };
}

/** Learners may delete their own subscriptions (RLS). */
export async function removePushSubscription(
  user: CurrentUser,
  endpoint: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  if (error) throw error;
  return { ok: true };
}

export async function sendTestNotification(user: CurrentUser) {
  const send = createPushSender();
  if (!send) throw new SessionError("push_not_configured");
  const result = await sendToUser(
    createAdminClient(),
    user.id,
    {
      title: "English Mode",
      body: "Bildirimler çalışıyor. Hatırlatman seçtiğin saatte gelecek.",
      url: "/settings",
    },
    send,
  );
  if (result.sent + result.failed + result.gone === 0)
    throw new SessionError(
      "not_ready",
      "Kayıtlı cihaz yok. Önce bu cihazda bildirimleri aç.",
    );
  return result;
}
