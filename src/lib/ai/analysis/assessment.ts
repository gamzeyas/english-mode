import { z } from "zod";
import { containsQuote, RUBRIC_RATINGS } from "@/lib/ai/analysis/schema";
import {
  ASSESSMENT_CRITERIA,
  ASSESSMENT_TASKS,
  CEFR_BANDS,
} from "@/lib/assessment/tasks";

const criterionKeys = ASSESSMENT_CRITERIA.map((c) => c.key) as [
  (typeof ASSESSMENT_CRITERIA)[number]["key"],
  ...(typeof ASSESSMENT_CRITERIA)[number]["key"][],
];

export const assessmentSchema = z.object({
  tasks: z.array(
    z.object({
      task_key: z.string(),
      criteria: z.array(
        z.object({
          key: z.enum(criterionKeys),
          rating: z.enum(RUBRIC_RATINGS),
          evidence_quote: z.string().nullable(),
          comment_tr: z.string(),
        }),
      ),
    }),
  ),
  approx_level: z.object({
    low: z.enum(CEFR_BANDS),
    high: z.enum(CEFR_BANDS),
  }),
  summary_tr: z.string(),
  focus_areas_tr: z.array(z.string()),
  confidence_notes: z.array(z.string()),
});
export type AssessmentResult = z.infer<typeof assessmentSchema>;

/**
 * Keeps only known tasks/criteria; a rating needs a quote that really appears
 * in that task's answer, otherwise it becomes "not_observed". The level range
 * is ordered and labelled informal by the caller.
 */
export function validateAssessment(
  raw: AssessmentResult,
  answers: Record<string, string>,
): AssessmentResult {
  const tasks = ASSESSMENT_TASKS.flatMap((task) => {
    const found = raw.tasks.find((t) => t.task_key === task.key);
    const answer = answers[task.key];
    if (!found || answer === undefined) return [];
    const criteria = ASSESSMENT_CRITERIA.flatMap((criterion) => {
      const entry = found.criteria.find((c) => c.key === criterion.key);
      if (!entry) return [];
      const quoted =
        entry.evidence_quote !== null &&
        containsQuote(answer, entry.evidence_quote);
      return [
        {
          ...entry,
          evidence_quote: quoted ? entry.evidence_quote : null,
          rating: quoted ? entry.rating : ("not_observed" as const),
        },
      ];
    });
    return [{ task_key: task.key, criteria }];
  });

  const low = CEFR_BANDS.indexOf(raw.approx_level.low);
  const high = CEFR_BANDS.indexOf(raw.approx_level.high);
  return {
    ...raw,
    tasks,
    approx_level: {
      low: CEFR_BANDS[Math.min(low, high)],
      high: CEFR_BANDS[Math.max(low, high)],
    },
    focus_areas_tr: raw.focus_areas_tr.slice(0, 3),
  };
}

export function formatLevelRange(level: AssessmentResult["approx_level"]) {
  return level.low === level.high ? level.low : `${level.low}–${level.high}`;
}
