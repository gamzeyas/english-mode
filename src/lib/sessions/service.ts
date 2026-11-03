import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { CurrentUser, Profile } from "@/lib/auth/dal";
import {
  validateFeedback,
  type FeedbackPayload,
} from "@/lib/ai/analysis/schema";
import { AiNotConfiguredError } from "@/lib/ai/client";
import {
  AiIncompleteError,
  AiRefusalError,
  generateCoachReply,
  generateFeedback,
} from "@/lib/ai/coach";
import { getAiConfig, MAX_USER_TURNS_PER_SESSION } from "@/lib/ai/config";
import {
  ANALYZER_VERSION,
  buildAnalyzerInput,
} from "@/lib/ai/prompts/analyzer";
import {
  buildLearnerContextPrompt,
  COACH_PROMPT_VERSION,
  type LearnerContext,
} from "@/lib/ai/prompts/coach";
import { recordUsage } from "@/lib/ai/usage";
import { SessionError } from "@/lib/sessions/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizePhrase } from "@/lib/text/normalize";
import type { Json, Tables } from "@/types/database";

/** Typed bridge for jsonb columns (values are plain JSON objects). */
function asJson(value: unknown): NonNullable<Json> {
  return value as NonNullable<Json>;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;
type MessageRow = Tables<"messages">;

export type SessionMetadata = {
  prompt_version: string;
  context: LearnerContext;
  context_prompt: string;
  duration_goal_minutes: number | null;
  analysis?: {
    status: "running" | "done" | "failed";
    started_at: string;
    attempts: number;
  };
};

const ANALYSIS_LOCK_MS = 3 * 60_000;
const MAX_ANALYSIS_ATTEMPTS = 3;

/** Maps provider failures onto learner-facing session errors. */
function toSessionError(error: unknown): SessionError {
  if (error instanceof SessionError) return error;
  if (error instanceof AiNotConfiguredError)
    return new SessionError("ai_not_configured");
  if (error instanceof AiRefusalError) return new SessionError("ai_refused");
  if (error instanceof AiIncompleteError) return new SessionError("ai_failed");
  if (error instanceof Anthropic.AuthenticationError)
    return new SessionError("ai_not_configured");
  if (error instanceof Anthropic.RateLimitError)
    return new SessionError("ai_failed");
  if (error instanceof Anthropic.APIError) return new SessionError("ai_failed");
  if (error instanceof Anthropic.APIConnectionError)
    return new SessionError("ai_failed");
  throw error;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

async function buildLearnerContext(
  supabase: Supabase,
  user: CurrentUser,
  profile: Profile,
  scenario: Tables<"scenarios"> | null,
  durationGoalMinutes: number | null,
): Promise<LearnerContext> {
  const [patterns, due, summaries] = await Promise.all([
    supabase
      .from("error_patterns")
      .select("category, pattern_key, evidence")
      .eq("user_id", user.id)
      .order("occurrence_count", { ascending: false })
      .limit(10),
    supabase
      .from("learning_items")
      .select("phrase")
      .eq("user_id", user.id)
      .in("status", ["new", "learning", "review"])
      .lte("due_at", new Date().toISOString())
      .order("due_at", { ascending: true })
      .limit(3),
    supabase
      .from("sessions")
      .select("summary")
      .eq("user_id", user.id)
      .not("summary", "is", null)
      .order("started_at", { ascending: false })
      .limit(2),
  ]);

  const persona = (scenario?.persona ?? {}) as Record<string, string>;
  return {
    displayName: profile.display_name,
    purpose: profile.purpose,
    goals: profile.goals,
    interests: profile.interests,
    dialect: profile.dialect as LearnerContext["dialect"],
    feedbackMode: profile.feedback_mode as LearnerContext["feedbackMode"],
    durationGoalMinutes,
    weakPatterns: (patterns.data ?? []).map((row) => {
      const evidence = Array.isArray(row.evidence) ? row.evidence : [];
      const last = evidence.at(-1) as { original?: string } | undefined;
      return {
        category: row.category,
        pattern: row.pattern_key,
        example: last?.original ?? null,
      };
    }),
    targetExpressions: (due.data ?? []).map((row) => row.phrase),
    recentSessionSummaries: (summaries.data ?? []).map(
      (row) => row.summary as string,
    ),
    scenario: scenario
      ? {
          title: scenario.title,
          summary: scenario.summary,
          persona: {
            name: persona.name ?? "Partner",
            role: persona.role ?? "",
            style: persona.style ?? "",
          },
          goals: Array.isArray(scenario.goals)
            ? (scenario.goals as string[])
            : [],
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(
  user: CurrentUser,
  profile: Profile,
  input: { scenarioSlug: string | null; durationGoalMinutes: number | null },
): Promise<string> {
  const supabase = await createClient();

  let scenario: Tables<"scenarios"> | null = null;
  if (input.scenarioSlug) {
    const { data } = await supabase
      .from("scenarios")
      .select("*")
      .eq("slug", input.scenarioSlug)
      .maybeSingle();
    if (!data) throw new SessionError("invalid_request");
    scenario = data;
  }

  const context = await buildLearnerContext(
    supabase,
    user,
    profile,
    scenario,
    input.durationGoalMinutes,
  );
  const metadata: SessionMetadata = {
    prompt_version: COACH_PROMPT_VERSION,
    context,
    context_prompt: buildLearnerContextPrompt(context),
    duration_goal_minutes: input.durationGoalMinutes,
  };

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      scenario_id: scenario?.id ?? null,
      mode: "text",
      metadata: asJson(metadata),
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error("Session could not be created.", { cause: error });

  // The coach opens the conversation. If that fails the session still works:
  // the learner can write first.
  try {
    await generateAndStoreReply(supabase, user, profile, data.id, metadata, 0);
  } catch (error) {
    console.warn("[sessions] opening reply failed", (error as Error).name);
  }
  return data.id;
}

async function loadSession(supabase: Supabase, sessionId: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !data) throw new SessionError("not_found");
  return data;
}

async function loadMessages(supabase: Supabase, sessionId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("sequence_number", { ascending: true });
  if (error) throw new Error("Messages could not be loaded.", { cause: error });
  return data;
}

export async function getSessionView(sessionId: string) {
  const supabase = await createClient();
  const session = await loadSession(supabase, sessionId);
  const [messages, scenario] = await Promise.all([
    loadMessages(supabase, sessionId),
    session.scenario_id
      ? supabase
          .from("scenarios")
          .select("title, persona")
          .eq("id", session.scenario_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const metadata = session.metadata as unknown as SessionMetadata;
  return {
    id: session.id,
    status: session.status,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    durationGoalMinutes: metadata.duration_goal_minutes ?? null,
    scenario: scenario.data
      ? {
          title: scenario.data.title,
          personaName:
            (scenario.data.persona as Record<string, string>).name ?? null,
        }
      : null,
    messages: messages
      .filter((m) => m.role !== "system_summary")
      .map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        createdAt: m.created_at,
      })),
  };
}

export type SessionView = Awaited<ReturnType<typeof getSessionView>>;

/** For pages: a missing or foreign session is a 404, not an error page. */
export async function findSessionView(
  sessionId: string,
): Promise<SessionView | null> {
  try {
    return await getSessionView(sessionId);
  } catch (error) {
    if (error instanceof SessionError && error.code === "not_found")
      return null;
    throw error;
  }
}

async function generateAndStoreReply(
  supabase: Supabase,
  user: CurrentUser,
  profile: Profile,
  sessionId: string,
  metadata: SessionMetadata,
  sequenceNumber: number,
): Promise<MessageRow> {
  const { chatModel } = getAiConfig();
  const history = (await loadMessages(supabase, sessionId))
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const reply = await generateCoachReply({
    model: chatModel,
    learnerContext: metadata.context_prompt,
    history,
  });
  await recordUsage({
    userId: user.id,
    sessionId,
    model: reply.servedBy,
    operation: "coach_reply",
    usage: reply.usage,
  });

  const { data, error } = await supabase
    .from("messages")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      role: "assistant",
      content: reply.text,
      sequence_number: sequenceNumber,
    })
    .select("*")
    .single();

  if (error?.code === "23505") {
    // A concurrent retry already stored the reply for this turn.
    const { data: existing } = await supabase
      .from("messages")
      .select("*")
      .eq("session_id", sessionId)
      .eq("sequence_number", sequenceNumber)
      .single();
    if (existing) return existing;
  }
  if (error || !data)
    throw new Error("Reply could not be saved.", { cause: error });
  return data;
}

function toClientMessage(m: MessageRow) {
  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.created_at,
  };
}

/**
 * Idempotent on clientMessageId (PRD §9): retrying the same message never
 * duplicates it; if the learner message was stored but the reply failed, the
 * retry only generates the missing reply.
 */
export async function sendMessage(
  user: CurrentUser,
  profile: Profile,
  sessionId: string,
  input: { content: string; clientMessageId: string },
) {
  const supabase = await createClient();
  const session = await loadSession(supabase, sessionId);
  if (session.status !== "active") throw new SessionError("not_active");
  const metadata = session.metadata as unknown as SessionMetadata;

  const findByClientId = async () =>
    (
      await supabase
        .from("messages")
        .select("*")
        .eq("session_id", sessionId)
        .eq("client_message_id", input.clientMessageId)
        .maybeSingle()
    ).data;

  let userMessage = await findByClientId();

  if (!userMessage) {
    const messages = await loadMessages(supabase, sessionId);
    const turns = messages.filter((m) => m.role === "user").length;
    if (turns >= MAX_USER_TURNS_PER_SESSION)
      throw new SessionError("turn_limit");

    const nextSequence = (messages.at(-1)?.sequence_number ?? -1) + 1;
    const { data, error } = await supabase
      .from("messages")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role: "user",
        content: input.content,
        client_message_id: input.clientMessageId,
        sequence_number: nextSequence,
      })
      .select("*")
      .single();
    if (error?.code === "23505") userMessage = await findByClientId();
    else if (error || !data)
      throw new Error("Message could not be saved.", { cause: error });
    else userMessage = data;
    if (!userMessage) throw new SessionError("ai_failed");
  }

  const { data: existingReply } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .eq("sequence_number", userMessage.sequence_number + 1)
    .eq("role", "assistant")
    .maybeSingle();
  if (existingReply) {
    return {
      message: toClientMessage(userMessage),
      assistantMessage: toClientMessage(existingReply),
    };
  }

  try {
    const reply = await generateAndStoreReply(
      supabase,
      user,
      profile,
      sessionId,
      metadata,
      userMessage.sequence_number + 1,
    );
    return {
      message: toClientMessage(userMessage),
      assistantMessage: toClientMessage(reply),
    };
  } catch (error) {
    throw toSessionError(error);
  }
}

export async function endSession(user: CurrentUser, sessionId: string) {
  const supabase = await createClient();
  const session = await loadSession(supabase, sessionId);
  if (session.status === "active") {
    const { error } = await supabase
      .from("sessions")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("user_id", user.id);
    if (error) throw new Error("Session could not be ended.", { cause: error });
  }
  return { status: "completed" as const };
}

// ---------------------------------------------------------------------------
// Feedback analysis
// ---------------------------------------------------------------------------

export type FeedbackCandidate = {
  id: string;
  phrase: string;
  meaningTr: string | null;
  example: string | null;
  status: string;
};

export type FeedbackState =
  | { state: "not_ended" }
  | { state: "empty" }
  | { state: "running" }
  | { state: "failed"; error: string }
  | {
      state: "ready";
      payload: FeedbackPayload;
      candidates: FeedbackCandidate[];
    };

async function readyState(
  supabase: Supabase,
  sessionId: string,
  payload: Json,
): Promise<FeedbackState> {
  const { data } = await supabase
    .from("learning_items")
    .select("id, phrase, meaning_tr, example, status")
    .eq("source_session_id", sessionId)
    .order("created_at", { ascending: true });
  return {
    state: "ready",
    payload: payload as unknown as FeedbackPayload,
    candidates: (data ?? []).map((row) => ({
      id: row.id,
      phrase: row.phrase,
      meaningTr: row.meaning_tr,
      example: row.example,
      status: row.status,
    })),
  };
}

/** Read-only state for polling. */
export async function getFeedbackState(
  sessionId: string,
): Promise<FeedbackState> {
  const supabase = await createClient();
  const session = await loadSession(supabase, sessionId);
  if (session.status === "active") return { state: "not_ended" };

  const { data: feedback } = await supabase
    .from("session_feedback")
    .select("payload")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (feedback) return readyState(supabase, sessionId, feedback.payload);

  const analysis = (session.metadata as unknown as SessionMetadata).analysis;
  if (analysis?.status === "running") return { state: "running" };
  if (analysis?.status === "done") return { state: "empty" };
  if (
    analysis?.status === "failed" &&
    analysis.attempts >= MAX_ANALYSIS_ATTEMPTS
  ) {
    return { state: "failed", error: "Analiz tamamlanamadı." };
  }
  return { state: "running" };
}

/**
 * Runs the analysis if it has not run yet. Safe to call repeatedly: a stored
 * result is returned as-is, a fresh lock means another request is working on
 * it, and a stale lock (crashed or timed-out request) is retried — so the work
 * survives function termination without a separate queue.
 */
export async function ensureFeedback(
  user: CurrentUser,
  profile: Profile,
  sessionId: string,
  options: { retryFailed?: boolean } = {},
): Promise<FeedbackState> {
  const supabase = await createClient();
  const session = await loadSession(supabase, sessionId);
  if (session.status === "active") return { state: "not_ended" };

  const { data: existing } = await supabase
    .from("session_feedback")
    .select("payload")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existing) return readyState(supabase, sessionId, existing.payload);

  const metadata = session.metadata as unknown as SessionMetadata;
  const analysis = metadata.analysis;
  const now = Date.now();
  if (analysis?.status === "done") return { state: "empty" };
  if (
    analysis?.status === "running" &&
    now - new Date(analysis.started_at).getTime() < ANALYSIS_LOCK_MS
  ) {
    return { state: "running" };
  }
  const attempts = analysis?.attempts ?? 0;
  if (attempts >= MAX_ANALYSIS_ATTEMPTS && !options.retryFailed) {
    return { state: "failed", error: "Analiz tamamlanamadı." };
  }

  const setAnalysis = (value: SessionMetadata["analysis"]) =>
    supabase
      .from("sessions")
      .update({ metadata: asJson({ ...metadata, analysis: value }) })
      .eq("id", sessionId)
      .eq("user_id", user.id);

  const messages = (await loadMessages(supabase, sessionId)).filter(
    (m) => m.role === "user" || m.role === "assistant",
  );
  if (!messages.some((m) => m.role === "user")) {
    await setAnalysis({
      status: "done",
      started_at: new Date().toISOString(),
      attempts,
    });
    return { state: "empty" };
  }

  const nextAttempts = options.retryFailed ? 1 : attempts + 1;
  await setAnalysis({
    status: "running",
    started_at: new Date().toISOString(),
    attempts: nextAttempts,
  });

  try {
    const { analysisModel } = getAiConfig();
    const context = metadata.context;
    const scenario = session.scenario_id
      ? (
          await supabase
            .from("scenarios")
            .select("title, rubric")
            .eq("id", session.scenario_id)
            .maybeSingle()
        ).data
      : null;

    const result = await generateFeedback({
      model: analysisModel,
      analyzerInput: buildAnalyzerInput({
        transcript: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })),
        modality: messages.some((m) => m.modality === "speech_transcript")
          ? "speech_transcript"
          : "text",
        dialect: context.dialect,
        targetExpressions: context.targetExpressions,
        previousWeakPatterns: context.weakPatterns.map((p) => p.pattern),
        scenario: scenario
          ? { title: scenario.title, rubric: scenario.rubric }
          : null,
      }),
    });
    await recordUsage({
      userId: user.id,
      sessionId,
      model: result.servedBy,
      operation: "feedback_analysis",
      usage: result.usage,
    });

    const { payload, dropped } = validateFeedback(result.payload, messages);
    if (dropped.corrections + dropped.strengths + dropped.candidates > 0) {
      console.info("[feedback] dropped unanchored findings", dropped);
    }

    await persistFeedback(supabase, user, sessionId, payload, messages);
    await setAnalysis({
      status: "done",
      started_at: new Date().toISOString(),
      attempts: nextAttempts,
    });

    const { data: stored } = await supabase
      .from("session_feedback")
      .select("payload")
      .eq("session_id", sessionId)
      .single();
    return readyState(supabase, sessionId, stored?.payload ?? asJson(payload));
  } catch (error) {
    await setAnalysis({
      status: "failed",
      started_at: new Date().toISOString(),
      attempts: nextAttempts,
    });
    const sessionError = toSessionError(error);
    return { state: "failed", error: sessionError.message };
  }
}

async function persistFeedback(
  supabase: Supabase,
  user: CurrentUser,
  sessionId: string,
  payload: FeedbackPayload,
  messages: MessageRow[],
) {
  const admin = createAdminClient();

  // Learning candidates are learner-owned rows awaiting approval ("suggested").
  // Existing phrases (any status) are left untouched: dedupe per learner.
  const byId = new Map(messages.map((m) => [m.id, m]));
  const correctionByMessage = new Map(
    payload.corrections.map((c) => [c.evidence_message_id, c]),
  );
  const candidates = payload.learning_candidates.map((c) => {
    const correction = correctionByMessage.get(c.source_message_id);
    return {
      user_id: user.id,
      phrase: c.phrase.trim(),
      normalized_phrase: normalizePhrase(c.phrase),
      meaning_tr: c.meaning_tr,
      example: c.example,
      status: "suggested" as const,
      source_session_id: sessionId,
      source_message_id: byId.has(c.source_message_id)
        ? c.source_message_id
        : null,
      source_context: correction ? `You wrote: “${correction.original}”` : null,
    };
  });
  if (candidates.length > 0) {
    const { error } = await supabase.from("learning_items").upsert(candidates, {
      onConflict: "user_id,normalized_phrase",
      ignoreDuplicates: true,
    });
    if (error)
      throw new Error("Learning candidates could not be saved.", {
        cause: error,
      });
  }

  // Recurring error patterns (server-written table).
  for (const correction of payload.corrections) {
    const evidence = {
      session_id: sessionId,
      message_id: correction.evidence_message_id,
      original: correction.original,
      improved: correction.improved,
    };
    const { data: current } = await admin
      .from("error_patterns")
      .select("id, occurrence_count, evidence")
      .eq("user_id", user.id)
      .eq("pattern_key", correction.pattern_key)
      .maybeSingle();
    if (current) {
      const previous = Array.isArray(current.evidence) ? current.evidence : [];
      await admin
        .from("error_patterns")
        .update({
          occurrence_count: current.occurrence_count + 1,
          last_seen_at: new Date().toISOString(),
          explanation_tr: correction.reason_tr,
          evidence: asJson([...previous, evidence].slice(-10)),
        })
        .eq("id", current.id)
        .eq("user_id", user.id);
    } else {
      await admin.from("error_patterns").insert({
        user_id: user.id,
        pattern_key: correction.pattern_key,
        category: correction.category,
        explanation_tr: correction.reason_tr,
        evidence: asJson([evidence]),
      });
    }
  }

  const { error: feedbackError } = await admin.from("session_feedback").insert({
    session_id: sessionId,
    user_id: user.id,
    analyzer_version: ANALYZER_VERSION,
    payload: asJson(payload),
  });
  // 23505: a concurrent request stored it first; keep that one.
  if (feedbackError && feedbackError.code !== "23505") {
    throw new Error("Feedback could not be saved.", { cause: feedbackError });
  }

  await supabase
    .from("sessions")
    .update({ summary: payload.summary_tr })
    .eq("id", sessionId)
    .eq("user_id", user.id);
}

// ---------------------------------------------------------------------------
// Learning candidates
// ---------------------------------------------------------------------------

/** Approve a suggested phrase: it joins the pool and is due for review now. */
export async function acceptCandidate(
  user: CurrentUser,
  sessionId: string,
  itemId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learning_items")
    .update({ status: "new", due_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", user.id)
    .eq("source_session_id", sessionId)
    .eq("status", "suggested")
    .select("id, phrase, status, due_at")
    .maybeSingle();
  if (error)
    throw new Error("Candidate could not be accepted.", { cause: error });
  if (!data) {
    // Already accepted (idempotent retry) or not this learner's candidate.
    const { data: current } = await supabase
      .from("learning_items")
      .select("id, phrase, status, due_at")
      .eq("id", itemId)
      .eq("source_session_id", sessionId)
      .maybeSingle();
    if (!current) throw new SessionError("not_found");
    return current;
  }
  return data;
}

/** Reject a suggestion: it is removed, so it can be suggested again later. */
export async function rejectCandidate(
  user: CurrentUser,
  sessionId: string,
  itemId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("learning_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id)
    .eq("source_session_id", sessionId)
    .eq("status", "suggested");
  if (error)
    throw new Error("Candidate could not be rejected.", { cause: error });
}
