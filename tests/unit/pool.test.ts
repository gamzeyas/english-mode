import { describe, expect, it } from "vitest";
import { filterPool, isDue } from "@/lib/learning/pool";
import type { LearningItem } from "@/types/domain";

const now = new Date("2026-11-02T06:00:00Z");

const item = (overrides: Partial<LearningItem>): LearningItem => ({
  id: crypto.randomUUID(),
  phrase: "I'm into...",
  normalizedPhrase: "i'm into",
  meaningTr: null,
  example: null,
  category: "expression",
  status: "new",
  sourceContext: null,
  dueAt: null,
  lastReviewedAt: null,
  createdAt: "2026-10-28T10:00:00Z",
  ...overrides,
});

const pool = [
  item({ status: "learning", dueAt: "2026-11-01T15:00:00Z" }),
  item({ status: "review", dueAt: "2026-11-02T05:00:00Z" }),
  item({ status: "new", dueAt: "2026-11-03T06:00:00Z" }),
  item({ status: "mastered", dueAt: "2026-11-20T06:00:00Z" }),
  item({ status: "suggested" }),
];

describe("isDue", () => {
  it("is due when an active item's date has passed", () => {
    expect(
      isDue(item({ status: "learning", dueAt: "2026-11-01T00:00:00Z" }), now),
    ).toBe(true);
  });

  it("is not due in the future", () => {
    expect(
      isDue(item({ status: "learning", dueAt: "2026-12-01T00:00:00Z" }), now),
    ).toBe(false);
  });

  it("ignores suggested, mastered and archived items", () => {
    for (const status of ["suggested", "mastered", "archived"] as const) {
      expect(isDue(item({ status, dueAt: "2026-01-01T00:00:00Z" }), now)).toBe(
        false,
      );
    }
  });

  it("compares instants, not local wall-clock strings", () => {
    // 08:30 Istanbul (UTC+3) is 05:30Z, before the 06:00Z reference.
    expect(
      isDue(item({ status: "new", dueAt: "2026-11-02T08:30:00+03:00" }), now),
    ).toBe(true);
    expect(
      isDue(item({ status: "new", dueAt: "2026-11-02T06:30:00Z" }), now),
    ).toBe(false);
  });
});

describe("filterPool", () => {
  it("groups suggested candidates with new items", () => {
    const statuses = filterPool(pool, "new", now).map((entry) => entry.status);
    expect(statuses.sort()).toEqual(["new", "suggested"]);
  });

  it("hides archived items from the default view", () => {
    const items = [...pool, item({ id: "archived", status: "archived" })];
    expect(
      filterPool(items, "all", now).some((entry) => entry.id === "archived"),
    ).toBe(false);
  });

  it("returns only due items for the due filter", () => {
    const due = filterPool(pool, "due", now);
    expect(due).toHaveLength(2);
    expect(due.every((entry) => isDue(entry, now))).toBe(true);
  });
});
