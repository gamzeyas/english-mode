import "server-only";
import {
  getActiveConsents,
  type CurrentUser,
  type Profile,
} from "@/lib/auth/dal";
import { assertAiRateLimit } from "@/lib/ai/rate-limit";
import { recordAudioUsage } from "@/lib/ai/usage";
import {
  MAX_RECORDING_SECONDS,
  MAX_WAV_BYTES,
  MIN_RECORDING_SECONDS,
  parseWav,
  TARGET_SAMPLE_RATE,
} from "@/lib/audio/wav";
import { getServerEnv } from "@/lib/env";
import { CONSENT_VERSION } from "@/lib/onboarding/schema";
import { AzureSpeechError, transcribeWithAzure } from "@/lib/speech/azure";
import { SessionError } from "@/lib/sessions/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const SPEECH_PROVIDER = "azure";

export function isSpeechConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION);
}

/**
 * POST /api/audio/transcribe (PRD §9, §10): consent, format, size and
 * duration checks, then Azure fast transcription. The raw audio is only held
 * in memory for the request and never stored (PRD §14 data minimisation);
 * an audio_assets row records metadata (provider, duration) for transparency.
 */
export async function transcribeRecording(
  user: CurrentUser,
  profile: Profile,
  input: { audio: Blob; sessionId: string | null },
) {
  const consents = await getActiveConsents();
  const voice = consents.find((c) => c.consent_type === "voice_processing");
  if (!voice) throw new SessionError("consent_required");
  // Older grants did not name Azure as the subprocessor: ask again.
  if (voice.version !== CONSENT_VERSION) {
    throw new SessionError(
      "consent_required",
      "Ses onayı metni güncellendi (Azure Speech). Ayarlar → Edit'ten tekrar onayla.",
    );
  }

  if (input.audio.size > MAX_WAV_BYTES) {
    throw new SessionError(
      "invalid_request",
      `Kayıt en fazla ${MAX_RECORDING_SECONDS / 60} dakika olabilir.`,
    );
  }
  const bytes = await input.audio.arrayBuffer();
  const wav = parseWav(bytes);
  if (
    !wav ||
    wav.channels !== 1 ||
    wav.bitsPerSample !== 16 ||
    wav.sampleRate !== TARGET_SAMPLE_RATE
  ) {
    throw new SessionError("invalid_request", "Ses formatı desteklenmiyor.");
  }
  if (wav.durationSeconds < MIN_RECORDING_SECONDS) {
    throw new SessionError("no_speech");
  }
  if (wav.durationSeconds > MAX_RECORDING_SECONDS + 1) {
    throw new SessionError(
      "invalid_request",
      `Kayıt en fazla ${MAX_RECORDING_SECONDS / 60} dakika olabilir.`,
    );
  }

  const env = getServerEnv();
  if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) {
    throw new SessionError("voice_not_configured");
  }

  // A session id is only kept if it belongs to this learner (RLS read).
  let sessionId: string | null = null;
  if (input.sessionId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", input.sessionId)
      .maybeSingle();
    sessionId = data?.id ?? null;
  }

  await assertAiRateLimit(user.id);

  let result;
  try {
    result = await transcribeWithAzure({
      key: env.AZURE_SPEECH_KEY,
      region: env.AZURE_SPEECH_REGION,
      endpoint: env.AZURE_SPEECH_ENDPOINT,
      audio: new Blob([bytes], { type: "audio/wav" }),
      locale: profile.dialect === "en-GB" ? "en-GB" : "en-US",
    });
  } catch (error) {
    if (error instanceof AzureSpeechError) {
      console.error("[speech] azure error", error.status, error.code);
      if (error.status === 401 || error.status === 403)
        throw new SessionError("voice_not_configured");
      if (error.status === 429) throw new SessionError("rate_limited");
      throw new SessionError("voice_failed");
    }
    if ((error as Error).name === "TimeoutError")
      throw new SessionError("voice_failed");
    throw error;
  }

  const audioSeconds = result.durationMs
    ? result.durationMs / 1000
    : wav.durationSeconds;
  await Promise.all([
    recordAudioUsage({ userId: user.id, sessionId, audioSeconds }),
    createAdminClient()
      .from("audio_assets")
      .insert({
        user_id: user.id,
        session_id: sessionId,
        provider: SPEECH_PROVIDER,
        storage_path: null,
        mime_type: "audio/wav",
        duration_seconds: Math.round(wav.durationSeconds * 10) / 10,
        // Not stored: the recording was discarded once transcribed.
        deleted_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("[speech] audio metadata", error.code);
      }),
  ]);

  if (!result.text) throw new SessionError("no_speech");
  return {
    transcript: result.text,
    durationSeconds: Math.round(wav.durationSeconds * 10) / 10,
    confidence: result.confidence,
  };
}
