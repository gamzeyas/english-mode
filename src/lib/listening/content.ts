import { z } from "zod";
import type { DictationGrade } from "@/lib/listening/grade";

/** Structured output schemas for generated listening material. */
export const dictationSchema = z.object({
  title: z.string(),
  sentences: z.array(z.object({ text: z.string(), focus_tr: z.string() })),
});

export const comprehensionSchema = z.object({
  title: z.string(),
  context_tr: z.string(),
  lines: z.array(z.object({ speaker: z.enum(["a", "b"]), text: z.string() })),
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      answer_index: z.number().int(),
      explanation_tr: z.string(),
    }),
  ),
});

export type DictationContent = z.infer<typeof dictationSchema>;
export type ComprehensionContent = z.infer<typeof comprehensionSchema>;
export type ListeningKind = "dictation" | "comprehension";

export const DICTATION_ITEMS = 5;
export const COMPREHENSION_QUESTIONS = 3;
const MAX_SENTENCE_CHARS = 200;
const MAX_DIALOGUE_CHARS = 1800;

/**
 * The model's output is checked, not trusted: wrong counts, empty text,
 * out-of-range answer keys or audio too long to synthesize are rejected so
 * the learner never gets an exercise that can't be answered correctly.
 */
export function validateDictation(raw: DictationContent): DictationContent {
  const sentences = raw.sentences
    .map((s) => ({ text: s.text.trim(), focus_tr: s.focus_tr.trim() }))
    .filter((s) => s.text && s.text.length <= MAX_SENTENCE_CHARS);
  if (sentences.length < 3) throw new Error("dictation: too few sentences");
  return {
    title: raw.title.trim(),
    sentences: sentences.slice(0, DICTATION_ITEMS),
  };
}

export function validateComprehension(
  raw: ComprehensionContent,
): ComprehensionContent {
  const lines = raw.lines
    .map((l) => ({ speaker: l.speaker, text: l.text.trim() }))
    .filter((l) => l.text);
  const chars = lines.reduce((sum, l) => sum + l.text.length, 0);
  if (lines.length < 4 || chars > MAX_DIALOGUE_CHARS)
    throw new Error("comprehension: dialogue length");
  const questions = raw.questions.filter(
    (q) =>
      q.question.trim() &&
      q.options.length >= 2 &&
      q.options.length <= 4 &&
      q.options.every((o) => o.trim()) &&
      q.answer_index >= 0 &&
      q.answer_index < q.options.length,
  );
  if (questions.length < 2) throw new Error("comprehension: questions");
  return {
    title: raw.title.trim(),
    context_tr: raw.context_tr.trim(),
    lines,
    questions: questions.slice(0, COMPREHENSION_QUESTIONS),
  };
}

/** What the learner may see before answering: no answer key, no transcript. */
export type ListeningExerciseView = {
  id: string;
  kind: ListeningKind;
  title: string;
  dialect: "en-US" | "en-GB";
  createdAt: string;
  completedAt: string | null;
  score: number | null;
  /** Dictation: number of sentences to play. */
  items: number;
  contextTr: string | null;
  questions: { question: string; options: string[] }[];
  result: ListeningResult | null;
};

export type ListeningResult =
  | {
      kind: "dictation";
      sentences: {
        text: string;
        focusTr: string;
        answer: string;
        grade: DictationGrade;
      }[];
    }
  | {
      kind: "comprehension";
      lines: ComprehensionContent["lines"];
      questions: {
        question: string;
        options: string[];
        answerIndex: number;
        chosen: number | null;
        explanationTr: string;
      }[];
    };
