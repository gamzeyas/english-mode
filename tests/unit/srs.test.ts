import { describe, expect, it } from "vitest";
import { formatInterval } from "@/lib/srs/grades";
import { clozeExample, matchRecall, phraseFragments } from "@/lib/srs/recall";
import {
  previewDueDates,
  reviveCard,
  scheduleReview,
  serializeCard,
  statusForCard,
} from "@/lib/srs/scheduler";
import { startOfLocalDay } from "@/lib/learning/day";

const now = new Date("2026-11-03T09:00:00Z");

describe("scheduleReview", () => {
  it("creates a card on first review and moves the due date forward", async () => {
    const result = await scheduleReview(null, 3, now);
    expect(result.previous.reps).toBe(0);
    expect(result.next.reps).toBe(1);
    expect(result.dueAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it("schedules Again sooner than Good, and Good no later than Easy", async () => {
    const again = await scheduleReview(null, 1, now);
    const good = await scheduleReview(null, 3, now);
    const easy = await scheduleReview(null, 4, now);
    expect(again.dueAt.getTime()).toBeLessThan(good.dueAt.getTime());
    expect(good.dueAt.getTime()).toBeLessThanOrEqual(easy.dueAt.getTime());
  });

  it("continues from a stored (JSON round-tripped) card", async () => {
    const first = await scheduleReview(null, 3, now);
    const stored = JSON.parse(JSON.stringify(serializeCard(first.next)));
    const later = new Date(first.dueAt.getTime() + 60_000);
    const second = await scheduleReview(stored, 3, later);
    expect(second.next.reps).toBe(2);
    expect(second.dueAt.getTime()).toBeGreaterThan(later.getTime());
    expect(reviveCard(stored).dueAt).toBeInstanceOf(Date);
  });

  it("previews one due date per grade", async () => {
    const preview = await previewDueDates(null, now);
    expect(Object.keys(preview)).toEqual(["1", "2", "3", "4"]);
    expect(Date.parse(preview[1])).toBeLessThan(Date.parse(preview[3]));
  });
});

describe("statusForCard", () => {
  it("maps FSRS state to pool status, with mastered as a stability label", () => {
    expect(statusForCard({ state: 0, stability: 0 })).toBe("new");
    expect(statusForCard({ state: 1, stability: 1 })).toBe("learning");
    expect(statusForCard({ state: 3, stability: 50 })).toBe("learning");
    expect(statusForCard({ state: 2, stability: 5 })).toBe("review");
    expect(statusForCard({ state: 2, stability: 30 })).toBe("mastered");
  });
});

describe("recall helpers", () => {
  it("splits template phrases on ellipses", () => {
    expect(phraseFragments("If I could..., I'd...")).toEqual([
      "if i could",
      "i'd",
    ]);
    expect(phraseFragments("I’m into…")).toEqual(["i'm into"]);
  });

  it("blanks the phrase in its example without revealing it", () => {
    expect(clozeExample("I'm into...", "I’m into melodic techno.")).toBe(
      "____ melodic techno.",
    );
    expect(
      clozeExample(
        "If I could..., I'd...",
        "If I could live anywhere, I'd move to Berlin.",
      ),
    ).toBe("____ live anywhere, ____ move to Berlin.");
    expect(
      clozeExample("What makes us different is...", "We are fast."),
    ).toBeNull();
    expect(clozeExample("I'm into...", null)).toBeNull();
  });

  it("matches answers that use the fixed parts in order", () => {
    expect(
      matchRecall(
        "If I could..., I'd...",
        "If I could travel, I'd go to Japan",
      ),
    ).toBe("exact");
    expect(
      matchRecall("If I could..., I'd...", "If I could travel, I will go"),
    ).toBe("partial");
    expect(matchRecall("I'm into...", "I like techno")).toBe("none");
    expect(matchRecall("I'm into...", "")).toBe("none");
  });
});

describe("formatInterval", () => {
  it.each([
    ["2026-11-03T09:01:00Z", "1m"],
    ["2026-11-03T09:10:00Z", "10m"],
    ["2026-11-03T14:00:00Z", "5h"],
    ["2026-11-08T09:00:00Z", "5d"],
    ["2027-02-03T09:00:00Z", "3mo"],
    ["2028-11-03T09:00:00Z", "2y"],
  ])("formats %s as %s", (due, expected) => {
    expect(formatInterval("2026-11-03T09:00:00Z", due)).toBe(expected);
  });
});

describe("startOfLocalDay", () => {
  it("returns local midnight as a UTC instant, DST-safe", () => {
    expect(
      startOfLocalDay(new Date("2026-11-02T20:30:00Z"), "Europe/Istanbul"),
    ).toBe("2026-11-01T21:00:00.000Z");
    expect(
      startOfLocalDay(new Date("2026-11-02T21:30:00Z"), "Europe/Istanbul"),
    ).toBe("2026-11-02T21:00:00.000Z");
    expect(
      startOfLocalDay(new Date("2026-07-02T12:00:00Z"), "Europe/Berlin"),
    ).toBe("2026-07-01T22:00:00.000Z");
  });
});
