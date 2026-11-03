import "server-only";
import { estimateCostUsd, type TokenUsage } from "@/lib/ai/config";
import { createAdminClient } from "@/lib/supabase/admin";

/** Usage log without any conversation content (PRD §9 logging rule). */
export async function recordUsage(entry: {
  userId: string;
  sessionId: string | null;
  model: string;
  operation: "coach_reply" | "feedback_analysis" | "review_evaluation";
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
