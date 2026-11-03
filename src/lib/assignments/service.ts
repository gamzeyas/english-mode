import "server-only";
import type { CurrentUser, Profile } from "@/lib/auth/dal";
import {
  taskFeedbackSchema,
  validateTaskFeedback,
  type TaskFeedback,
} from "@/lib/ai/analysis/writing";
import {
  TASK_FEEDBACK_PROMPT,
  TASK_FEEDBACK_VERSION,
} from "@/lib/ai/prompts/writing";
import { runStructured } from "@/lib/ai/structured";
import {
  alternativeFor,
  planDay,
  SESSION_KINDS,
  TEXT_KINDS,
  type AssignmentKind,
  type AssignmentPayload,
  type PlannedTask,
  type PlannerInput,
} from "@/lib/assignments/planner";
import { localDayKey, startOfLocalDay } from "@/lib/learning/day";
import { listScenarios } from "@/lib/scenarios/queries";
import { SessionError } from "@/lib/sessions/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/types/database";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type AssignmentRow = Tables<"assignments">;
type SubmissionRow = Tables<"submissions">;

/** Days of finished/skipped tasks shown in the history list. */
const HISTORY_DAYS = 14;

export type StoredTaskFeedback = TaskFeedback & { version: string };

export type AssignmentView = {
  id: string;
  kind: AssignmentKind;
  title: string;
  instructions: string;
  estimatedMinutes: number;
  status: "pending" | "completed" | "skipped";
  scheduledFor: string;
  /** Where the task is done; null for written tasks answered inline. */
  href: string | null;
  canSwap: boolean;
  submission: {
    answerText: string | null;
    sessionId: string | null;
    feedback: StoredTaskFeedback | null;
    submittedAt: string;
  } | null;
};

export function addDays(dayKey: string, days: number): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayKey(profile: Profile, now = new Date()): string {
  return localDayKey(now.toISOString(), profile.timezone);
}

function hrefFor(row: AssignmentRow): string | null {
  const payload = row.payload as AssignmentPayload;
  switch (row.kind as AssignmentKind) {
    case "review":
      return "/review";
    case "conversation":
      return `/conversation/new?assignment=${row.id}&minutes=${payload.minutes ?? row.estimated_minutes}`;
    case "roleplay":
      return payload.scenarioSlug
        ? `/scenarios/${payload.scenarioSlug}?assignment=${row.id}`
        : `/conversation/new?assignment=${row.id}`;
    default:
      return null;
  }
}

function toView(
  row: AssignmentRow,
  submission: SubmissionRow | undefined,
): AssignmentView {
  const payload = row.payload as AssignmentPayload;
  return {
    id: row.id,
    kind: row.kind as AssignmentKind,
    title: row.title,
    instructions: row.instructions,
    estimatedMinutes: row.estimated_minutes,
    status: row.status as AssignmentView["status"],
    scheduledFor: row.scheduled_for,
    href: hrefFor(row),
    canSwap:
      row.status === "pending" &&
      row.kind !== "review" &&
      (payload.swapCount ?? 0) < 3,
    submission: submission
      ? {
          answerText: submission.answer_text,
          sessionId: submission.session_id,
          feedback: submission.feedback as StoredTaskFeedback | null,
          submittedAt: submission.submitted_at,
        }
      : null,
  };
}

function toInsert(userId: string, dayKey: string, task: PlannedTask) {
  return {
    user_id: userId,
    plan_key: task.planKey,
    kind: task.kind,
    title: task.title,
    instructions: task.instructions,
    estimated_minutes: task.estimatedMinutes,
    scheduled_for: dayKey,
    payload: task.payload as NonNullable<Json>,
  };
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

async function plannerInput(
  supabase: Supabase,
  user: CurrentUser,
  profile: Profile,
  dayKey: string,
): Promise<PlannerInput> {
  const [scenarios, due, recent, pattern] = await Promise.all([
    listScenarios(),
    supabase
      .from("learning_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["new", "learning", "review", "mastered"])
      .lte("due_at", new Date().toISOString()),
    supabase
      .from("sessions")
      .select("scenario_id")
      .eq("user_id", user.id)
      .not("scenario_id", "is", null)
      .order("started_at", { ascending: false })
      .limit(20),
    supabase
      .from("error_patterns")
      .select("pattern_key, evidence")
      .eq("user_id", user.id)
      .order("occurrence_count", { ascending: false })
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const slugById = new Map(scenarios.map((s) => [s.id, s.slug]));
  const recentSlugs = [
    ...new Set(
      (recent.data ?? [])
        .map((row) => slugById.get(row.scenario_id as string))
        .filter((slug): slug is string => Boolean(slug)),
    ),
  ];
  const evidence = Array.isArray(pattern.data?.evidence)
    ? pattern.data.evidence
    : [];
  const last = evidence.at(-1) as
    { original?: string; improved?: string } | undefined;

  return {
    dayKey,
    dailyMinutes: profile.daily_minutes,
    dueCount: due.count ?? 0,
    scenarios: scenarios.map((s) => ({
      slug: s.slug,
      title: s.title,
      personaName: s.persona.name,
    })),
    recentScenarioSlugs: recentSlugs,
    topPattern:
      pattern.data && last?.original && last.improved
        ? {
            key: pattern.data.pattern_key,
            original: last.original,
            improved: last.improved,
          }
        : null,
  };
}

/**
 * Creates today's plan once per learner-local day. Safe to call on every
 * render: generated rows are keyed by `plan_key`, so retries and concurrent
 * requests never duplicate a task.
 */
export async function ensureDayPlan(user: CurrentUser, profile: Profile) {
  const supabase = await createClient();
  const dayKey = todayKey(profile);
  const { data: existing } = await supabase
    .from("assignments")
    .select("id")
    .eq("user_id", user.id)
    .like("plan_key", `${dayKey}:%`)
    .limit(1);
  if (existing && existing.length > 0) return;

  const tasks = planDay(await plannerInput(supabase, user, profile, dayKey));
  const { error } = await supabase.from("assignments").upsert(
    tasks.map((task) => toInsert(user.id, dayKey, task)),
    { onConflict: "user_id,plan_key", ignoreDuplicates: true },
  );
  if (error) throw new Error("Day plan could not be saved.", { cause: error });
}

/** One follow-up task from a session's feedback (PRD §5 F2 "one suggested homework"). */
export async function createFollowUp(
  supabase: Supabase,
  user: CurrentUser,
  profile: Profile,
  sessionId: string,
  task: { title: string; instructions: string; estimated_minutes: number },
) {
  const { error } = await supabase.from("assignments").upsert(
    {
      user_id: user.id,
      plan_key: `session:${sessionId}`,
      kind: "follow_up",
      title: task.title.slice(0, 200),
      instructions: task.instructions.slice(0, 2000),
      estimated_minutes: Math.min(30, Math.max(5, task.estimated_minutes)),
      scheduled_for: todayKey(profile),
      source_session_id: sessionId,
      payload: {},
    },
    { onConflict: "user_id,plan_key", ignoreDuplicates: true },
  );
  if (error)
    throw new Error("Follow-up task could not be saved.", { cause: error });
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type AssignmentsOverview = {
  dayKey: string;
  today: AssignmentView[];
  overdue: AssignmentView[];
  upcoming: AssignmentView[];
  history: AssignmentView[];
};

export async function getAssignmentsOverview(
  user: CurrentUser,
  profile: Profile,
): Promise<AssignmentsOverview> {
  await ensureDayPlan(user, profile);
  const supabase = await createClient();
  const dayKey = todayKey(profile);

  const { data: rows, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("user_id", user.id)
    .gte("scheduled_for", addDays(dayKey, -HISTORY_DAYS))
    .order("scheduled_for", { ascending: true })
    .order("created_at", { ascending: true });
  if (error)
    throw new Error("Assignments could not be loaded.", { cause: error });

  const ids = rows.map((row) => row.id);
  const { data: submissions } = ids.length
    ? await supabase.from("submissions").select("*").in("assignment_id", ids)
    : { data: [] as SubmissionRow[] };
  const byAssignment = new Map(
    (submissions ?? []).map((s) => [s.assignment_id, s]),
  );
  const views = rows.map((row) => toView(row, byAssignment.get(row.id)));
  // A swapped-away task is replaced by its alternative; hide it from "Today".
  const swappedAway = new Set(
    rows
      .map((row) => (row.payload as AssignmentPayload).swappedFrom)
      .filter(Boolean),
  );
  const visible = (view: AssignmentView, row: AssignmentRow) =>
    !(view.status === "skipped" && swappedAway.has(row.plan_key ?? ""));

  const today: AssignmentView[] = [];
  const overdue: AssignmentView[] = [];
  const upcoming: AssignmentView[] = [];
  const history: AssignmentView[] = [];
  views.forEach((view, index) => {
    const row = rows[index];
    if (view.scheduledFor === dayKey) {
      if (visible(view, row)) today.push(view);
    } else if (view.scheduledFor > dayKey) {
      upcoming.push(view);
    } else if (view.status === "pending") {
      overdue.push(view);
    } else if (visible(view, row)) {
      history.push(view);
    }
  });
  history.reverse();
  return { dayKey, today, overdue, upcoming, history };
}

async function loadAssignment(supabase: Supabase, id: string) {
  const { data } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new SessionError("not_found", "Bu görev bulunamadı.");
  return data;
}

async function viewOf(supabase: Supabase, id: string) {
  const row = await loadAssignment(supabase, id);
  const { data: submission } = await supabase
    .from("submissions")
    .select("*")
    .eq("assignment_id", id)
    .maybeSingle();
  return toView(row, submission ?? undefined);
}

function requirePending(row: AssignmentRow) {
  if (row.status !== "pending") {
    throw new SessionError("not_active", "Bu görev zaten kapandı.");
  }
}

async function setStatus(
  supabase: Supabase,
  user: CurrentUser,
  id: string,
  status: "completed" | "skipped",
) {
  const { error } = await supabase
    .from("assignments")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error)
    throw new Error("Assignment could not be updated.", { cause: error });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Written answer for rewrite / interview / follow-up tasks. Idempotent: one
 * submission per assignment; calling again only retries missing feedback.
 * The answer is saved even if the AI feedback fails.
 */
export async function submitAnswer(
  user: CurrentUser,
  profile: Profile,
  id: string,
  answer: string | null,
): Promise<AssignmentView & { feedbackError: string | null }> {
  const supabase = await createClient();
  const row = await loadAssignment(supabase, id);
  if (!TEXT_KINDS.has(row.kind as AssignmentKind)) {
    throw new SessionError("invalid_request");
  }

  let { data: submission } = await supabase
    .from("submissions")
    .select("*")
    .eq("assignment_id", id)
    .maybeSingle();

  if (!submission) {
    requirePending(row);
    if (!answer) throw new SessionError("invalid_request");
    const { data, error } = await supabase
      .from("submissions")
      .insert({ assignment_id: id, user_id: user.id, answer_text: answer })
      .select("*")
      .single();
    if (error?.code === "23505") {
      submission = (
        await supabase
          .from("submissions")
          .select("*")
          .eq("assignment_id", id)
          .single()
      ).data;
    } else if (error || !data) {
      throw new Error("Submission could not be saved.", { cause: error });
    } else {
      submission = data;
    }
    await setStatus(supabase, user, id, "completed");
  }

  let feedbackError: string | null = null;
  if (submission && !submission.feedback && submission.answer_text) {
    try {
      const payload = row.payload as AssignmentPayload;
      const raw = await runStructured({
        schema: taskFeedbackSchema,
        system: TASK_FEEDBACK_PROMPT,
        content: JSON.stringify({
          task_title: row.title,
          instructions: row.instructions,
          reference: payload.reference ?? null,
          learner_answer: submission.answer_text,
          english_variety: profile.dialect,
        }),
        userId: user.id,
        operation: "task_feedback",
      });
      const feedback: StoredTaskFeedback = {
        ...validateTaskFeedback(raw, submission.answer_text),
        version: TASK_FEEDBACK_VERSION,
      };
      const { error } = await createAdminClient()
        .from("submissions")
        .update({ feedback: feedback as unknown as NonNullable<Json> })
        .eq("id", submission.id)
        .eq("user_id", user.id);
      if (error)
        throw new Error("Feedback could not be saved.", { cause: error });
    } catch (error) {
      if (!(error instanceof SessionError)) throw error;
      feedbackError = error.message;
    }
  }

  return { ...(await viewOf(supabase, id)), feedbackError };
}

/** Review tasks are done once the learner has graded at least one card today. */
export async function completeReview(
  user: CurrentUser,
  profile: Profile,
  id: string,
) {
  const supabase = await createClient();
  const row = await loadAssignment(supabase, id);
  if (row.kind !== "review") throw new SessionError("invalid_request");
  if (row.status === "completed") return viewOf(supabase, id);
  requirePending(row);

  const { count } = await supabase
    .from("review_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("reviewed_at", startOfLocalDay(new Date(), profile.timezone));
  if (!count) {
    throw new SessionError(
      "not_ready",
      "Önce bugün en az bir kartı tekrar et; sonra görevi tamamlayabilirsin.",
    );
  }
  await setStatus(supabase, user, id, "completed");
  return viewOf(supabase, id);
}

export async function skipAssignment(user: CurrentUser, id: string) {
  const supabase = await createClient();
  const row = await loadAssignment(supabase, id);
  if (row.status === "skipped") return viewOf(supabase, id);
  requirePending(row);
  await setStatus(supabase, user, id, "skipped");
  return viewOf(supabase, id);
}

/** Moves a pending task to the learner's next local day. */
export async function rescheduleAssignment(
  user: CurrentUser,
  profile: Profile,
  id: string,
) {
  const supabase = await createClient();
  const row = await loadAssignment(supabase, id);
  requirePending(row);
  const tomorrow = addDays(todayKey(profile), 1);
  const { error } = await supabase
    .from("assignments")
    .update({ scheduled_for: tomorrow })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error)
    throw new Error("Assignment could not be rescheduled.", { cause: error });
  return viewOf(supabase, id);
}

/** Replaces a pending task with a similar-size alternative (the original is skipped). */
export async function swapAssignment(
  user: CurrentUser,
  profile: Profile,
  id: string,
) {
  const supabase = await createClient();
  const row = await loadAssignment(supabase, id);
  requirePending(row);
  const input = await plannerInput(supabase, user, profile, todayKey(profile));
  const next = alternativeFor(
    {
      kind: row.kind as AssignmentKind,
      planKey: row.plan_key ?? `${row.scheduled_for}:${row.id}`,
      estimatedMinutes: row.estimated_minutes,
      payload: row.payload as AssignmentPayload,
    },
    input,
  );
  if (!next) {
    throw new SessionError(
      "not_ready",
      "Bu görev için başka seçenek yok; atlayabilir ya da yarına erteleyebilirsin.",
    );
  }

  const { data, error } = await supabase
    .from("assignments")
    .upsert(toInsert(user.id, row.scheduled_for, next), {
      onConflict: "user_id,plan_key",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error)
    throw new Error("Alternative task could not be saved.", { cause: error });
  await setStatus(supabase, user, id, "skipped");

  const newId =
    data?.[0]?.id ??
    (
      await supabase
        .from("assignments")
        .select("id")
        .eq("user_id", user.id)
        .eq("plan_key", next.planKey)
        .single()
    ).data?.id;
  if (!newId) throw new Error("Alternative task could not be loaded.");
  return viewOf(supabase, newId);
}

// ---------------------------------------------------------------------------
// Conversation-linked tasks
// ---------------------------------------------------------------------------

/** Validates that a session may be started for this task. */
export async function assignmentForSession(
  supabase: Supabase,
  id: string,
): Promise<string> {
  const row = await loadAssignment(supabase, id);
  requirePending(row);
  if (!SESSION_KINDS.has(row.kind as AssignmentKind)) {
    throw new SessionError("invalid_request");
  }
  return row.id;
}

/** Called when a linked session ends with at least one learner message. */
export async function completeFromSession(
  supabase: Supabase,
  user: CurrentUser,
  assignmentId: string,
  sessionId: string,
) {
  const { data: row } = await supabase
    .from("assignments")
    .select("id, status")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!row || row.status !== "pending") return;
  const { error } = await supabase.from("submissions").insert({
    assignment_id: assignmentId,
    user_id: user.id,
    session_id: sessionId,
  });
  if (error && error.code !== "23505") {
    throw new Error("Session submission could not be saved.", {
      cause: error,
    });
  }
  await setStatus(supabase, user, assignmentId, "completed");
}
