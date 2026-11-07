import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import {
  AiNotConfiguredError,
  fallbackOptions,
  getAnthropic,
} from "@/lib/ai/client";
import { getAiConfig } from "@/lib/ai/config";
import { assertAiRateLimit } from "@/lib/ai/rate-limit";
import { recordUsage } from "@/lib/ai/usage";
import { SessionError } from "@/lib/sessions/errors";

/**
 * One schema-validated analysis call (writing coach, task feedback,
 * assessment). Usage is logged without content; provider failures surface
 * as learner-facing SessionErrors.
 */
export async function runStructured<T extends z.ZodType>(input: {
  schema: T;
  system: string;
  content: string;
  userId: string;
  operation: "task_feedback" | "writing_coach" | "assessment" | "listening";
  effort?: "low" | "medium";
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const { analysisModel } = getAiConfig();
  await assertAiRateLimit(input.userId);
  try {
    const response = await getAnthropic().beta.messages.parse({
      ...fallbackOptions(),
      model: analysisModel,
      max_tokens: input.maxTokens ?? 8000,
      output_config: {
        effort: input.effort ?? "low",
        format: betaZodOutputFormat(input.schema),
      },
      system: input.system,
      messages: [{ role: "user", content: input.content }],
    });
    await recordUsage({
      userId: input.userId,
      sessionId: null,
      model: response.model,
      operation: input.operation,
      usage: response.usage,
    });
    if (response.stop_reason === "refusal")
      throw new SessionError("ai_refused");
    if (!response.parsed_output) throw new SessionError("ai_failed");
    return response.parsed_output as z.infer<T>;
  } catch (error) {
    if (error instanceof SessionError) throw error;
    if (error instanceof AiNotConfiguredError)
      throw new SessionError("ai_not_configured");
    if (error instanceof Anthropic.AuthenticationError)
      throw new SessionError("ai_not_configured");
    if (
      error instanceof Anthropic.APIError ||
      error instanceof Anthropic.APIConnectionError
    ) {
      throw new SessionError("ai_failed");
    }
    throw error;
  }
}
