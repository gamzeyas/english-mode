import { getServerEnv } from "@/lib/env";

/** USD per million tokens (first-party Claude API rates). */
type Pricing = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

const PRICING: Record<string, Pricing> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": {
    input: 2,
    output: 10,
    cacheRead: 0.2,
    cacheWrite: 2.5,
  },
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
  },
};

export const DEFAULT_MODEL = "claude-opus-5-5";

/** Per-session caps (runaway protection; there is no daily spend cap). */
export const MAX_USER_TURNS_PER_SESSION = 40;
export const MAX_MESSAGE_CHARS = 2000;

export function getAiConfig() {
  const env = getServerEnv();
  return {
    chatModel: env.AI_CHAT_MODEL ?? DEFAULT_MODEL,
    analysisModel: env.AI_ANALYSIS_MODEL ?? DEFAULT_MODEL,
  };
}

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

/**
 * Estimated cost of one call. Unknown models are priced at the most
 * expensive known rate so the budget errs on the safe side.
 */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const price = PRICING[model] ?? PRICING[DEFAULT_MODEL];
  const perToken = (rate: number) => rate / 1_000_000;
  return (
    usage.input_tokens * perToken(price.input) +
    usage.output_tokens * perToken(price.output) +
    (usage.cache_read_input_tokens ?? 0) * perToken(price.cacheRead) +
    (usage.cache_creation_input_tokens ?? 0) * perToken(price.cacheWrite)
  );
}
