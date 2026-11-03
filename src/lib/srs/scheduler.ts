import { DefaultScheduler, State } from "ts-fsrs";
import type { Grade } from "@/lib/srs/grades";
import type { LearningItemStatus } from "@/types/domain";

export type { Grade } from "@/lib/srs/grades";

/**
 * FSRS scheduling (ts-fsrs 6, FSRS-7 model). Cards are stored as JSON in
 * learning_items.fsrs_state; the scheduler alone decides due dates (PRD §7:
 * no hardcoded intervals). The learner's explicit grade is authoritative.
 */

// Pinned explicitly: a model change requires replaying history (ts-fsrs v6 guide).
const createScheduler = () =>
  DefaultScheduler({
    version: "FSRS-7",
    desiredRetention: 0.9,
    enableFuzz: true,
  });

type Scheduler = Awaited<ReturnType<typeof createScheduler>>;
export type FsrsCard = ReturnType<Scheduler["newCard"]>;

/** "mastered" is only a UI label (PRD §7); FSRS state stays authoritative. */
export const MASTERED_STABILITY_DAYS = 21;

let schedulerPromise: Promise<Scheduler> | null = null;

export function getScheduler(): Promise<Scheduler> {
  schedulerPromise ??= createScheduler();
  return schedulerPromise;
}

/** JSON round-trips turn Dates into strings; the scheduler needs real Dates. */
export function reviveCard(stored: unknown): FsrsCard {
  const card = stored as Record<string, unknown>;
  return {
    ...card,
    dueAt: new Date(card.dueAt as string),
    lastReviewAt: card.lastReviewAt
      ? new Date(card.lastReviewAt as string)
      : null,
  } as FsrsCard;
}

export function serializeCard(card: FsrsCard): Record<string, unknown> {
  return JSON.parse(JSON.stringify(card)) as Record<string, unknown>;
}

export function statusForCard(
  card: Pick<FsrsCard, "state" | "stability">,
): LearningItemStatus {
  if (card.state === State.New) return "new";
  if (card.state === State.Learning || card.state === State.Relearning)
    return "learning";
  return card.stability >= MASTERED_STABILITY_DAYS ? "mastered" : "review";
}

export async function scheduleReview(
  storedState: unknown | null,
  grade: Grade,
  now: Date,
) {
  const scheduler = await getScheduler();
  const previous = storedState
    ? reviveCard(storedState)
    : scheduler.newCard({ now });
  const { card } = scheduler.review({ card: previous, grade, now });
  return {
    previous,
    next: card,
    dueAt: card.dueAt,
    status: statusForCard(card),
  };
}

/** Due date per grade, for the labels under the grade buttons. */
export async function previewDueDates(storedState: unknown | null, now: Date) {
  const scheduler = await getScheduler();
  const card = storedState
    ? reviveCard(storedState)
    : scheduler.newCard({ now });
  const result: Record<Grade, string> = { 1: "", 2: "", 3: "", 4: "" };
  for (const { grade, card: next } of scheduler.preview({ card, now })) {
    result[grade as Grade] = next.dueAt.toISOString();
  }
  return result;
}
