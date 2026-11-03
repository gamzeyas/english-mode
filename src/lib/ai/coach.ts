import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { fallbackOptions, getAnthropic } from "@/lib/ai/client";
import { feedbackSchema, type FeedbackPayload } from "@/lib/ai/analysis/schema";
import { ANALYZER_SYSTEM_PROMPT } from "@/lib/ai/prompts/analyzer";
import { COACH_KICKOFF, COACH_SYSTEM_PROMPT } from "@/lib/ai/prompts/coach";
import type { TokenUsage } from "@/lib/ai/config";

export class AiRefusalError extends Error {
  constructor(public readonly category: string | null) {
    super("The model declined to respond.");
    this.name = "AiRefusalError";
  }
}

export class AiIncompleteError extends Error {
  constructor(public readonly stopReason: string | null) {
    super(`The model stopped early (${stopReason}).`);
    this.name = "AiIncompleteError";
  }
}

type HistoryMessage = { role: "user" | "assistant"; content: string };

function toUsage(usage: Anthropic.Beta.BetaUsage): TokenUsage {
  return {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_input_tokens: usage.cache_read_input_tokens,
    cache_creation_input_tokens: usage.cache_creation_input_tokens,
  };
}

function assertUsable(message: Anthropic.Beta.BetaMessage) {
  if (message.stop_reason === "refusal") {
    throw new AiRefusalError(message.stop_details?.category ?? null);
  }
  if (message.stop_reason === "max_tokens") {
    throw new AiIncompleteError(message.stop_reason);
  }
}

/**
 * One coach turn. History is text-only (no thinking blocks are replayed), and
 * the system prefix (instruction + frozen learner context) is identical on
 * every turn of a session so it can be served from the prompt cache.
 */
export async function generateCoachReply(input: {
  model: string;
  learnerContext: string;
  history: HistoryMessage[];
}): Promise<{ text: string; usage: TokenUsage; servedBy: string }> {
  const messages: Anthropic.Beta.BetaMessageParam[] =
    input.history[0]?.role === "user"
      ? input.history
      : [{ role: "user", content: COACH_KICKOFF }, ...input.history];

  const response = await getAnthropic().beta.messages.create({
    ...fallbackOptions(),
    model: input.model,
    max_tokens: 4000,
    // Chat replies are short; low effort keeps latency and cost down.
    output_config: { effort: "low" },
    cache_control: { type: "ephemeral" },
    system: [
      { type: "text", text: COACH_SYSTEM_PROMPT },
      {
        type: "text",
        text: input.learnerContext,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  assertUsable(response);
  const text = response.content
    .filter(
      (block): block is Anthropic.Beta.BetaTextBlock => block.type === "text",
    )
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new AiIncompleteError(response.stop_reason);

  return { text, usage: toUsage(response.usage), servedBy: response.model };
}

/** Post-session structured analysis, schema-validated by the SDK. */
export async function generateFeedback(input: {
  model: string;
  analyzerInput: string;
}): Promise<{ payload: FeedbackPayload; usage: TokenUsage; servedBy: string }> {
  const response = await getAnthropic().beta.messages.parse({
    ...fallbackOptions(),
    model: input.model,
    max_tokens: 16000,
    output_config: {
      effort: "medium",
      format: betaZodOutputFormat(feedbackSchema),
    },
    system: ANALYZER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: input.analyzerInput }],
  });

  assertUsable(response);
  if (!response.parsed_output)
    throw new AiIncompleteError(response.stop_reason);
  return {
    payload: response.parsed_output,
    usage: toUsage(response.usage),
    servedBy: response.model,
  };
}
