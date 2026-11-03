import "server-only";
import type { CurrentUser, Profile } from "@/lib/auth/dal";
import {
  taskFeedbackSchema,
  validateTaskFeedback,
  validateWritingResponse,
  writingResponseSchema,
  type TaskFeedback,
  type WritingResponse,
} from "@/lib/ai/analysis/writing";
import {
  TASK_FEEDBACK_PROMPT,
  TASK_FEEDBACK_VERSION,
  WRITING_COACH_PROMPT,
  WRITING_COACH_VERSION,
} from "@/lib/ai/prompts/writing";
import { runStructured } from "@/lib/ai/structured";
import { SessionError } from "@/lib/sessions/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/types/database";

export const REGISTERS = [
  "casual",
  "neutral",
  "professional",
  "formal",
] as const;
export type Register = (typeof REGISTERS)[number];
export const MAX_WRITING_CHARS = 4000;
const HISTORY_LIMIT = 10;

export type WritingEntryView = {
  id: string;
  sourceText: string;
  intent: string;
  register: Register;
  response: WritingResponse;
  revisionText: string | null;
  revisionFeedback: TaskFeedback | null;
  createdAt: string;
};

function toView(row: Tables<"writing_entries">): WritingEntryView {
  return {
    id: row.id,
    sourceText: row.source_text,
    intent: row.intent,
    register: row.register as Register,
    response: row.response as unknown as WritingResponse,
    revisionText: row.revision_text,
    revisionFeedback: row.revision_feedback as unknown as TaskFeedback | null,
    createdAt: row.created_at,
  };
}

export async function listWritingEntries(
  user: CurrentUser,
): Promise<WritingEntryView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("writing_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error)
    throw new Error("Writing entries could not be loaded.", { cause: error });
  return data.map(toView);
}

/** POST /api/writing/evaluate: coach response, stored server-side. */
export async function evaluateWriting(
  user: CurrentUser,
  profile: Profile,
  input: { sourceText: string; intent: string; register: Register },
): Promise<WritingEntryView> {
  const raw = await runStructured({
    schema: writingResponseSchema,
    system: WRITING_COACH_PROMPT,
    content: JSON.stringify({
      original_text: input.sourceText,
      intent: input.intent,
      register: input.register,
      english_variety: profile.dialect,
    }),
    userId: user.id,
    operation: "writing_coach",
    effort: "medium",
  });
  const response = validateWritingResponse(raw, input.sourceText);

  const { data, error } = await createAdminClient()
    .from("writing_entries")
    .insert({
      user_id: user.id,
      source_text: input.sourceText,
      intent: input.intent,
      register: input.register,
      coach_version: WRITING_COACH_VERSION,
      response: response as unknown as NonNullable<Json>,
    })
    .select("*")
    .single();
  if (error || !data)
    throw new Error("Writing entry could not be saved.", { cause: error });
  return toView(data);
}

/** The learner's own revision, checked against the revision exercise. */
export async function reviseWriting(
  user: CurrentUser,
  profile: Profile,
  id: string,
  revisionText: string,
): Promise<WritingEntryView> {
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("writing_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!entry) throw new SessionError("not_found", "Bu metin bulunamadı.");
  const response = entry.response as unknown as WritingResponse;

  const raw = await runStructured({
    schema: taskFeedbackSchema,
    system: TASK_FEEDBACK_PROMPT,
    content: JSON.stringify({
      task_title: `Revision exercise: ${response.revision_exercise.focus}`,
      instructions: response.revision_exercise.instructions_tr,
      reference: response.improved_text,
      original_text: entry.source_text,
      learner_answer: revisionText,
      english_variety: profile.dialect,
    }),
    userId: user.id,
    operation: "task_feedback",
  });
  const feedback = {
    ...validateTaskFeedback(raw, revisionText),
    version: TASK_FEEDBACK_VERSION,
  };

  const { data, error } = await createAdminClient()
    .from("writing_entries")
    .update({
      revision_text: revisionText,
      revision_feedback: feedback as unknown as NonNullable<Json>,
      revised_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error || !data)
    throw new Error("Revision could not be saved.", { cause: error });
  return toView(data);
}

export async function deleteWritingEntry(user: CurrentUser, id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("writing_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error)
    throw new Error("Writing entry could not be deleted.", { cause: error });
}
