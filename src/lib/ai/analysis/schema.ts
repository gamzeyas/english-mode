import { z } from "zod";
import { normalizePhrase } from "@/lib/text/normalize";

/**
 * Feedback analyzer output (PRD §6). `pattern_key` on corrections is an
 * addition: a short snake_case label used to track recurring error patterns.
 */
export const feedbackSchema = z.object({
  summary_tr: z.string(),
  strengths: z.array(
    z.object({ evidence_message_id: z.string(), comment_tr: z.string() }),
  ),
  corrections: z.array(
    z.object({
      evidence_message_id: z.string(),
      original: z.string(),
      improved: z.string(),
      reason_tr: z.string(),
      category: z.enum(["grammar", "word_choice", "naturalness", "clarity"]),
      severity: z.enum(["low", "medium", "high"]),
      pattern_key: z.string(),
    }),
  ),
  learning_candidates: z.array(
    z.object({
      phrase: z.string(),
      meaning_tr: z.string(),
      example: z.string(),
      source_message_id: z.string(),
      reason: z.enum(["corrected", "useful", "mastered"]),
    }),
  ),
  next_task: z.object({
    title: z.string(),
    instructions: z.string(),
    estimated_minutes: z.number(),
  }),
  confidence_notes: z.array(z.string()),
});

export type FeedbackPayload = z.infer<typeof feedbackSchema>;

export const MAX_CORRECTIONS = 3;
export const MAX_STRENGTHS = 3;
export const MAX_CANDIDATES = 5;

type TranscriptMessage = { id: string; role: string; content: string };

/** Case/quote/whitespace-insensitive containment for evidence quotes. */
function containsQuote(source: string, quote: string): boolean {
  const needle = normalizePhrase(quote);
  return needle.length > 0 && normalizePhrase(source).includes(needle);
}

function slugPattern(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export type ValidationReport = {
  payload: FeedbackPayload;
  dropped: { strengths: number; corrections: number; candidates: number };
};

/**
 * Enforces "no fabricated errors" (PRD §6): every finding must reference a
 * real learner message, and every correction's `original` must actually
 * appear in it. Anything else is dropped, then lists are capped.
 */
export function validateFeedback(
  raw: FeedbackPayload,
  transcript: TranscriptMessage[],
): ValidationReport {
  const learnerMessages = new Map(
    transcript.filter((m) => m.role === "user").map((m) => [m.id, m.content]),
  );

  const strengths = raw.strengths.filter((s) =>
    learnerMessages.has(s.evidence_message_id),
  );

  const corrections = raw.corrections
    .filter((c) => {
      const source = learnerMessages.get(c.evidence_message_id);
      return (
        source !== undefined &&
        containsQuote(source, c.original) &&
        normalizePhrase(c.original) !== normalizePhrase(c.improved)
      );
    })
    .map((c) => ({
      ...c,
      pattern_key: slugPattern(c.pattern_key) || c.category,
    }));

  const seen = new Set<string>();
  const candidates = raw.learning_candidates.filter((c) => {
    const key = normalizePhrase(c.phrase);
    if (!key || key.length > 300 || seen.has(key)) return false;
    if (!learnerMessages.has(c.source_message_id)) return false;
    seen.add(key);
    return true;
  });

  const severityRank = { high: 0, medium: 1, low: 2 } as const;
  const topCorrections = [...corrections]
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .slice(0, MAX_CORRECTIONS);

  return {
    payload: {
      ...raw,
      strengths: strengths.slice(0, MAX_STRENGTHS),
      corrections: topCorrections,
      learning_candidates: candidates.slice(0, MAX_CANDIDATES),
      next_task: {
        ...raw.next_task,
        estimated_minutes: Math.min(
          30,
          Math.max(5, Math.round(raw.next_task.estimated_minutes)),
        ),
      },
    },
    dropped: {
      strengths: raw.strengths.length - strengths.length,
      corrections: raw.corrections.length - corrections.length,
      candidates: raw.learning_candidates.length - candidates.length,
    },
  };
}
