/**
 * Baseline task set (PRD §4 /assessment, §11). Matched re-takes use exactly
 * the same prompts, so results stay comparable within the same task/rubric.
 * Bump the id (never edit in place) if a prompt changes.
 */
export const TASK_SET_ID = "baseline-v1";

export type AssessmentTask = {
  key: string;
  prompt: string;
  hintTr: string;
  minWords: number;
};

export const ASSESSMENT_TASKS: AssessmentTask[] = [
  {
    key: "self_intro",
    prompt:
      "Introduce yourself as you would at the start of a job interview: who you are, what you do, and what you are looking for next.",
    hintTr: "4–6 cümle. Şimdiki zaman ve mesleki ifadeler.",
    minWords: 15,
  },
  {
    key: "project_story",
    prompt:
      "Describe a project you are proud of. What was the situation, what did you do, and what was the result?",
    hintTr: "5–8 cümle. Geçmiş zaman ve somut bir sonuç.",
    minWords: 20,
  },
  {
    key: "hypothetical",
    prompt:
      "If you could live and work in any city for a year, where would you go and why? What would a normal day look like?",
    hintTr: "4–6 cümle. “If I could…, I'd…” gibi koşul cümleleri.",
    minWords: 15,
  },
];

export const ASSESSMENT_CRITERIA = [
  { key: "task_completion", label: "Task completion" },
  { key: "range", label: "Range" },
  { key: "accuracy", label: "Accuracy" },
  { key: "coherence", label: "Coherence" },
] as const;

export const CEFR_BANDS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrBand = (typeof CEFR_BANDS)[number];

/** Matched tasks are fortnightly (PRD §11). */
export const MATCHED_INTERVAL_DAYS = 14;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** When the next matched task opens, or null if one is available now. */
export function nextMatchedAt(
  lastAssessmentIso: string | null,
  now: Date,
): Date | null {
  if (!lastAssessmentIso) return null;
  const opens = new Date(
    Date.parse(lastAssessmentIso) + MATCHED_INTERVAL_DAYS * 86_400_000,
  );
  return opens > now ? opens : null;
}
