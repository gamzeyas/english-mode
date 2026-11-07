/**
 * Pure aggregations for the Progress page's listening, pronunciation and
 * activity sections. Everything is derived from stored results; nothing is
 * estimated.
 */
import type { PronunciationResult } from "@/lib/speech/pronunciation";

/** A sound needs this many scored occurrences before it is reported. */
export const MIN_SOUND_SAMPLES = 3;

export type SoundStat = { phoneme: string; average: number; samples: number };

/** Sounds with the lowest average accuracy across read-aloud attempts. */
export function weakestSounds(
  results: (PronunciationResult | null)[],
  limit = 5,
): SoundStat[] {
  const totals = new Map<string, { sum: number; n: number }>();
  for (const result of results) {
    for (const word of result?.words ?? []) {
      // Inserted words were not part of the target; omissions have no sounds.
      if (word.errorType === "Insertion") continue;
      for (const { phoneme, accuracy } of word.phonemes) {
        if (!phoneme) continue;
        const t = totals.get(phoneme) ?? { sum: 0, n: 0 };
        t.sum += accuracy;
        t.n += 1;
        totals.set(phoneme, t);
      }
    }
  }
  return [...totals]
    .filter(([, t]) => t.n >= MIN_SOUND_SAMPLES)
    .map(([phoneme, t]) => ({
      phoneme,
      average: Math.round((t.sum / t.n) * 10) / 10,
      samples: t.n,
    }))
    .filter((s) => s.average < 80)
    .sort((a, b) => a.average - b.average)
    .slice(0, limit);
}

export const WEEKDAYS_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
export const DAYPARTS_TR = ["Sabah", "Öğle", "Akşam", "Gece"] as const;

/** 05–11 morning, 12–16 midday, 17–21 evening, otherwise night. */
const daypart = (hour: number) =>
  hour < 5 ? 3 : hour < 12 ? 0 : hour < 17 ? 1 : hour < 22 ? 2 : 3;

/** Activity counts by local weekday (Mon first) and part of day. */
export function activityPattern(timestamps: string[], timeZone: string) {
  const weekdays = new Array<number>(7).fill(0);
  const dayparts = new Array<number>(4).fill(0);
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  });
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  for (const iso of timestamps) {
    const parts = format.formatToParts(new Date(iso));
    const day = order.indexOf(parts.find((p) => p.type === "weekday")!.value);
    const hour = Number(parts.find((p) => p.type === "hour")!.value);
    if (day >= 0) weekdays[day] += 1;
    dayparts[daypart(hour)] += 1;
  }
  return { weekdays, dayparts };
}
