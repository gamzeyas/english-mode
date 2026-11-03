import "server-only";
import { getCurrentUser } from "@/lib/auth/dal";
import { localDayKey } from "@/lib/learning/day";
import { toLearningItem } from "@/lib/learning/map";
import { createClient } from "@/lib/supabase/server";
import type { LearningItem } from "@/types/domain";

/** The learner's pool incl. archived items (RLS-scoped), newest first. */
export async function getLearningItems(): Promise<LearningItem[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learning_items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error)
    throw new Error("Learning items could not be loaded.", { cause: error });

  return data.map(toLearningItem);
}

/** Honest, non-punitive weekly numbers derived from real sessions. */
export async function getWeeklyStats(timeZone: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: sessions }, { count: saved }] = await Promise.all([
    supabase
      .from("sessions")
      .select("started_at, status")
      .eq("user_id", user.id)
      .gte("started_at", since),
    supabase
      .from("learning_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["new", "learning", "review", "mastered"]),
  ]);
  const list = sessions ?? [];
  return {
    activeDays: new Set(list.map((s) => localDayKey(s.started_at, timeZone)))
      .size,
    sessionsCompleted: list.filter((s) => s.status === "completed").length,
    savedPhrases: saved ?? 0,
  };
}
