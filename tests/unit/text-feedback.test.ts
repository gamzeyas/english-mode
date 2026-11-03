import { describe, expect, it } from "vitest";
import {
  validateAssessment,
  type AssessmentResult,
} from "@/lib/ai/analysis/assessment";
import {
  validateTaskFeedback,
  validateWritingResponse,
  type WritingResponse,
} from "@/lib/ai/analysis/writing";
import { nextMatchedAt, wordCount } from "@/lib/assessment/tasks";

const source =
  "Hi Anna, I write you for ask about the role. I am very interesting.";

describe("validateTaskFeedback", () => {
  it("drops corrections that do not quote the learner's text", () => {
    const result = validateTaskFeedback(
      {
        addresses_task: true,
        summary_tr: "…",
        improved_version: "…",
        corrections: [
          {
            original: "I write you for ask",
            improved: "I'm writing to ask",
            reason_tr: "…",
            category: "grammar",
          },
          {
            original: "a sentence the learner never wrote",
            improved: "x",
            reason_tr: "…",
            category: "grammar",
          },
          {
            original: "about the role",
            improved: "About the role",
            reason_tr: "Değişiklik yok.",
            category: "clarity",
          },
        ],
      },
      source,
    );
    expect(result.corrections.map((c) => c.original)).toEqual([
      "I write you for ask",
    ]);
  });
});

describe("validateWritingResponse", () => {
  it("caps and dedupes useful phrases", () => {
    const phrase = (p: string) => ({
      phrase: p,
      meaning_tr: "…",
      example: "…",
    });
    const raw: WritingResponse = {
      improved_text: "…",
      summary_tr: "…",
      register_notes_tr: "…",
      corrections: [],
      useful_phrases: [
        phrase("I'm writing to ask"),
        phrase("i'm writing to ask…"),
        phrase("I'd love to"),
        phrase("Looking forward to"),
        phrase("Best regards"),
      ],
      revision_exercise: { instructions_tr: "…", focus: "openings" },
    };
    expect(
      validateWritingResponse(raw, source).useful_phrases.map((p) => p.phrase),
    ).toEqual(["I'm writing to ask", "I'd love to", "Looking forward to"]);
  });
});

describe("validateAssessment", () => {
  const answers = {
    self_intro: "I am a creative director and I work worked at an agency.",
    project_story: "We built an AI tool that helps people find our photos.",
    hypothetical: "If I could live anywhere, I go to Berlin.",
  };

  it("keeps quoted ratings, marks unquoted ones not observed, orders the level", () => {
    const raw: AssessmentResult = {
      tasks: [
        {
          task_key: "self_intro",
          criteria: [
            {
              key: "accuracy",
              rating: "developing",
              evidence_quote: "I work worked at",
              comment_tr: "…",
            },
            {
              key: "range",
              rating: "strong",
              evidence_quote: "words the learner never wrote",
              comment_tr: "…",
            },
          ],
        },
        { task_key: "unknown_task", criteria: [] },
      ],
      approx_level: { low: "B2", high: "A2" },
      summary_tr: "…",
      focus_areas_tr: ["a", "b", "c", "d"],
      confidence_notes: [],
    };
    const result = validateAssessment(raw, answers);
    expect(result.tasks.map((t) => t.task_key)).toEqual(["self_intro"]);
    expect(
      result.tasks[0].criteria.map((c) => [c.key, c.rating, c.evidence_quote]),
    ).toEqual([
      ["range", "not_observed", null],
      ["accuracy", "developing", "I work worked at"],
    ]);
    expect(result.approx_level).toEqual({ low: "A2", high: "B2" });
    expect(result.focus_areas_tr).toHaveLength(3);
  });
});

describe("assessment scheduling", () => {
  const now = new Date("2026-11-20T10:00:00Z");

  it("opens the matched task 14 days after the last one", () => {
    expect(nextMatchedAt(null, now)).toBeNull();
    expect(nextMatchedAt("2026-11-10T10:00:00Z", now)?.toISOString()).toBe(
      "2026-11-24T10:00:00.000Z",
    );
    expect(nextMatchedAt("2026-11-01T10:00:00Z", now)).toBeNull();
  });

  it("counts words", () => {
    expect(wordCount("  I'm into   melodic techno. ")).toBe(4);
    expect(wordCount("")).toBe(0);
  });
});
