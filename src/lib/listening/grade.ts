/**
 * Deterministic dictation grading: the learner's typed sentence is aligned
 * word by word with the reference (longest common subsequence), so feedback
 * shows exactly which words were heard, missed or misheard. Case,
 * punctuation and apostrophe style don't count against the learner.
 */
export type WordMark =
  | { status: "ok"; word: string }
  | { status: "missed"; word: string }
  | { status: "wrong"; word: string; heard: string };

export type DictationGrade = {
  marks: WordMark[];
  /** Words typed that aren't in the reference. */
  extra: string[];
  correct: number;
  total: number;
};

const tokenize = (text: string) =>
  text
    .replace(/[‘’ʼ]/g, "'")
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""))
    .filter(Boolean);

// "im" for "I'm" is a spelling slip, not a listening error.
const normalize = (word: string) =>
  word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function gradeDictation(
  reference: string,
  answer: string,
): DictationGrade {
  const ref = tokenize(reference);
  const got = tokenize(answer);
  const a = ref.map(normalize);
  const b = got.map(normalize);

  // lcs[i][j]: common words between a[i..] and b[j..].
  const lcs = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const marks: WordMark[] = [];
  const extra: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      marks.push({ status: "ok", word: ref[i] });
      i++;
      j++;
    } else if (
      i < a.length &&
      j < b.length &&
      lcs[i + 1][j + 1] === lcs[i][j]
    ) {
      // A substitution keeps the alignment: the learner misheard this word.
      marks.push({ status: "wrong", word: ref[i], heard: got[j] });
      i++;
      j++;
    } else if (
      i < a.length &&
      (j >= b.length || lcs[i + 1][j] >= lcs[i][j + 1])
    ) {
      marks.push({ status: "missed", word: ref[i] });
      i++;
    } else {
      extra.push(got[j]);
      j++;
    }
  }
  return {
    marks,
    extra,
    correct: marks.filter((mark) => mark.status === "ok").length,
    total: ref.length,
  };
}
