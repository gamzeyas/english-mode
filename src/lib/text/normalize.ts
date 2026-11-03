/**
 * Normalizes a learner phrase for deduplication (PRD §7: normalized phrase +
 * learner ID). Keeps meaning-bearing characters, drops case, curly quotes,
 * surrounding punctuation, trailing ellipses and repeated whitespace.
 */
export function normalizePhrase(phrase: string): string {
  return phrase
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s"'.,!?;:()[\]-]+|[\s"'.,!?;:()[\]-]+$/g, "")
    .trim();
}

export function isSamePhrase(a: string, b: string): boolean {
  const left = normalizePhrase(a);
  return left.length > 0 && left === normalizePhrase(b);
}
