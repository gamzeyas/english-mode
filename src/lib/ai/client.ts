import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not configured.");
    this.name = "AiNotConfiguredError";
  }
}

let client: Anthropic | null = null;

/** Server-only Claude client. The API key never leaves the server. */
export function getAnthropic(): Anthropic {
  const apiKey = getServerEnv().ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  client ??= new Anthropic({ apiKey, timeout: 120_000, maxRetries: 2 });
  return client;
}

/**
 * Server-side refusal fallback: if a safety classifier declines a request,
 * the API re-runs it on Anthropic's recommended fallback model in the same call.
 */
export function fallbackOptions(): {
  betas: Anthropic.Beta.AnthropicBeta[];
  fallbacks: "default";
} {
  return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
}
