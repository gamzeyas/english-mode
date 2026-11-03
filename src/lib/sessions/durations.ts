/** Session lengths a learner can pick (free chat and roleplays). */
export const SESSION_MINUTES = [5, 10, 15, 20, 25, 30] as const;
export type SessionMinutes = (typeof SESSION_MINUTES)[number];

export function isSessionMinutes(value: number): value is SessionMinutes {
  return (SESSION_MINUTES as readonly number[]).includes(value);
}
