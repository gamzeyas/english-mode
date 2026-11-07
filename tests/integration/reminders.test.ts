import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  runDueReminders,
  type PushOutcome,
  type PushTarget,
} from "@/lib/notifications/runner";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

/**
 * The scheduler tick against the real database with a recording sender in
 * place of the push service: who is due, the once-a-day claim, skipping
 * learners who already practised, and cleanup of expired devices.
 */
const admin = adminClient();
let learner: TestUser;
let busy: TestUser;

// Friday 6 Nov 2026, 20:05 in Istanbul (UTC+3).
const now = new Date("2026-11-06T17:05:00Z");

beforeAll(async () => {
  [learner, busy] = await Promise.all([
    createTestUser(admin),
    createTestUser(admin),
  ]);
  for (const user of [learner, busy]) {
    await admin
      .from("profiles")
      .update({ timezone: "Europe/Istanbul" })
      .eq("user_id", user.id);
    const { error } = await user.client
      .from("notification_preferences")
      .insert({
        user_id: user.id,
        enabled: true,
        reminder_time: "20:00",
        weekdays: [1, 2, 3, 4, 5],
        channels: ["push"],
      });
    expect(error).toBeNull();
    await admin.from("push_subscriptions").insert([
      {
        user_id: user.id,
        endpoint: `https://push.example.test/live/${user.id}`,
        keys: { p256dh: "p", auth: "a" },
      },
      {
        user_id: user.id,
        endpoint: `https://push.example.test/expired/${user.id}`,
        keys: { p256dh: "p", auth: "a" },
      },
    ]);
  }
  await learner.client.from("assignments").insert([
    {
      user_id: learner.id,
      title: "Review",
      instructions: "x",
      kind: "review",
      estimated_minutes: 5,
      scheduled_for: "2026-11-06",
    },
    {
      user_id: learner.id,
      title: "Talk",
      instructions: "x",
      kind: "conversation",
      estimated_minutes: 10,
      scheduled_for: "2026-11-06",
    },
  ]);
  // "busy" already practised this evening.
  await busy.client.from("sessions").insert({
    user_id: busy.id,
    mode: "text",
    started_at: "2026-11-06T16:00:00Z",
  });
});

afterAll(async () => {
  await Promise.all([
    deleteTestUser(admin, learner),
    deleteTestUser(admin, busy),
  ]);
});

function recorder() {
  const calls: { target: PushTarget; payload: unknown }[] = [];
  const send = async (target: PushTarget, payload: string) => {
    calls.push({ target, payload: JSON.parse(payload) });
    return (
      target.endpoint.includes("/expired/") ? "gone" : "sent"
    ) as PushOutcome;
  };
  return { calls, send };
}

describe("runDueReminders", () => {
  const onlyUserIds = () => [learner.id, busy.id];

  it("does nothing before the reminder time", async () => {
    const { calls, send } = recorder();
    const early = new Date("2026-11-06T16:55:00Z"); // 19:55 local
    const summary = await runDueReminders({
      admin,
      send,
      now: early,
      onlyUserIds: onlyUserIds(),
    });
    expect(summary.due).toBe(0);
    expect(calls).toEqual([]);
  });

  it("sends the real plan once, skips active learners, drops expired devices", async () => {
    const { calls, send } = recorder();
    const summary = await runDueReminders({
      admin,
      send,
      now,
      onlyUserIds: onlyUserIds(),
    });
    expect(summary).toMatchObject({
      checked: 2,
      due: 2,
      sent: 1,
      skippedActive: 1,
    });
    expect(calls.map((c) => c.target.endpoint).sort()).toEqual(
      [
        `https://push.example.test/expired/${learner.id}`,
        `https://push.example.test/live/${learner.id}`,
      ].sort(),
    );
    expect(calls[0].payload).toMatchObject({
      title: "English Mode",
      body: "Bugünkü planın hazır: 2 görev, yaklaşık 15 dk.",
      url: "/dashboard",
    });

    const { data: devices } = await admin
      .from("push_subscriptions")
      .select("endpoint, last_success_at")
      .eq("user_id", learner.id);
    expect(devices).toHaveLength(1);
    expect(devices![0].endpoint).toContain("/live/");
    expect(devices![0].last_success_at).not.toBeNull();

    // Both learners are claimed for today, so a second tick is silent.
    const again = recorder();
    const second = await runDueReminders({
      admin,
      send: again.send,
      now: new Date("2026-11-06T17:20:00Z"),
      onlyUserIds: onlyUserIds(),
    });
    expect(second.due).toBe(0);
    expect(again.calls).toEqual([]);
  });

  it("skips days the learner did not choose", async () => {
    const { calls, send } = recorder();
    // Saturday 7 Nov, 20:05 local.
    const summary = await runDueReminders({
      admin,
      send,
      now: new Date("2026-11-07T17:05:00Z"),
      onlyUserIds: onlyUserIds(),
    });
    expect(summary.due).toBe(0);
    expect(calls).toEqual([]);
  });
});
