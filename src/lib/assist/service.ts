import "server-only";
import type { CurrentUser, Profile } from "@/lib/auth/dal";
import {
  HINTS_PROMPT,
  TRANSLATE_PROMPT,
  TRANSLATE_VERSION,
} from "@/lib/ai/prompts/assist";
import { getAiConfig } from "@/lib/ai/config";
import { runStructured } from "@/lib/ai/structured";
import {
  hintsSchema,
  translationSchema,
  validateHints,
  type Hints,
} from "@/lib/assist/schema";
import { SessionError } from "@/lib/sessions/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const HINT_CONTEXT_TURNS = 6;

/**
 * Turkish translation of a coach turn, generated once and stored; later
 * views read the stored text. Only assistant messages are translated.
 */
export async function translateMessage(
  user: CurrentUser,
  messageId: string,
): Promise<string> {
  const supabase = await createClient();
  const { data: message } = await supabase
    .from("messages")
    .select("id, content, role, session_id")
    .eq("id", messageId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!message || message.role !== "assistant")
    throw new SessionError("not_found", "Mesaj bulunamadı.");

  const { data: stored } = await supabase
    .from("message_translations")
    .select("text_tr")
    .eq("message_id", messageId)
    .maybeSingle();
  if (stored) return stored.text_tr;

  const { fastModel } = getAiConfig();
  const result = await runStructured({
    schema: translationSchema,
    system: TRANSLATE_PROMPT,
    content: `<message>${message.content}</message>`,
    userId: user.id,
    sessionId: message.session_id,
    operation: "translation",
    model: fastModel,
    maxTokens: 2000,
  });
  const textTr = result.text_tr.trim();
  if (!textTr) throw new SessionError("ai_failed");

  // A concurrent request may have stored it first; either text is fine.
  const { error } = await createAdminClient()
    .from("message_translations")
    .upsert(
      {
        message_id: messageId,
        user_id: user.id,
        text_tr: textTr,
        model: fastModel,
        prompt_version: TRANSLATE_VERSION,
      },
      { onConflict: "message_id", ignoreDuplicates: true },
    );
  if (error) console.error("[assist] translation insert", error.code);
  return textTr;
}

/** Words and sentence frames for answering the coach's latest turn. */
export async function conversationHints(
  user: CurrentUser,
  profile: Profile,
  sessionId: string,
): Promise<Hints> {
  const supabase = await createClient();
  const [{ data: session }, { data: turns }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, scenario_id, status")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .in("role", ["user", "assistant"])
      .order("sequence_number", { ascending: false })
      .limit(HINT_CONTEXT_TURNS),
  ]);
  if (!session) throw new SessionError("not_found");
  const recent = (turns ?? []).reverse();
  if (recent.at(-1)?.role !== "assistant")
    throw new SessionError("not_ready", "İpucu için koçun sorusunu bekle.");

  const scenario = session.scenario_id
    ? (
        await supabase
          .from("scenarios")
          .select("title, goals")
          .eq("id", session.scenario_id)
          .maybeSingle()
      ).data
    : null;

  const { fastModel } = getAiConfig();
  const raw = await runStructured({
    schema: hintsSchema,
    system: HINTS_PROMPT,
    content: [
      `<learner>${JSON.stringify({
        english_variety: profile.dialect,
        purpose: profile.purpose,
        goals: profile.goals,
        interests: profile.interests,
      })}</learner>`,
      scenario
        ? `<scenario>${JSON.stringify({ title: scenario.title, goals: scenario.goals })}</scenario>`
        : "",
      `<transcript>${JSON.stringify(recent)}</transcript>`,
    ].join("\n"),
    userId: user.id,
    sessionId,
    operation: "hints",
    model: fastModel,
    maxTokens: 2000,
  });
  try {
    return validateHints(raw);
  } catch {
    throw new SessionError("ai_failed", "İpucu oluşturulamadı. Tekrar dene.");
  }
}
