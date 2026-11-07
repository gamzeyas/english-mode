import "server-only";
import { estimateCostUsd, type TokenUsage } from "@/lib/ai/config";
import { createAdminClient } from "@/lib/supabase/admin";

/** Usage log without any conversation content (PRD §9 logging rule). */
export async function recordUsage(entry: {
  userId: string;
  sessionId: string | null;
  model: string;
  operation:
    | "coach_reply"
    | "feedback_analysis"
    | "review_evaluation"
    | "task_feedback"
    | "writing_coach"
    | "assessment"
    | "listening"
    | "translation"
    | "hints";
  usage: TokenUsage;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("ai_usage_logs").insert({
    user_id: entry.userId,
    session_id: entry.sessionId,
    provider: "anthropic",
    model: entry.model,
    operation: entry.operation,
    input_tokens:
      entry.usage.input_tokens +
      (entry.usage.cache_read_input_tokens ?? 0) +
      (entry.usage.cache_creation_input_tokens ?? 0),
    output_tokens: entry.usage.output_tokens,
    estimated_cost_usd: estimateCostUsd(entry.model, entry.usage),
  });
  // Logging must never break the learner's request.
  if (error) console.error("[ai-usage] insert failed", error.code);
}

/** Azure neural text-to-speech list price (USD per million characters). */
const AZURE_TTS_USD_PER_MILLION_CHARS = 15;

/** Text-to-speech usage: billed characters only, never the text. */
export async function recordTtsUsage(entry: {
  userId: string;
  sessionId: string | null;
  characters: number;
}) {
  const { error } = await createAdminClient()
    .from("ai_usage_logs")
    .insert({
      user_id: entry.userId,
      session_id: entry.sessionId,
      provider: "azure",
      model: "neural-tts",
      operation: "speech_synthesis",
      characters: entry.characters,
      estimated_cost_usd:
        (entry.characters / 1_000_000) * AZURE_TTS_USD_PER_MILLION_CHARS,
    });
  if (error) console.error("[ai-usage] tts insert failed", error.code);
}

/**
 * Reported Azure list prices (USD per audio hour): fast transcription, and
 * pronunciation assessment, which is billed like standard speech to text.
 */
const AZURE_AUDIO_USD_PER_HOUR = {
  "fast-transcription": 0.36,
  "pronunciation-assessment": 1,
} as const;

/** Speech-to-text usage: audio seconds only, never the transcript. */
export async function recordAudioUsage(entry: {
  userId: string;
  sessionId: string | null;
  audioSeconds: number;
  model?: keyof typeof AZURE_AUDIO_USD_PER_HOUR;
  operation?: "transcription" | "pronunciation";
}) {
  const model = entry.model ?? "fast-transcription";
  const { error } = await createAdminClient()
    .from("ai_usage_logs")
    .insert({
      user_id: entry.userId,
      session_id: entry.sessionId,
      provider: "azure",
      model,
      operation: entry.operation ?? "transcription",
      audio_seconds: Math.round(entry.audioSeconds * 10) / 10,
      estimated_cost_usd:
        (entry.audioSeconds / 3600) * AZURE_AUDIO_USD_PER_HOUR[model],
    });
  if (error) console.error("[ai-usage] audio insert failed", error.code);
}
