import { PRACTICE_SETS } from "@/lib/pronunciation/catalog";

/** "th-3" → "th"; keys are `${setSlug}-${n}`. */
export const setOf = (key: string | null) => key?.replace(/-\d+$/, "") ?? null;

/**
 * Practice set to suggest next: the weakest set the learner scored under 85
 * on, else one never tried, else the one tried longest ago.
 */
export function choosePracticeSet(
  attempts: { setSlug: string | null; score: number | null; at: string }[],
): { slug: string; title: string } {
  const stats = new Map<string, { sum: number; n: number; last: number }>();
  for (const a of attempts) {
    if (!a.setSlug || a.score === null) continue;
    const s = stats.get(a.setSlug) ?? { sum: 0, n: 0, last: 0 };
    s.sum += a.score;
    s.n += 1;
    s.last = Math.max(s.last, Date.parse(a.at));
    stats.set(a.setSlug, s);
  }
  const known = PRACTICE_SETS.filter((set) => stats.has(set.slug));
  const weakest = known
    .map((set) => ({
      set,
      avg: stats.get(set.slug)!.sum / stats.get(set.slug)!.n,
    }))
    .filter((x) => x.avg < 85)
    .sort((a, b) => a.avg - b.avg)[0];
  const untried = PRACTICE_SETS.find((set) => !stats.has(set.slug));
  const oldest = [...known].sort(
    (a, b) => stats.get(a.slug)!.last - stats.get(b.slug)!.last,
  )[0];
  const set = weakest?.set ?? untried ?? oldest ?? PRACTICE_SETS[0];
  return { slug: set.slug, title: set.title };
}
