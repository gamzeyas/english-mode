/**
 * Deterministic daily planner (PRD §12). Pure and client-safe: the server
 * feeds it real inputs and stores the result idempotently by `planKey`.
 * Default day: 5 min retrieval + focused conversation + 5 min recap task; a
 * 5-minute day is a single task and still counts.
 */
export type AssignmentKind =
  | "review"
  | "conversation"
  | "roleplay"
  | "rewrite"
  | "interview_answer"
  | "follow_up";

export const kindLabels: Record<AssignmentKind, string> = {
  review: "Review",
  conversation: "Conversation",
  roleplay: "Roleplay",
  rewrite: "Rewrite",
  interview_answer: "Interview answer",
  follow_up: "Follow-up",
};

/** Kinds completed by submitting a written answer. */
export const TEXT_KINDS: ReadonlySet<AssignmentKind> = new Set([
  "rewrite",
  "interview_answer",
  "follow_up",
]);

/** Kinds completed by finishing a conversation session. */
export const SESSION_KINDS: ReadonlySet<AssignmentKind> = new Set([
  "conversation",
  "roleplay",
]);

export type AssignmentPayload = {
  minutes?: number;
  scenarioSlug?: string;
  /** Rewrite: the learner's own sentence, and the improved one for feedback. */
  original?: string;
  reference?: string;
  promptKey?: string;
  swappedFrom?: string;
  swapCount?: number;
};

export type PlannedTask = {
  planKey: string;
  kind: AssignmentKind;
  title: string;
  instructions: string;
  estimatedMinutes: number;
  payload: AssignmentPayload;
};

export type PlannerInput = {
  dayKey: string;
  dailyMinutes: number;
  dueCount: number;
  scenarios: { slug: string; title: string; personaName: string }[];
  /** Scenario slugs, most recently practiced first. */
  recentScenarioSlugs: string[];
  topPattern: { key: string; original: string; improved: string } | null;
};

export const MAX_SWAPS = 3;

export const INTERVIEW_PROMPTS = [
  { key: "proud_project", text: "Tell me about a project you're proud of." },
  { key: "why_role", text: "Why are you interested in working abroad?" },
  {
    key: "difficult_decision",
    text: "Describe a difficult decision you made at work. What did you learn?",
  },
  {
    key: "ai_change",
    text: "How has AI changed the way your team works?",
  },
  {
    key: "five_years",
    text: "Where do you see yourself in five years?",
  },
] as const;

function dayIndex(dayKey: string): number {
  return Math.floor(Date.parse(`${dayKey}T00:00:00Z`) / 86_400_000);
}

/** Least recently practiced scenario first; never-practiced ones lead. */
export function rankScenarios(
  scenarios: PlannerInput["scenarios"],
  recent: string[],
): PlannerInput["scenarios"] {
  const rank = (slug: string) => {
    const index = recent.indexOf(slug);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...scenarios].sort((a, b) => rank(b.slug) - rank(a.slug));
}

function reviewTask(input: PlannerInput): PlannedTask {
  const count = Math.min(input.dueCount, 10);
  return {
    planKey: `${input.dayKey}:review`,
    kind: "review",
    title: `Review ${count} due ${count === 1 ? "phrase" : "phrases"}`,
    instructions:
      "Recall each phrase from its context before revealing it, then grade yourself honestly.",
    estimatedMinutes: 5,
    payload: { minutes: 5 },
  };
}

function conversationTask(
  dayKey: string,
  minutes: number,
  suffix = "main",
): PlannedTask {
  return {
    planKey: `${dayKey}:${suffix}`,
    kind: "conversation",
    title: `${minutes}-minute conversation`,
    instructions:
      "Chat with your coach about something you care about. Try to answer in full sentences and ask one question back.",
    estimatedMinutes: minutes,
    payload: { minutes },
  };
}

function roleplayTask(
  dayKey: string,
  minutes: number,
  scenario: PlannerInput["scenarios"][number],
  suffix = "main",
): PlannedTask {
  return {
    planKey: `${dayKey}:${suffix}`,
    kind: "roleplay",
    title: `Roleplay: ${scenario.title}`,
    instructions: `Practice with ${scenario.personaName}. Aim for the scenario goals, then read the debrief.`,
    estimatedMinutes: minutes,
    payload: { minutes, scenarioSlug: scenario.slug },
  };
}

function rewriteTask(
  dayKey: string,
  pattern: NonNullable<PlannerInput["topPattern"]>,
): PlannedTask {
  return {
    planKey: `${dayKey}:recap`,
    kind: "rewrite",
    title: "Rewrite one of your sentences",
    instructions: `Rewrite this sentence from an earlier session so it sounds natural, then use the same pattern in one new sentence of your own:\n“${pattern.original}”`,
    estimatedMinutes: 5,
    payload: {
      original: pattern.original,
      reference: pattern.improved,
      promptKey: pattern.key,
    },
  };
}

function interviewTask(
  dayKey: string,
  offset: number,
  suffix = "recap",
): PlannedTask {
  const prompt =
    INTERVIEW_PROMPTS[
      (((dayIndex(dayKey) + offset) % INTERVIEW_PROMPTS.length) +
        INTERVIEW_PROMPTS.length) %
        INTERVIEW_PROMPTS.length
    ];
  return {
    planKey: `${dayKey}:${suffix}`,
    kind: "interview_answer",
    title: "Write an interview answer",
    instructions: `Answer in 4–6 sentences, with one concrete example:\n“${prompt.text}”`,
    estimatedMinutes: 5,
    payload: { promptKey: prompt.key },
  };
}

/** The main practice slot alternates free chat and roleplay day by day. */
function mainTask(input: PlannerInput, minutes: number): PlannedTask {
  const [scenario] = rankScenarios(input.scenarios, input.recentScenarioSlugs);
  const roleplayDay = dayIndex(input.dayKey) % 2 === 0;
  const fits = scenario && minutes >= 10;
  return fits && roleplayDay
    ? roleplayTask(input.dayKey, minutes, scenario)
    : conversationTask(input.dayKey, minutes);
}

export function planDay(input: PlannerInput): PlannedTask[] {
  const budget = [5, 15, 25, 30].includes(input.dailyMinutes)
    ? input.dailyMinutes
    : 15;
  const hasDue = input.dueCount > 0;

  if (budget === 5) {
    return [hasDue ? reviewTask(input) : conversationTask(input.dayKey, 5)];
  }

  const tasks: PlannedTask[] = [];
  if (hasDue) tasks.push(reviewTask(input));
  const recap = budget >= 25;
  const mainMinutes = budget - (hasDue ? 5 : 0) - (recap ? 5 : 0);
  tasks.push(mainTask(input, mainMinutes));
  if (recap) {
    tasks.push(
      input.topPattern
        ? rewriteTask(input.dayKey, input.topPattern)
        : interviewTask(input.dayKey, 0),
    );
  }
  return tasks;
}

/**
 * A different task of similar size for "swap" (PRD §12). Reviews cannot be
 * swapped: they are skipped or rescheduled instead.
 */
export function alternativeFor(
  task: {
    kind: AssignmentKind;
    planKey: string;
    estimatedMinutes: number;
    payload: AssignmentPayload;
  },
  input: Pick<PlannerInput, "dayKey" | "scenarios" | "recentScenarioSlugs">,
): PlannedTask | null {
  const attempt = (task.payload.swapCount ?? 0) + 1;
  if (attempt > MAX_SWAPS) return null;
  const base = task.planKey.replace(/~\d+$/, "");
  const [prefix, ...rest] = base.split(":");
  const suffix = `${rest.join(":")}~${attempt}`;
  const minutes = task.estimatedMinutes;
  const ranked = rankScenarios(input.scenarios, input.recentScenarioSlugs);

  let next: PlannedTask | null = null;
  switch (task.kind) {
    case "review":
      return null;
    case "conversation": {
      const scenario = ranked[0];
      next = scenario
        ? roleplayTask(input.dayKey, Math.max(minutes, 5), scenario, suffix)
        : null;
      break;
    }
    case "roleplay": {
      const others = ranked.filter((s) => s.slug !== task.payload.scenarioSlug);
      next =
        attempt % 2 === 1 || others.length === 0
          ? conversationTask(input.dayKey, minutes, suffix)
          : roleplayTask(
              input.dayKey,
              minutes,
              others[attempt % others.length],
              suffix,
            );
      break;
    }
    case "rewrite":
    case "follow_up":
      next = interviewTask(input.dayKey, attempt, suffix);
      break;
    case "interview_answer":
      next = interviewTask(input.dayKey, attempt + 1, suffix);
      break;
  }
  if (!next) return null;
  return {
    ...next,
    planKey: `${prefix}:${suffix}`,
    payload: {
      ...next.payload,
      swappedFrom: task.planKey,
      swapCount: attempt,
    },
  };
}
