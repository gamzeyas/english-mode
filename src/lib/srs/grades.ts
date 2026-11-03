/**
 * Grade constants shared by server and client (no ts-fsrs import, so the
 * scheduler stays out of the browser bundle). Values match ts-fsrs Rating.
 */
export type Grade = 1 | 2 | 3 | 4;

export const GRADES = [
  { value: 1, label: "Again" },
  { value: 2, label: "Hard" },
  { value: 3, label: "Good" },
  { value: 4, label: "Easy" },
] as const satisfies readonly { value: Grade; label: string }[];

/** Compact human interval ("1m", "10m", "5d", "3mo") between now and a due date. */
export function formatInterval(fromIso: string, toIso: string): string {
  const minutes = Math.max(
    1,
    Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000),
  );
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days}d`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months}mo` : `${Math.round(days / 365)}y`;
}
