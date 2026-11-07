import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const OPERATION_LABELS: Record<string, string> = {
  coach_reply: "Coach replies",
  feedback_analysis: "Session feedback",
  review_evaluation: "Review checks",
  task_feedback: "Task feedback",
  writing_coach: "Writing coach",
  assessment: "Assessments",
  listening: "Listening material",
  translation: "Translations",
  hints: "Hints",
  transcription: "Voice transcription",
  speech_synthesis: "Text to speech",
  pronunciation: "Pronunciation checks",
};

/**
 * Estimated spend from the learner's own usage log (PRD M8 cost monitoring).
 * Estimates use list prices; the provider invoice is authoritative. There is
 * deliberately no spending cap — this is visibility only.
 */
export async function getUsageSummary(user: CurrentUser, now = new Date()) {
  const supabase = await createClient();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
  const { data, error } = await supabase
    .from("ai_usage_logs")
    .select("provider, operation, estimated_cost_usd, created_at")
    .eq("user_id", user.id)
    .gte("created_at", monthStart);
  if (error) throw error;

  const byProvider = new Map<string, number>();
  const byOperation = new Map<string, { cost: number; calls: number }>();
  for (const row of data) {
    const cost = Number(row.estimated_cost_usd ?? 0);
    byProvider.set(row.provider, (byProvider.get(row.provider) ?? 0) + cost);
    const op = byOperation.get(row.operation) ?? { cost: 0, calls: 0 };
    op.cost += cost;
    op.calls += 1;
    byOperation.set(row.operation, op);
  }
  const total = [...byProvider.values()].reduce((a, b) => a + b, 0);
  const day = Math.max(1, now.getUTCDate());
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();

  return {
    month: monthStart.slice(0, 7),
    total,
    /** Straight-line projection of this month's pace. */
    projected: (total / day) * daysInMonth,
    calls: data.length,
    providers: [...byProvider]
      .map(([provider, cost]) => ({
        provider:
          provider === "anthropic" ? "Claude (Anthropic)" : "Azure Speech",
        cost,
      }))
      .sort((a, b) => b.cost - a.cost),
    operations: [...byOperation]
      .map(([operation, v]) => ({
        label: OPERATION_LABELS[operation] ?? operation,
        ...v,
      }))
      .sort((a, b) => b.cost - a.cost),
  };
}
