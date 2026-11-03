import "server-only";
import type { CurrentUser, Profile } from "@/lib/auth/dal";
import {
  assessmentSchema,
  formatLevelRange,
  validateAssessment,
  type AssessmentResult,
} from "@/lib/ai/analysis/assessment";
import { ASSESSOR_PROMPT, ASSESSOR_VERSION } from "@/lib/ai/prompts/assessment";
import { runStructured } from "@/lib/ai/structured";
import {
  ASSESSMENT_TASKS,
  nextMatchedAt,
  TASK_SET_ID,
  wordCount,
} from "@/lib/assessment/tasks";
import { SessionError } from "@/lib/sessions/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type AssessmentView = {
  id: string;
  kind: "baseline" | "matched";
  taskSet: string;
  createdAt: string;
  estimatedLevel: string | null;
  result: AssessmentResult;
  answers: { taskKey: string; prompt: string; answer: string }[];
};

export async function listAssessments(
  user: CurrentUser,
): Promise<AssessmentView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error)
    throw new Error("Assessments could not be loaded.", { cause: error });
  return data.map((row) => ({
    id: row.id,
    kind: row.kind as AssessmentView["kind"],
    taskSet: row.task_set,
    createdAt: row.created_at,
    estimatedLevel: row.estimated_level,
    result: row.rubric as unknown as AssessmentResult,
    answers:
      (row.evidence as { answers?: AssessmentView["answers"] }).answers ?? [],
  }));
}

/**
 * Baseline first, then a matched re-take (same prompts) at most every two
 * weeks (PRD §11). The rubric is written server-side and is never official.
 */
export async function submitAssessment(
  user: CurrentUser,
  profile: Profile,
  answers: Record<string, string>,
): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("assessments")
    .select("created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const opensAt = nextMatchedAt(latest?.created_at ?? null, new Date());
  if (opensAt) {
    throw new SessionError(
      "not_ready",
      `Eşleştirilmiş görev ${opensAt.toLocaleDateString("tr-TR", { timeZone: profile.timezone })} tarihinde açılır.`,
    );
  }

  for (const task of ASSESSMENT_TASKS) {
    if (wordCount(answers[task.key] ?? "") < task.minWords) {
      throw new SessionError(
        "invalid_request",
        `Her cevap için en az ${task.minWords} kelime yaz.`,
      );
    }
  }

  const raw = await runStructured({
    schema: assessmentSchema,
    system: ASSESSOR_PROMPT,
    content: JSON.stringify({
      english_variety: profile.dialect,
      tasks: ASSESSMENT_TASKS.map((task) => ({
        task_key: task.key,
        prompt: task.prompt,
        answer: answers[task.key],
      })),
    }),
    userId: user.id,
    operation: "assessment",
    effort: "medium",
    maxTokens: 12000,
  });
  const result = validateAssessment(raw, answers);

  const { data, error } = await createAdminClient()
    .from("assessments")
    .insert({
      user_id: user.id,
      modality: "text",
      kind: latest ? "matched" : "baseline",
      task_set: TASK_SET_ID,
      assessor_version: ASSESSOR_VERSION,
      estimated_level: `${formatLevelRange(result.approx_level)} (informal)`,
      rubric: result as unknown as NonNullable<Json>,
      evidence: {
        answers: ASSESSMENT_TASKS.map((task) => ({
          taskKey: task.key,
          prompt: task.prompt,
          answer: answers[task.key],
        })),
      },
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error("Assessment could not be saved.", { cause: error });
  return { id: data.id };
}
