import "server-only";
import type { CurrentUser, Profile } from "@/lib/auth/dal";
import { assertAiRateLimit } from "@/lib/ai/rate-limit";
import { recordAudioUsage } from "@/lib/ai/usage";
import { getServerEnv } from "@/lib/env";
import { findPracticeSentence } from "@/lib/pronunciation/catalog";
import { SessionError } from "@/lib/sessions/errors";
import { dialectOf, synthesize } from "@/lib/speech/speak";
import {
  assessWithAzure,
  AzurePronunciationError,
  MAX_ASSESSMENT_SECONDS,
  MAX_REFERENCE_CHARS,
  PRONUNCIATION_ASSESSOR,
  type PronunciationResult,
} from "@/lib/speech/pronunciation";
import { assertVoiceConsent, readRecording } from "@/lib/speech/service";
import type { SpeechRate } from "@/lib/speech/tts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/types/database";

const HISTORY_LIMIT = 30;

export type ReferenceSource =
  | { source: "catalog"; ref: string }
  | { source: "pool"; ref: string }
  | { source: "custom"; text: string };

export type PronunciationAttemptView = {
  id: string;
  referenceText: string;
  source: "catalog" | "pool" | "custom";
  sourceRef: string | null;
  locale: "en-US" | "en-GB";
  pronScore: number | null;
  result: PronunciationResult | null;
  createdAt: string;
};

function toView(
  row: Tables<"pronunciation_attempts">,
): PronunciationAttemptView {
  return {
    id: row.id,
    referenceText: row.reference_text,
    source: row.source as PronunciationAttemptView["source"],
    sourceRef: row.source_ref,
    locale: row.locale as PronunciationAttemptView["locale"],
    pronScore: row.pron_score,
    result: row.result as unknown as PronunciationResult | null,
    createdAt: row.created_at,
  };
}

/**
 * The server decides what the reference text is: a catalog key, a pool
 * item the learner owns, or their own short sentence. The same resolution
 * backs the sample audio, so TTS never speaks arbitrary long text.
 */
export async function resolveReference(
  user: CurrentUser,
  input: ReferenceSource,
): Promise<{
  text: string;
  source: ReferenceSource["source"];
  ref: string | null;
}> {
  if (input.source === "catalog") {
    const sentence = findPracticeSentence(input.ref);
    if (!sentence) throw new SessionError("not_found", "Cümle bulunamadı.");
    return { text: sentence.text, source: "catalog", ref: input.ref };
  }
  if (input.source === "pool") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("learning_items")
      .select("id, phrase")
      .eq("id", input.ref)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) throw new SessionError("not_found", "İfade bulunamadı.");
    return { text: data.phrase, source: "pool", ref: data.id };
  }
  const text = input.text.replace(/\s+/g, " ").trim();
  if (!/[a-z]/i.test(text) || text.length > MAX_REFERENCE_CHARS) {
    throw new SessionError(
      "invalid_request",
      `Cümle en fazla ${MAX_REFERENCE_CHARS} karakter, İngilizce olmalı.`,
    );
  }
  return { text, source: "custom", ref: null };
}

export async function listPronunciationAttempts(
  user: CurrentUser,
): Promise<PronunciationAttemptView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pronunciation_attempts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return data.map(toView);
}

/** Sample audio of the reference (or one word of it) in the learner's variety. */
export async function referenceAudio(
  user: CurrentUser,
  profile: Profile,
  input: ReferenceSource & { word?: string; rate: SpeechRate },
): Promise<ArrayBuffer> {
  const { text } = await resolveReference(user, input);
  let spoken = text;
  if (input.word) {
    const words: string[] = text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
    if (!words.includes(input.word.toLowerCase()))
      throw new SessionError("invalid_request", "Kelime cümlede yok.");
    spoken = input.word;
  }
  return synthesize(user, {
    segments: [{ speaker: "a", text: spoken }],
    dialect: dialectOf(profile),
    rate: input.rate,
    sessionId: null,
  });
}

/** POST /api/pronunciation: assess a read-aloud recording and keep the result. */
export async function assessPronunciation(
  user: CurrentUser,
  profile: Profile,
  input: { audio: Blob; reference: ReferenceSource },
): Promise<PronunciationAttemptView> {
  await assertVoiceConsent();
  const reference = await resolveReference(user, input.reference);
  const { bytes, wav } = await readRecording(
    input.audio,
    MAX_ASSESSMENT_SECONDS,
  );

  const env = getServerEnv();
  if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION)
    throw new SessionError("voice_not_configured");
  await assertAiRateLimit(user.id, "azure");

  const locale = dialectOf(profile);
  let result: PronunciationResult | null;
  try {
    result = await assessWithAzure({
      key: env.AZURE_SPEECH_KEY,
      region: env.AZURE_SPEECH_REGION,
      audio: bytes,
      referenceText: reference.text,
      locale,
    });
  } catch (error) {
    if (error instanceof AzurePronunciationError) {
      console.error("[pronunciation] azure error", error.status);
      if (error.status === 401 || error.status === 403)
        throw new SessionError("voice_not_configured");
      if (error.status === 429) throw new SessionError("rate_limited");
      throw new SessionError(
        "voice_failed",
        "Değerlendirme yapılamadı. Tekrar dene.",
      );
    }
    if ((error as Error).name === "TimeoutError")
      throw new SessionError(
        "voice_failed",
        "Değerlendirme yapılamadı. Tekrar dene.",
      );
    throw error;
  }
  // Billed like speech to text (audio seconds); the recording is discarded.
  await recordAudioUsage({
    userId: user.id,
    sessionId: null,
    audioSeconds: wav.durationSeconds,
    model: "pronunciation-assessment",
    operation: "pronunciation",
  });
  if (!result || result.words.length === 0) throw new SessionError("no_speech");

  const { data, error } = await createAdminClient()
    .from("pronunciation_attempts")
    .insert({
      user_id: user.id,
      reference_text: reference.text,
      locale,
      source: reference.source,
      source_ref: reference.ref,
      pron_score: result.scores.pronunciation,
      result: result as unknown as NonNullable<Json>,
      assessor_version: PRONUNCIATION_ASSESSOR,
      private_audio_path: null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toView(data);
}

export async function deletePronunciationAttempt(
  user: CurrentUser,
  id: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pronunciation_attempts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}
