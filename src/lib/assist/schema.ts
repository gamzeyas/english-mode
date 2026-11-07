import { z } from "zod";

/** Structured outputs for the assist calls (shared with the client). */
export const translationSchema = z.object({ text_tr: z.string() });

export const hintsSchema = z.object({
  idea_tr: z.string(),
  patterns: z.array(
    z.object({ pattern: z.string(), example: z.string(), tr: z.string() }),
  ),
  words: z.array(z.object({ word: z.string(), tr: z.string() })),
});

export type Hints = z.infer<typeof hintsSchema>;

/** Drops empty items and caps counts so the UI stays compact. */
export function validateHints(raw: Hints): Hints {
  const patterns = raw.patterns
    .map((p) => ({
      pattern: p.pattern.trim(),
      example: p.example.trim(),
      tr: p.tr.trim(),
    }))
    .filter((p) => p.pattern && p.example)
    .slice(0, 4);
  const words = raw.words
    .map((w) => ({ word: w.word.trim(), tr: w.tr.trim() }))
    .filter((w) => w.word && w.tr)
    .slice(0, 8);
  if (patterns.length === 0 && words.length === 0)
    throw new Error("hints: empty");
  return { idea_tr: raw.idea_tr.trim(), patterns, words };
}
