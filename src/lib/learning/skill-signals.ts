import "server-only";
import { choosePracticeSet, setOf } from "@/lib/pronunciation/next-set";
import { daysBetween, type SkillSignals } from "@/lib/learning/skills";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
const DAY_MS = 86_400_000;

/** Real activity per skill over the last four weeks (see rankFocus). */
export async function loadSkillSignals(
  supabase: Supabase,
  userId: string,
  now = Date.now(),
) {
  const since28 = new Date(now - 28 * DAY_MS).toISOString();
  const since7 = new Date(now - 7 * DAY_MS).toISOString();
  const [sessions, listening, pronunciation, due, writing] = await Promise.all([
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("started_at", since7),
    supabase
      .from("listening_exercises")
      .select("score, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .gte("completed_at", since28)
      .order("completed_at", { ascending: false }),
    supabase
      .from("pronunciation_attempts")
      .select("pron_score, source, source_ref, created_at")
      .eq("user_id", userId)
      .gte("created_at", since28)
      .order("created_at", { ascending: false }),
    supabase
      .from("learning_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["new", "learning", "review", "mastered"])
      .lte("due_at", new Date(now).toISOString()),
    supabase
      .from("writing_entries")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", since28)
      .order("created_at", { ascending: false }),
  ]);

  const listened = listening.data ?? [];
  const spoken = pronunciation.data ?? [];
  const written = writing.data ?? [];
  const average = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  // Recent work reflects the current level best: average the last ten.
  const listeningScores = listened
    .map((r) => r.score)
    .filter((s): s is number => s !== null)
    .slice(0, 10);
  const pronScores = spoken
    .map((r) => r.pron_score)
    .filter((s): s is number => s !== null)
    .slice(0, 10);

  const signals: SkillSignals = {
    speaking: { sessions7: sessions.count ?? 0 },
    listening: {
      done28: listened.length,
      avgScore: average(listeningScores),
      daysSinceLast: daysBetween(listened[0]?.completed_at ?? null, now),
    },
    pronunciation: {
      attempts28: spoken.length,
      avgScore: average(pronScores),
      daysSinceLast: daysBetween(spoken[0]?.created_at ?? null, now),
    },
    vocabulary: { due: due.count ?? 0 },
    writing: {
      entries28: written.length,
      daysSinceLast: daysBetween(written[0]?.created_at ?? null, now),
    },
  };
  const pronunciationSet = choosePracticeSet(
    spoken.map((r) => ({
      setSlug: r.source === "catalog" ? setOf(r.source_ref) : null,
      score: r.pron_score,
      at: r.created_at,
    })),
  );
  return { signals, pronunciationSet };
}
