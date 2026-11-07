import "server-only";
import type { CurrentUser, Profile } from "@/lib/auth/dal";
import { assertAiRateLimit } from "@/lib/ai/rate-limit";
import { recordTtsUsage } from "@/lib/ai/usage";
import { getServerEnv } from "@/lib/env";
import {
  AzureTtsError,
  billedCharacters,
  buildSsml,
  MAX_TTS_CHARS,
  synthesizeWithAzure,
  type Dialect,
  type SpeechRate,
  type SpeechSegment,
} from "@/lib/speech/tts";
import { SessionError } from "@/lib/sessions/errors";
import { createClient } from "@/lib/supabase/server";

export const dialectOf = (profile: Profile): Dialect =>
  profile.dialect === "en-GB" ? "en-GB" : "en-US";

/**
 * Synthesizes server-owned text only (coach turns, listening material): the
 * client names what to speak, never supplies the text, so the endpoint can't
 * be used as a general-purpose TTS proxy. No voice consent is needed — the
 * learner's own voice isn't processed.
 */
export async function synthesize(
  user: CurrentUser,
  input: {
    segments: SpeechSegment[];
    dialect: Dialect;
    rate: SpeechRate;
    sessionId: string | null;
  },
): Promise<ArrayBuffer> {
  const env = getServerEnv();
  if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION)
    throw new SessionError("voice_not_configured");
  const characters = billedCharacters(input.segments);
  if (characters === 0 || characters > MAX_TTS_CHARS)
    throw new SessionError(
      "invalid_request",
      "Seslendirilecek metin uygun değil.",
    );

  await assertAiRateLimit(user.id);
  let audio: ArrayBuffer;
  try {
    audio = await synthesizeWithAzure({
      key: env.AZURE_SPEECH_KEY,
      region: env.AZURE_SPEECH_REGION,
      ssml: buildSsml(input.segments, input),
    });
  } catch (error) {
    if (error instanceof AzureTtsError) {
      console.error("[tts] azure error", error.status);
      if (error.status === 401 || error.status === 403)
        throw new SessionError("voice_not_configured");
      if (error.status === 429) throw new SessionError("rate_limited");
      throw new SessionError(
        "voice_failed",
        "Ses oluşturulamadı. Tekrar dene.",
      );
    }
    if ((error as Error).name === "TimeoutError")
      throw new SessionError(
        "voice_failed",
        "Ses oluşturulamadı. Tekrar dene.",
      );
    throw error;
  }
  await recordTtsUsage({
    userId: user.id,
    sessionId: input.sessionId,
    characters,
  });
  return audio;
}

/** A coach turn read aloud in the learner's chosen English variety. */
export async function speakMessage(
  user: CurrentUser,
  profile: Profile,
  messageId: string,
  rate: SpeechRate,
): Promise<ArrayBuffer> {
  const supabase = await createClient();
  const { data: message } = await supabase
    .from("messages")
    .select("content, role, session_id")
    .eq("id", messageId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!message || message.role !== "assistant")
    throw new SessionError("not_found", "Mesaj bulunamadı.");
  return synthesize(user, {
    segments: [{ speaker: "a", text: message.content }],
    dialect: dialectOf(profile),
    rate,
    sessionId: message.session_id,
  });
}
