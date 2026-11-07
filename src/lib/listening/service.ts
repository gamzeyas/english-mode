import "server-only";
import type { CurrentUser, Profile } from "@/lib/auth/dal";
import {
  COMPREHENSION_PROMPT,
  DICTATION_PROMPT,
  LISTENING_VERSION,
} from "@/lib/ai/prompts/listening";
import { runStructured } from "@/lib/ai/structured";
import {
  comprehensionSchema,
  dictationSchema,
  validateComprehension,
  validateDictation,
  type ComprehensionContent,
  type DictationContent,
  type ListeningExerciseView,
  type ListeningKind,
  type ListeningResult,
} from "@/lib/listening/content";
import { gradeDictation } from "@/lib/listening/grade";
import { SessionError } from "@/lib/sessions/errors";
import { dialectOf, synthesize } from "@/lib/speech/speak";
import type { SpeechRate } from "@/lib/speech/tts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/types/database";

const HISTORY_LIMIT = 20;
export const MAX_DICTATION_ANSWER = 400;

type Row = Tables<"listening_exercises">;

function toView(row: Row): ListeningExerciseView {
  const kind = row.kind as ListeningKind;
  const result = row.result as unknown as ListeningResult | null;
  const base = {
    id: row.id,
    kind,
    dialect: row.dialect as ListeningExerciseView["dialect"],
    createdAt: row.created_at,
    completedAt: row.completed_at,
    score: row.score,
    result,
  };
  if (kind === "dictation") {
    const content = row.content as unknown as DictationContent;
    return {
      ...base,
      title: content.title,
      items: content.sentences.length,
      contextTr: null,
      questions: [],
    };
  }
  const content = row.content as unknown as ComprehensionContent;
  return {
    ...base,
    title: content.title,
    items: 1,
    contextTr: content.context_tr,
    // Answer key and transcript stay on the server until submission.
    questions: content.questions.map(({ question, options }) => ({
      question,
      options,
    })),
  };
}

export async function listListeningExercises(
  user: CurrentUser,
): Promise<ListeningExerciseView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listening_exercises")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return data.map(toView);
}

async function loadRow(user: CurrentUser, id: string): Promise<Row> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listening_exercises")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) throw new SessionError("not_found", "Alıştırma bulunamadı.");
  return data;
}

async function learnerBrief(user: CurrentUser, profile: Profile) {
  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("assessments")
    .select("estimated_level")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return JSON.stringify({
    english_variety: dialectOf(profile),
    estimated_level: latest?.estimated_level ?? "unknown (assume A2-B1)",
    purpose: profile.purpose,
    goals: profile.goals,
    interests: profile.interests,
  });
}

export async function createListeningExercise(
  user: CurrentUser,
  profile: Profile,
  kind: ListeningKind,
): Promise<ListeningExerciseView> {
  const content = `<learner>${await learnerBrief(user, profile)}</learner>`;
  let generated: DictationContent | ComprehensionContent;
  try {
    generated =
      kind === "dictation"
        ? validateDictation(
            await runStructured({
              schema: dictationSchema,
              system: DICTATION_PROMPT,
              content,
              userId: user.id,
              operation: "listening",
              maxTokens: 3000,
            }),
          )
        : validateComprehension(
            await runStructured({
              schema: comprehensionSchema,
              system: COMPREHENSION_PROMPT,
              content,
              userId: user.id,
              operation: "listening",
              maxTokens: 4000,
            }),
          );
  } catch (error) {
    if (error instanceof SessionError) throw error;
    console.error("[listening] invalid material", (error as Error).message);
    throw new SessionError(
      "ai_failed",
      "Alıştırma oluşturulamadı. Tekrar dene.",
    );
  }

  const { data, error } = await createAdminClient()
    .from("listening_exercises")
    .insert({
      user_id: user.id,
      kind,
      content: generated as unknown as NonNullable<Json>,
      generator_version: LISTENING_VERSION,
      dialect: dialectOf(profile),
    })
    .select("*")
    .single();
  if (error) throw error;
  return toView(data);
}

/** Audio for one dictation sentence, or the whole comprehension dialogue. */
export async function listeningAudio(
  user: CurrentUser,
  id: string,
  item: number,
  rate: SpeechRate,
): Promise<ArrayBuffer> {
  const row = await loadRow(user, id);
  const dialect = row.dialect as "en-US" | "en-GB";
  if (row.kind === "dictation") {
    const sentence = (row.content as unknown as DictationContent).sentences[
      item
    ];
    if (!sentence) throw new SessionError("not_found", "Cümle bulunamadı.");
    return synthesize(user, {
      segments: [{ speaker: "a", text: sentence.text }],
      dialect,
      rate,
      sessionId: null,
    });
  }
  const { lines } = row.content as unknown as ComprehensionContent;
  return synthesize(user, { segments: lines, dialect, rate, sessionId: null });
}

export async function submitListeningAnswers(
  user: CurrentUser,
  id: string,
  answers: { dictation?: string[]; choices?: (number | null)[] },
): Promise<ListeningExerciseView> {
  const row = await loadRow(user, id);
  if (row.completed_at) return toView(row);

  let result: ListeningResult;
  let score: number;
  if (row.kind === "dictation") {
    const { sentences } = row.content as unknown as DictationContent;
    const typed = answers.dictation ?? [];
    const graded = sentences.map((s, i) => {
      const answer = (typed[i] ?? "").slice(0, MAX_DICTATION_ANSWER);
      return {
        text: s.text,
        focusTr: s.focus_tr,
        answer,
        grade: gradeDictation(s.text, answer),
      };
    });
    const total = graded.reduce((sum, s) => sum + s.grade.total, 0);
    const correct = graded.reduce((sum, s) => sum + s.grade.correct, 0);
    result = { kind: "dictation", sentences: graded };
    score = total ? correct / total : 0;
  } else {
    const content = row.content as unknown as ComprehensionContent;
    const chosen = answers.choices ?? [];
    const questions = content.questions.map((q, i) => ({
      question: q.question,
      options: q.options,
      answerIndex: q.answer_index,
      chosen: chosen[i] ?? null,
      explanationTr: q.explanation_tr,
    }));
    result = { kind: "comprehension", lines: content.lines, questions };
    score =
      questions.filter((q) => q.chosen === q.answerIndex).length /
      questions.length;
  }

  // Server-graded and server-written; a concurrent submit keeps the first.
  const { data, error } = await createAdminClient()
    .from("listening_exercises")
    .update({
      answers: answers as unknown as NonNullable<Json>,
      result: result as unknown as NonNullable<Json>,
      score: Math.round(score * 1000) / 1000,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("completed_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return toView(data ?? (await loadRow(user, id)));
}

export async function deleteListeningExercise(user: CurrentUser, id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("listening_exercises")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}
