import { normalizePhrase } from "@/lib/text/normalize";

/**
 * Splits a template phrase like "If I could..., I'd..." into its fixed parts
 * ("if i could", "i'd"). Ellipses mark the learner's own words.
 */
export function phraseFragments(phrase: string): string[] {
  return normalizePhrase(phrase)
    .split(/\.{2,}|…/)
    .map((part) => part.replace(/^[\s,;:]+|[\s,;:]+$/g, "").trim())
    .filter(Boolean);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Hides the target phrase in its example sentence so the prompt gives
 * context without revealing the answer. Returns null if the example does not
 * contain every fragment (then only the meaning is shown).
 */
export function clozeExample(
  phrase: string,
  example: string | null,
): string | null {
  if (!example) return null;
  let result = example.replace(/[‘’]/g, "'");
  for (const fragment of phraseFragments(phrase)) {
    const pattern = new RegExp(
      escapeRegExp(fragment).replace(/\s+/g, "\\s+"),
      "i",
    );
    if (!pattern.test(result)) return null;
    result = result.replace(pattern, "____");
  }
  return result === example ? null : result;
}

export type RecallMatch = "exact" | "partial" | "none";

/**
 * Local, free check: did the answer use the phrase's fixed parts, in order?
 * Advisory only — the learner's self-grade decides scheduling.
 */
export function matchRecall(phrase: string, answer: string): RecallMatch {
  const fragments = phraseFragments(phrase);
  const normalized = normalizePhrase(answer);
  if (fragments.length === 0 || !normalized) return "none";

  let position = 0;
  let found = 0;
  for (const fragment of fragments) {
    const index = normalized.indexOf(fragment, position);
    if (index === -1) continue;
    found += 1;
    position = index + fragment.length;
  }
  if (found === fragments.length) return "exact";
  return found > 0 ? "partial" : "none";
}
