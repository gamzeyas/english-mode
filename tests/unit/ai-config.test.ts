import { describe, expect, it } from "vitest";
import {
  AI_RATE_LIMITS,
  estimateCostUsd,
  exceedsLimit,
  SPEECH_RATE_LIMITS,
} from "@/lib/ai/config";
import {
  buildLearnerContextPrompt,
  type LearnerContext,
} from "@/lib/ai/prompts/coach";
import { localDayKey } from "@/lib/learning/day";

describe("estimateCostUsd", () => {
  it("prices Opus 5.5 input, output and cache tokens", () => {
    const cost = estimateCostUsd("claude-opus-5-5", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 0,
    });
    expect(cost).toBeCloseTo(4 + 20 + 0.2);
  });

  it("prices unknown models at the default (safe) rate", () => {
    const usage = { input_tokens: 1000, output_tokens: 1000 };
    expect(estimateCostUsd("some-future-model", usage)).toBe(
      estimateCostUsd("claude-opus-5-5", usage),
    );
  });
});

describe("localDayKey", () => {
  it("buckets instants by the learner's calendar day", () => {
    expect(localDayKey("2026-11-02T20:59:00Z", "Europe/Istanbul")).toBe(
      "2026-11-02",
    );
    expect(localDayKey("2026-11-02T21:01:00Z", "Europe/Istanbul")).toBe(
      "2026-11-03",
    );
  });
});

describe("buildLearnerContextPrompt", () => {
  const context: LearnerContext = {
    displayName: "Gamze",
    purpose: "career",
    goals: ["Spoken fluency"],
    interests: ["Melodic techno"],
    dialect: "en-GB",
    feedbackMode: "end",
    durationGoalMinutes: 15,
    weakPatterns: [],
    targetExpressions: ["I'm into..."],
    recentSessionSummaries: [],
    scenario: null,
  };

  it("is deterministic so the cached system prefix stays identical", () => {
    expect(buildLearnerContextPrompt(context)).toBe(
      buildLearnerContextPrompt({ ...context }),
    );
  });

  it("reflects dialect, correction policy and roleplay persona", () => {
    const prompt = buildLearnerContextPrompt({
      ...context,
      scenario: {
        title: "Interview",
        summary: "",
        persona: {
          name: "Rachel",
          role: "Senior recruiter",
          style: "Precise.",
        },
        goals: [],
      },
    });
    expect(prompt).toContain("British");
    expect(prompt).toContain("corrections come after the session");
    expect(prompt).toContain("you are Rachel, Senior recruiter");
  });
});

describe("exceedsLimit", () => {
  it("blocks only when a burst window is full", () => {
    expect(exceedsLimit([0, 0])).toBe(false);
    expect(exceedsLimit([AI_RATE_LIMITS[0].max - 1, 10])).toBe(false);
    expect(exceedsLimit([AI_RATE_LIMITS[0].max, 10])).toBe(true);
    expect(exceedsLimit([5, AI_RATE_LIMITS[1].max])).toBe(true);
    // Speech has wider windows than Claude.
    expect(exceedsLimit([AI_RATE_LIMITS[0].max, 10], SPEECH_RATE_LIMITS)).toBe(
      false,
    );
  });
});
