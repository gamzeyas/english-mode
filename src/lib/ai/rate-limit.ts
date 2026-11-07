import "server-only";
import {
  AI_RATE_LIMITS,
  exceedsLimit,
  SPEECH_RATE_LIMITS,
} from "@/lib/ai/config";
import { SessionError } from "@/lib/sessions/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const LIMITS = { anthropic: AI_RATE_LIMITS, azure: SPEECH_RATE_LIMITS };

/**
 * Rejects a provider call when one of its burst windows is full. Claude and
 * Azure speech are counted separately (see AI_RATE_LIMITS and
 * SPEECH_RATE_LIMITS).
 */
export async function assertAiRateLimit(
  userId: string,
  provider: keyof typeof LIMITS = "anthropic",
) {
  const limits = LIMITS[provider];
  const admin = createAdminClient();
  const now = Date.now();
  const counts = await Promise.all(
    limits.map(async ({ windowMs }) => {
      const { count, error } = await admin
        .from("ai_usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("provider", provider)
        .gte("created_at", new Date(now - windowMs).toISOString());
      // Fail open on a logging read error: it must not block learning.
      return error ? 0 : (count ?? 0);
    }),
  );
  if (exceedsLimit(counts, limits)) throw new SessionError("rate_limited");
}
