import "server-only";
import { getCurrentUser } from "@/lib/auth/dal";
import { localDayKey } from "@/lib/learning/day";
import { createClient } from "@/lib/supabase/server";

/** Below this many reviews a rate is shown with a small-sample warning. */
export const MIN_SAMPLE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Informal coaching metrics derived only from real activity (PRD §11):
 * counts with evidence, no invented scores or percentage-point claims.
 */
export async function getProgressStats(timeZone: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const now = Date.now();
  const since28 = new Date(now - 28 * DAY_MS).toISOString();
  const since7 = now - 7 * DAY_MS;

  const [
    reviews,
    sessions,
    items,
    patterns,
    assignments,
    words,
    writing,
    submissions,
    assessments,
  ] = await Promise.all([
    supabase
      .from("review_logs")
      .select("grade, reviewed_at")
      .eq("user_id", user.id)
      .gte("reviewed_at", since28),
    supabase
      .from("sessions")
      .select("started_at, status, scenario_id")
      .eq("user_id", user.id)
      .gte("started_at", since28),
    supabase.from("learning_items").select("status").eq("user_id", user.id),
    supabase
      .from("error_patterns")
      .select(
        "pattern_key, category, explanation_tr, occurrence_count, last_seen_at, evidence",
      )
      .eq("user_id", user.id)
      .order("occurrence_count", { ascending: false })
      .limit(5),
    supabase
      .from("assignments")
      .select("status")
      .eq("user_id", user.id)
      .gte("scheduled_for", since28.slice(0, 10)),
    supabase
      .from("messages")
      .select("content")
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", since28),
    supabase
      .from("writing_entries")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", since28),
    supabase
      .from("submissions")
      .select("submitted_at")
      .eq("user_id", user.id)
      .gte("submitted_at", since28),
    supabase
      .from("assessments")
      .select("kind, created_at, estimated_level")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const reviewRows = reviews.data ?? [];
  const sessionRows = sessions.data ?? [];
  const statusCounts: Record<string, number> = {};
  for (const row of items.data ?? []) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  }
  const activeDays = (fromMs: number) =>
    new Set(
      [
        ...sessionRows.map((s) => s.started_at),
        ...reviewRows.map((r) => r.reviewed_at),
        ...(writing.data ?? []).map((w) => w.created_at),
        ...(submissions.data ?? []).map((s) => s.submitted_at),
      ]
        .filter((iso) => Date.parse(iso) >= fromMs)
        .map((iso) => localDayKey(iso, timeZone)),
    ).size;

  const successful = reviewRows.filter((r) => r.grade >= 3).length;
  const assignmentRows = assignments.data ?? [];
  const utterances = words.data ?? [];

  return {
    activeDays7: activeDays(since7),
    activeDays28: activeDays(now - 28 * DAY_MS),
    sessionsCompleted28: sessionRows.filter((s) => s.status === "completed")
      .length,
    roleplays28: sessionRows.filter(
      (s) => s.status === "completed" && s.scenario_id !== null,
    ).length,
    learnerUtterances28: utterances.length,
    learnerWords28: utterances.reduce(
      (sum, m) => sum + m.content.trim().split(/\s+/).filter(Boolean).length,
      0,
    ),
    assignmentsCompleted28: assignmentRows.filter(
      (a) => a.status === "completed",
    ).length,
    assignmentsSkipped28: assignmentRows.filter((a) => a.status === "skipped")
      .length,
    writingEntries28: (writing.data ?? []).length,
    assessments: (assessments.data ?? []).map((a) => ({
      kind: a.kind,
      createdAt: a.created_at,
      estimatedLevel: a.estimated_level,
    })),
    reviews7: reviewRows.filter((r) => Date.parse(r.reviewed_at) >= since7)
      .length,
    reviews28: reviewRows.length,
    successfulRetrievals28: successful,
    recallRate28: reviewRows.length > 0 ? successful / reviewRows.length : null,
    statusCounts,
    patterns: (patterns.data ?? []).map((p) => {
      const evidence = Array.isArray(p.evidence) ? p.evidence : [];
      const last = evidence.at(-1) as
        { original?: string; improved?: string } | undefined;
      return {
        key: p.pattern_key,
        category: p.category,
        explanationTr: p.explanation_tr,
        occurrences: p.occurrence_count,
        lastSeenAt: p.last_seen_at,
        example:
          last?.original && last?.improved
            ? { original: last.original, improved: last.improved }
            : null,
      };
    }),
  };
}
