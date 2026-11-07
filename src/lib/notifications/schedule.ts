/**
 * Reminder timing (PRD Milestone 8: configurable reminders, scheduling
 * personalization). Pure and time-zone aware, so the scheduler and the
 * settings screen agree on when a reminder is due.
 */

export type LocalClock = {
  /** Learner-local calendar day, YYYY-MM-DD. */
  date: string;
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function localClock(now: Date, timeZone: string): LocalClock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY_INDEX[parts.weekday],
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** "HH:MM" or Postgres "HH:MM:SS" → minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * A reminder that could not be sent within this window (scheduler down,
 * phone off) is dropped rather than arriving hours late.
 */
export const LATE_WINDOW_MINUTES = 180;

export type ReminderRule = {
  reminderTime: string;
  weekdays: number[];
  lastRemindedOn: string | null;
};

export function isReminderDue(rule: ReminderRule, clock: LocalClock) {
  const at = timeToMinutes(rule.reminderTime);
  return (
    rule.weekdays.includes(clock.weekday) &&
    rule.lastRemindedOn !== clock.date &&
    clock.minutes >= at &&
    clock.minutes < at + LATE_WINDOW_MINUTES
  );
}

/** Suggested time per part of day (see DAYPARTS_TR in skill-progress). */
const DAYPART_TIMES = ["08:30", "12:30", "20:00", "22:00"] as const;
/** Fewer activities than this say nothing reliable about a routine. */
export const MIN_ACTIVITY_FOR_SUGGESTION = 5;

/**
 * Suggests a reminder time from when the learner actually practises: the
 * start of their busiest part of the day. Null without enough history.
 */
export function suggestReminderTime(dayparts: number[]) {
  const total = dayparts.reduce((a, b) => a + b, 0);
  if (total < MIN_ACTIVITY_FOR_SUGGESTION) return null;
  const best = dayparts.indexOf(Math.max(...dayparts));
  return { daypart: best, time: DAYPART_TIMES[best], count: dayparts[best] };
}

export type ReminderContext = {
  pendingTasks: number;
  pendingMinutes: number;
  dueReviews: number;
};

/** Notification text built only from the learner's real plan. */
export function reminderMessage({
  pendingTasks,
  pendingMinutes,
  dueReviews,
}: ReminderContext) {
  const title = "English Mode";
  if (pendingTasks > 0) {
    const reviews =
      dueReviews > 0 ? ` ${dueReviews} ifade tekrar bekliyor.` : "";
    return {
      title,
      body: `Bugünkü planın hazır: ${pendingTasks} görev, yaklaşık ${pendingMinutes} dk.${reviews}`,
      url: "/dashboard",
    };
  }
  if (dueReviews > 0) {
    return {
      title,
      body: `${dueReviews} ifade tekrar bekliyor. Birkaç dakikalık tekrar yapalım mı?`,
      url: "/review",
    };
  }
  return {
    title,
    body: "Bugün 5 dakikalık kısa bir İngilizce pratiği yapalım mı?",
    url: "/dashboard",
  };
}
