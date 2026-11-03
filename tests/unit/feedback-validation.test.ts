import { describe, expect, it } from "vitest";
import {
  validateFeedback,
  type FeedbackPayload,
} from "@/lib/ai/analysis/schema";

const transcript = [
  { id: "a1", role: "assistant", content: "What music do you like?" },
  { id: "u1", role: "user", content: "I'm interesting melodic techno." },
  { id: "a2", role: "assistant", content: "Nice! Where would you go?" },
  {
    id: "u2",
    role: "user",
    content: "If I could move abroad, I go to Berlin.",
  },
];

function payload(overrides: Partial<FeedbackPayload> = {}): FeedbackPayload {
  return {
    summary_tr: "Müzik hakkında konuştuk.",
    strengths: [{ evidence_message_id: "u1", comment_tr: "Net cevap." }],
    corrections: [
      {
        evidence_message_id: "u1",
        original: "I'm interesting melodic techno",
        improved: "I'm into melodic techno",
        reason_tr: "…",
        category: "word_choice",
        severity: "high",
        pattern_key: "Interested vs Interesting",
      },
    ],
    learning_candidates: [
      {
        phrase: "I'm into...",
        meaning_tr: "…",
        example: "I'm into techno.",
        source_message_id: "u1",
        reason: "corrected",
      },
    ],
    next_task: {
      title: "Practice",
      instructions: "Write 3 sentences.",
      estimated_minutes: 7,
    },
    confidence_notes: [],
    rubric_scores: [],
    goal_outcomes: [],
    ...overrides,
  };
}

describe("validateFeedback", () => {
  it("keeps findings anchored to real learner messages", () => {
    const { payload: result, dropped } = validateFeedback(
      payload(),
      transcript,
    );
    expect(result.corrections).toHaveLength(1);
    expect(result.strengths).toHaveLength(1);
    expect(dropped).toEqual({ strengths: 0, corrections: 0, candidates: 0 });
  });

  it("normalizes the pattern key", () => {
    expect(
      validateFeedback(payload(), transcript).payload.corrections[0]
        .pattern_key,
    ).toBe("interested_vs_interesting");
  });

  it("drops corrections whose quote is not in the cited message", () => {
    const fabricated = payload({
      corrections: [{ ...payload().corrections[0], original: "I has a dog" }],
    });
    const { payload: result, dropped } = validateFeedback(
      fabricated,
      transcript,
    );
    expect(result.corrections).toEqual([]);
    expect(dropped.corrections).toBe(1);
  });

  it("drops findings that cite unknown or coach messages", () => {
    const result = validateFeedback(
      payload({
        strengths: [{ evidence_message_id: "a1", comment_tr: "x" }],
        corrections: [
          { ...payload().corrections[0], evidence_message_id: "missing" },
        ],
        learning_candidates: [
          { ...payload().learning_candidates[0], source_message_id: "a2" },
        ],
      }),
      transcript,
    );
    expect(result.payload.strengths).toEqual([]);
    expect(result.payload.corrections).toEqual([]);
    expect(result.payload.learning_candidates).toEqual([]);
  });

  it("drops no-op corrections and matches quotes case/quote-insensitively", () => {
    const result = validateFeedback(
      payload({
        corrections: [
          {
            ...payload().corrections[0],
            original: "i’m INTERESTING melodic techno",
          },
          {
            ...payload().corrections[0],
            evidence_message_id: "u2",
            original: "I go to Berlin",
            improved: "i go to berlin",
          },
        ],
      }),
      transcript,
    );
    expect(result.payload.corrections).toHaveLength(1);
    expect(result.payload.corrections[0].evidence_message_id).toBe("u1");
  });

  it("keeps at most three corrections, highest severity first", () => {
    const base = payload().corrections[0];
    const corrections = (["low", "medium", "high", "low"] as const).map(
      (severity) => ({ ...base, severity }),
    );
    const result = validateFeedback(payload({ corrections }), transcript)
      .payload.corrections;
    expect(result.map((c) => c.severity)).toEqual(["high", "medium", "low"]);
  });

  it("deduplicates candidates by normalized phrase and clamps task minutes", () => {
    const candidate = payload().learning_candidates[0];
    const result = validateFeedback(
      payload({
        learning_candidates: [candidate, { ...candidate, phrase: "i’m into" }],
        next_task: { title: "x", instructions: "y", estimated_minutes: 90 },
      }),
      transcript,
    ).payload;
    expect(result.learning_candidates).toHaveLength(1);
    expect(result.next_task.estimated_minutes).toBe(30);
  });

  it("keeps only evidence-backed debrief ratings for the scenario's rubric", () => {
    const scope = {
      rubricKeys: ["clarity", "turn_taking"],
      goals: ["Use “I'm into…”", "Suggest meeting again"],
    };
    const { payload: result } = validateFeedback(
      payload({
        rubric_scores: [
          {
            key: "clarity",
            rating: "solid",
            evidence_message_id: "u2",
            comment_tr: "Net.",
          },
          {
            key: "turn_taking",
            rating: "strong",
            evidence_message_id: "a1",
            comment_tr: "Koç mesajı kanıt değildir.",
          },
          {
            key: "made_up",
            rating: "strong",
            evidence_message_id: "u1",
            comment_tr: "Rubrikte yok.",
          },
          {
            key: "clarity",
            rating: "strong",
            evidence_message_id: "u1",
            comment_tr: "Tekrar.",
          },
        ],
        goal_outcomes: [
          {
            goal: 'use "I\'m into..."',
            status: "met",
            evidence_message_id: "u1",
          },
          {
            goal: "Suggest meeting again",
            status: "met",
            evidence_message_id: null,
          },
          { goal: "Invented goal", status: "met", evidence_message_id: "u1" },
        ],
      }),
      transcript,
      scope,
    );
    expect(result.rubric_scores.map((s) => [s.key, s.rating])).toEqual([
      ["clarity", "solid"],
      ["turn_taking", "not_observed"],
    ]);
    expect(result.goal_outcomes).toEqual([
      { goal: "Use “I'm into…”", status: "met", evidence_message_id: "u1" },
      {
        goal: "Suggest meeting again",
        status: "not_yet",
        evidence_message_id: null,
      },
    ]);
  });

  it("drops debrief entries for free conversations", () => {
    const { payload: result } = validateFeedback(
      payload({
        rubric_scores: [
          {
            key: "clarity",
            rating: "solid",
            evidence_message_id: "u1",
            comment_tr: "…",
          },
        ],
      }),
      transcript,
    );
    expect(result.rubric_scores).toEqual([]);
  });
});
