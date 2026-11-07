import { describe, expect, it } from "vitest";
import {
  planDay,
  alternativeFor,
  type PlannerInput,
} from "@/lib/assignments/planner";
import { activityPattern, weakestSounds } from "@/lib/learning/skill-progress";
import {
  rankFocus,
  slotSkills,
  type SkillSignals,
} from "@/lib/learning/skills";
import { choosePracticeSet, setOf } from "@/lib/pronunciation/next-set";

const signals = (over: Partial<SkillSignals> = {}): SkillSignals => ({
  speaking: { sessions7: 3 },
  listening: { done28: 0, avgScore: null, daysSinceLast: null },
  pronunciation: { attempts28: 0, avgScore: null, daysSinceLast: null },
  vocabulary: { due: 0 },
  writing: { entries28: 2, daysSinceLast: 1 },
  ...over,
});

describe("rankFocus", () => {
  it("labels unmeasured skills instead of scoring them", () => {
    const focus = rankFocus(signals());
    const listening = focus.find((f) => f.skill === "listening")!;
    expect(listening.reasonTr).toContain("Henüz ölçülmedi");
  });

  it("puts a low measured score ahead of a strong one", () => {
    const focus = rankFocus(
      signals({
        listening: { done28: 5, avgScore: 0.95, daysSinceLast: 1 },
        pronunciation: { attempts28: 8, avgScore: 52, daysSinceLast: 1 },
      }),
    );
    expect(focus[0].skill).toBe("pronunciation");
    expect(focus[0].reasonTr).toContain("52");
    expect(slotSkills(focus)[0]).toBe("pronunciation");
  });

  it("raises vocabulary when many phrases are due", () => {
    const focus = rankFocus(
      signals({
        listening: { done28: 5, avgScore: 0.9, daysSinceLast: 0 },
        pronunciation: { attempts28: 5, avgScore: 90, daysSinceLast: 0 },
        vocabulary: { due: 12 },
      }),
    );
    expect(focus[0].skill).toBe("vocabulary");
  });
});

const base: PlannerInput = {
  dayKey: "2026-11-09",
  dailyMinutes: 15,
  dueCount: 0,
  scenarios: [],
  recentScenarioSlugs: [],
  topPattern: null,
  skillOrder: ["pronunciation", "listening", "writing"],
  pronunciationSet: { slug: "th", title: "TH sounds" },
};

describe("planDay skill slot", () => {
  it("fits a 5-minute skill task into a 15-minute day without reviews", () => {
    const tasks = planDay(base);
    expect(tasks.map((t) => t.estimatedMinutes)).toEqual([10, 5]);
    expect(["pronunciation", "listening", "interview_answer"]).toContain(
      tasks[1].kind,
    );
  });

  it("keeps a 15-minute day with reviews to review + main", () => {
    expect(planDay({ ...base, dueCount: 3 }).map((t) => t.kind)).toEqual([
      "review",
      "conversation",
    ]);
  });

  it("gives the top skill two days out of four", () => {
    const kinds = [9, 10, 11, 12].map(
      (d) =>
        planDay({ ...base, dayKey: `2026-11-${String(d).padStart(2, "0")}` })[1]
          .kind,
    );
    expect(kinds.filter((k) => k === "pronunciation")).toHaveLength(2);
    expect(kinds).toContain("listening");
    expect(kinds).toContain("interview_answer");
  });

  it("links the suggested practice set", () => {
    const task = [9, 10, 11, 12]
      .map(
        (d) =>
          planDay({
            ...base,
            dayKey: `2026-11-${String(d).padStart(2, "0")}`,
          })[1],
      )
      .find((t) => t.kind === "pronunciation")!;
    expect(task.payload.setSlug).toBe("th");
    expect(task.title).toBe("Pronunciation: TH sounds");
  });

  it("swaps skill tasks for another short task", () => {
    const task = [9, 10, 11, 12]
      .map(
        (d) =>
          planDay({
            ...base,
            dayKey: `2026-11-${String(d).padStart(2, "0")}`,
          })[1],
      )
      .find((t) => t.kind === "pronunciation")!;
    const next = alternativeFor(task, base)!;
    expect(next.kind).toBe("listening");
    expect(next.planKey).toMatch(/~1$/);
  });
});

describe("choosePracticeSet", () => {
  it("picks the weakest set under 85, else an untried one", () => {
    const at = "2026-11-07T10:00:00Z";
    expect(
      choosePracticeSet([
        { setSlug: "th", score: 60, at },
        { setSlug: "w-v", score: 90, at },
      ]).slug,
    ).toBe("th");
    expect(choosePracticeSet([{ setSlug: "th", score: 92, at }]).slug).not.toBe(
      "th",
    );
    expect(setOf("connected-4")).toBe("connected");
  });
});

describe("skill progress aggregations", () => {
  it("reports weak sounds only with enough samples", () => {
    const word = (phoneme: string, accuracy: number) => ({
      word: "x",
      accuracy,
      errorType: "None" as const,
      phonemes: [{ phoneme, accuracy }],
    });
    const result = (words: ReturnType<typeof word>[]) => ({
      recognized: "",
      scores: {
        pronunciation: 0,
        accuracy: 0,
        fluency: 0,
        completeness: 0,
        prosody: null,
      },
      words,
      monotone: false,
    });
    const sounds = weakestSounds([
      result([word("θ", 30), word("θ", 50), word("θ", 40), word("æ", 10)]),
    ]);
    expect(sounds).toEqual([{ phoneme: "θ", average: 40, samples: 3 }]);
  });

  it("buckets activity by local weekday and time of day", () => {
    // 2026-11-09 is a Monday. In Istanbul (UTC+3): 09:30 Monday, 23:30
    // Monday and 00:30 Tuesday.
    const pattern = activityPattern(
      ["2026-11-09T06:30:00Z", "2026-11-09T20:30:00Z", "2026-11-09T21:30:00Z"],
      "Europe/Istanbul",
    );
    expect(pattern.weekdays.slice(0, 2)).toEqual([2, 1]);
    expect(pattern.dayparts).toEqual([1, 0, 0, 2]);
  });
});
