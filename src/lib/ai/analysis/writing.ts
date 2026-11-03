import { z } from "zod";
import { containsQuote } from "@/lib/ai/analysis/schema";
import { normalizePhrase } from "@/lib/text/normalize";

const correction = z.object({
  original: z.string(),
  improved: z.string(),
  reason_tr: z.string(),
  category: z.enum(["grammar", "word_choice", "naturalness", "clarity"]),
});
export type TextCorrection = z.infer<typeof correction>;

/** Feedback on a short written answer (assignments, writing revisions). */
export const taskFeedbackSchema = z.object({
  addresses_task: z.boolean(),
  summary_tr: z.string(),
  corrections: z.array(correction),
  improved_version: z.string(),
});
export type TaskFeedback = z.infer<typeof taskFeedbackSchema>;

/** Writing coach response (PRD §4 /writing). */
export const writingResponseSchema = z.object({
  improved_text: z.string(),
  summary_tr: z.string(),
  register_notes_tr: z.string(),
  corrections: z.array(correction),
  useful_phrases: z.array(
    z.object({
      phrase: z.string(),
      meaning_tr: z.string(),
      example: z.string(),
    }),
  ),
  revision_exercise: z.object({
    instructions_tr: z.string(),
    focus: z.string(),
  }),
});
export type WritingResponse = z.infer<typeof writingResponseSchema>;

export const MAX_TASK_CORRECTIONS = 3;
export const MAX_WRITING_CORRECTIONS = 5;
export const MAX_USEFUL_PHRASES = 3;

/**
 * No fabricated errors: a correction must quote the learner's own text and
 * actually change it. Unanchored ones are dropped, then the list is capped.
 */
export function anchorCorrections(
  corrections: TextCorrection[],
  source: string,
  max: number,
): TextCorrection[] {
  return corrections
    .filter(
      (c) =>
        containsQuote(source, c.original) &&
        normalizePhrase(c.original) !== normalizePhrase(c.improved),
    )
    .slice(0, max);
}

export function validateTaskFeedback(
  raw: TaskFeedback,
  answer: string,
): TaskFeedback {
  return {
    ...raw,
    corrections: anchorCorrections(
      raw.corrections,
      answer,
      MAX_TASK_CORRECTIONS,
    ),
  };
}

export function validateWritingResponse(
  raw: WritingResponse,
  source: string,
): WritingResponse {
  const seen = new Set<string>();
  return {
    ...raw,
    corrections: anchorCorrections(
      raw.corrections,
      source,
      MAX_WRITING_CORRECTIONS,
    ),
    useful_phrases: raw.useful_phrases
      .filter((p) => {
        const key = normalizePhrase(p.phrase);
        if (!key || key.length > 300 || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_USEFUL_PHRASES),
  };
}
