// @vitest-environment node
import { createECDH, randomBytes } from "node:crypto";
import ece from "http_ece";
import webpush from "web-push";
import { describe, expect, it } from "vitest";
import {
  pushSubscriptionSchema,
  reminderSettingsSchema,
} from "@/lib/notifications/request";
import {
  isReminderDue,
  localClock,
  reminderMessage,
  suggestReminderTime,
  timeToMinutes,
} from "@/lib/notifications/schedule";

describe("localClock", () => {
  it("uses the learner's time zone, not the server's", () => {
    // 17:30 UTC on Friday 6 Nov 2026 is 20:30 in Istanbul (UTC+3).
    const clock = localClock(
      new Date("2026-11-06T17:30:00Z"),
      "Europe/Istanbul",
    );
    expect(clock).toEqual({
      date: "2026-11-06",
      weekday: 5,
      minutes: 20 * 60 + 30,
    });
  });

  it("rolls over to the next local day", () => {
    const clock = localClock(
      new Date("2026-11-08T22:15:00Z"),
      "Europe/Istanbul",
    );
    expect(clock).toEqual({ date: "2026-11-09", weekday: 1, minutes: 75 });
  });

  it("handles daylight saving zones", () => {
    // London is on GMT in November, BST in July.
    expect(
      localClock(new Date("2026-11-06T08:00:00Z"), "Europe/London").minutes,
    ).toBe(480);
    expect(
      localClock(new Date("2026-07-06T08:00:00Z"), "Europe/London").minutes,
    ).toBe(540);
  });
});

describe("isReminderDue", () => {
  const rule = {
    reminderTime: "20:00:00",
    weekdays: [1, 2, 3, 4, 5],
    lastRemindedOn: null,
  };
  const at = (minutes: number, weekday = 5, date = "2026-11-06") => ({
    date,
    weekday,
    minutes,
  });

  it("fires once the local time is reached", () => {
    expect(isReminderDue(rule, at(timeToMinutes("19:59")))).toBe(false);
    expect(isReminderDue(rule, at(timeToMinutes("20:00")))).toBe(true);
    expect(isReminderDue(rule, at(timeToMinutes("20:14")))).toBe(true);
  });

  it("never fires twice on the same local day", () => {
    expect(
      isReminderDue({ ...rule, lastRemindedOn: "2026-11-06" }, at(1215)),
    ).toBe(false);
    expect(
      isReminderDue({ ...rule, lastRemindedOn: "2026-11-05" }, at(1215)),
    ).toBe(true);
  });

  it("respects the chosen weekdays", () => {
    expect(isReminderDue(rule, at(1215, 6))).toBe(false);
  });

  it("drops a reminder that is hours late", () => {
    expect(isReminderDue(rule, at(timeToMinutes("22:59")))).toBe(true);
    expect(isReminderDue(rule, at(timeToMinutes("23:00")))).toBe(false);
  });
});

describe("suggestReminderTime", () => {
  it("needs enough history", () => {
    expect(suggestReminderTime([1, 0, 2, 0])).toBeNull();
  });

  it("picks the busiest part of the day", () => {
    expect(suggestReminderTime([1, 0, 6, 1])).toEqual({
      daypart: 2,
      time: "20:00",
      count: 6,
    });
  });
});

describe("reminderMessage", () => {
  it("describes the real plan", () => {
    expect(
      reminderMessage({ pendingTasks: 3, pendingMinutes: 15, dueReviews: 4 })
        .body,
    ).toBe(
      "Bugünkü planın hazır: 3 görev, yaklaşık 15 dk. 4 ifade tekrar bekliyor.",
    );
  });

  it("sends reviews to the review page", () => {
    const message = reminderMessage({
      pendingTasks: 0,
      pendingMinutes: 0,
      dueReviews: 2,
    });
    expect(message.url).toBe("/review");
    expect(message.body).toContain("2 ifade");
  });

  it("falls back to a short nudge without inventing tasks", () => {
    expect(
      reminderMessage({ pendingTasks: 0, pendingMinutes: 0, dueReviews: 0 })
        .body,
    ).toContain("5 dakikalık");
  });
});

describe("request schemas", () => {
  it("deduplicates and sorts weekdays", () => {
    expect(
      reminderSettingsSchema.parse({
        enabled: true,
        reminderTime: "07:45",
        weekdays: [5, 1, 5],
      }).weekdays,
    ).toEqual([1, 5]);
  });

  it("rejects invalid times and empty weekday sets", () => {
    const base = { enabled: true, reminderTime: "07:45", weekdays: [1] };
    expect(() =>
      reminderSettingsSchema.parse({ ...base, reminderTime: "24:00" }),
    ).toThrow();
    expect(() =>
      reminderSettingsSchema.parse({ ...base, weekdays: [] }),
    ).toThrow();
    expect(() =>
      reminderSettingsSchema.parse({ ...base, weekdays: [8] }),
    ).toThrow();
  });

  it("only accepts https push endpoints", () => {
    const keys = { p256dh: "B".repeat(87), auth: "a".repeat(22) };
    expect(() =>
      pushSubscriptionSchema.parse({ endpoint: "http://push.example/x", keys }),
    ).toThrow();
    expect(
      pushSubscriptionSchema.parse({ endpoint: "https://push.example/x", keys })
        .endpoint,
    ).toBe("https://push.example/x");
  });
});

describe("Web Push encryption (RFC 8291)", () => {
  it("produces a VAPID-signed aes128gcm payload the browser can decrypt", () => {
    // Stand-in for the browser's subscription keys.
    const browser = createECDH("prime256v1");
    browser.generateKeys();
    const authSecret = randomBytes(16);
    const subscription = {
      endpoint: "https://push.example.com/send/abc",
      keys: {
        p256dh: browser.getPublicKey().toString("base64url"),
        auth: authSecret.toString("base64url"),
      },
    };
    const vapid = webpush.generateVAPIDKeys();
    const payload = JSON.stringify({
      title: "English Mode",
      body: "Merhaba",
      url: "/dashboard",
    });

    const request = webpush.generateRequestDetails(subscription, payload, {
      vapidDetails: {
        subject: "https://english-mode.vercel.app",
        publicKey: vapid.publicKey,
        privateKey: vapid.privateKey,
      },
      TTL: 3600,
    });

    expect(request.endpoint).toBe(subscription.endpoint);
    expect(request.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(request.headers.TTL).toBe(3600);
    expect(request.headers.Authorization).toMatch(
      new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${vapid.publicKey}$`),
    );
    const decrypted = ece.decrypt(request.body, {
      version: "aes128gcm",
      privateKey: browser,
      authSecret: subscription.keys.auth,
    });
    expect(JSON.parse(decrypted.toString("utf8"))).toEqual(JSON.parse(payload));
  });
});
