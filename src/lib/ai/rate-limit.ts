import "server-only";
import { AI_RATE_LIMITS, exceedsLimit } from "@/lib/ai/config";
import { SessionError } from "@/lib/sessions/errors";
import { createAdminClient } from "@/lib/supabase/admin";

/** Rejects a Claude call when a burst window is full (see AI_RATE_LIMITS). */
export async function assertAiRateLimit(userId: string) {
  const admin = createAdminClient();
  const now = Date.now();
  const counts = await Promise.all(
    AI_RATE_LIMITS.map(async ({ windowMs }) => {
      const { count, error } = await admin
        .from("ai_usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", new Date(now - windowMs).toISOString());
      // Fail open on a logging read error: it must not block learning.
      return error ? 0 : (count ?? 0);
    }),
  );
  if (exceedsLimit(counts)) throw new SessionError("rate_limited");
}
