import { describe, expect, it } from "vitest";
import {
  alternativeFor,
  MAX_SWAPS,
  planDay,
  rankScenarios,
  type PlannerInput,
} from "@/lib/assignments/planner";

const scenarios = [
  { slug: "interview", title: "Interview", personaName: "Rachel" },
  { slug: "pitch", title: "Pitch", personaName: "Marcus" },
  { slug: "festival", title: "Festival", personaName: "Leo" },
];

function input(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    dayKey: "2026-11-03",
    dailyMinutes: 25,
    dueCount: 4,
    scenarios,
    recentScenarioSlugs: [],
    topPattern: {
      key: "conditional_would",
      original: "If I could, I go to Berlin.",
      improved: "If I could, I'd go to Berlin.",
    },
    ...overrides,
  };
}

const total = (tasks: { estimatedMinutes: number }[]) =>
  tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

describe("planDay", () => {
  it.each([5, 15, 25, 30])("fits a %i-minute day", (minutes) => {
    expect(total(planDay(input({ dailyMinutes: minutes })))).toBe(minutes);
  });

  it("makes a 5-minute day a single task", () => {
    expect(planDay(input({ dailyMinutes: 5 })).map((t) => t.kind)).toEqual([
      "review",
    ]);
    expect(
      planDay(input({ dailyMinutes: 5, dueCount: 0 })).map((t) => t.kind),
    ).toEqual(["conversation"]);
  });

  it("follows the default shape: retrieval, practice, recap", () => {
    const kinds = planDay(input()).map((t) => t.kind);
    expect(kinds[0]).toBe("review");
    expect(["conversation", "roleplay"]).toContain(kinds[1]);
    expect(kinds[2]).toBe("rewrite");
  });

  it("skips review when nothing is due and uses an interview task without patterns", () => {
    const tasks = planDay(input({ dueCount: 0, topPattern: null }));
    expect(tasks.map((t) => t.kind)).not.toContain("review");
    expect(tasks.at(-1)?.kind).toBe("interview_answer");
    expect(total(tasks)).toBe(25);
  });

  it("keys every task by day so regeneration is idempotent", () => {
    const keys = planDay(input()).map((t) => t.planKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => k.startsWith("2026-11-03:"))).toBe(true);
    expect(planDay(input())).toEqual(planDay(input()));
  });

  it("alternates free chat and roleplay across days", () => {
    const main = (dayKey: string) =>
      planDay(input({ dayKey })).find((t) => t.planKey.endsWith(":main"))?.kind;
    expect(new Set([main("2026-11-03"), main("2026-11-04")])).toEqual(
      new Set(["conversation", "roleplay"]),
    );
  });

  it("never reveals the improved sentence in a rewrite task", () => {
    const rewrite = planDay(input()).find((t) => t.kind === "rewrite")!;
    expect(rewrite.instructions).toContain("If I could, I go to Berlin.");
    expect(rewrite.instructions).not.toContain("I'd go");
  });
});

describe("rankScenarios", () => {
  it("puts never-practiced, then least recent scenarios first", () => {
    expect(
      rankScenarios(scenarios, ["pitch", "interview"]).map((s) => s.slug),
    ).toEqual(["festival", "interview", "pitch"]);
  });
});

describe("alternativeFor", () => {
  const context = {
    dayKey: "2026-11-03",
    scenarios,
    recentScenarioSlugs: [],
  };

  it("does not swap reviews", () => {
    expect(
      alternativeFor(
        {
          kind: "review",
          planKey: "2026-11-03:review",
          estimatedMinutes: 5,
          payload: {},
        },
        context,
      ),
    ).toBeNull();
  });

  it("swaps a conversation for a same-length roleplay on the same day", () => {
    const next = alternativeFor(
      {
        kind: "conversation",
        planKey: "2026-11-03:main",
        estimatedMinutes: 15,
        payload: { minutes: 15 },
      },
      context,
    )!;
    expect(next.kind).toBe("roleplay");
    expect(next.estimatedMinutes).toBe(15);
    expect(next.planKey).toBe("2026-11-03:main~1");
    expect(next.payload).toMatchObject({
      swappedFrom: "2026-11-03:main",
      swapCount: 1,
    });
  });

  it("stops after the swap limit", () => {
    expect(
      alternativeFor(
        {
          kind: "interview_answer",
          planKey: `2026-11-03:recap~${MAX_SWAPS}`,
          estimatedMinutes: 5,
          payload: { swapCount: MAX_SWAPS },
        },
        context,
      ),
    ).toBeNull();
  });

  it("chains swap keys without growing them", () => {
    const next = alternativeFor(
      {
        kind: "interview_answer",
        planKey: "2026-11-03:recap~1",
        estimatedMinutes: 5,
        payload: { swapCount: 1, promptKey: "proud_project" },
      },
      context,
    )!;
    expect(next.planKey).toBe("2026-11-03:recap~2");
  });
});
