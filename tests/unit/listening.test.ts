import { describe, expect, it } from "vitest";
import {
  validateComprehension,
  validateDictation,
} from "@/lib/listening/content";
import { gradeDictation } from "@/lib/listening/grade";
import { billedCharacters, buildSsml, VOICES } from "@/lib/speech/tts";

describe("gradeDictation", () => {
  it("ignores case, punctuation and apostrophe style", () => {
    const grade = gradeDictation(
      "I'm working on a new project, aren't I?",
      "im working On a new project arent i",
    );
    expect(grade.correct).toBe(grade.total);
    expect(gradeDictation("I’m here.", "I'm here").correct).toBe(2);
  });

  it("marks missed, misheard and extra words", () => {
    const grade = gradeDictation(
      "She has been living in Berlin for two years",
      "she been leaving in Berlin for two years now",
    );
    expect(grade.total).toBe(9);
    expect(grade.marks).toContainEqual({ status: "missed", word: "has" });
    expect(grade.marks).toContainEqual({
      status: "wrong",
      word: "living",
      heard: "leaving",
    });
    expect(grade.extra).toEqual(["now"]);
    expect(grade.correct).toBe(7);
  });

  it("scores an empty answer as all missed", () => {
    const grade = gradeDictation("Nice to meet you", "");
    expect(grade.correct).toBe(0);
    expect(grade.marks.every((m) => m.status === "missed")).toBe(true);
  });

  it("keeps reference order in the marks", () => {
    const grade = gradeDictation("one two three", "one three");
    expect(grade.marks.map((m) => m.word)).toEqual(["one", "two", "three"]);
  });
});

describe("buildSsml", () => {
  it("uses the variety's voices, the rate and escapes text", () => {
    const ssml = buildSsml(
      [
        { speaker: "a", text: "Tom & Jerry <3" },
        { speaker: "b", text: "  " },
        { speaker: "b", text: 'It\'s "fine"' },
      ],
      { dialect: "en-GB", rate: "slow" },
    );
    expect(ssml).toContain('xml:lang="en-GB"');
    expect(ssml).toContain(VOICES["en-GB"].a);
    expect(ssml).toContain(VOICES["en-GB"].b);
    expect(ssml).toContain('rate="-25%"');
    expect(ssml).toContain("Tom &amp; Jerry &lt;3");
    expect(ssml).toContain("It&apos;s &quot;fine&quot;");
    // Blank segments are dropped rather than sent as empty voices.
    expect(ssml.match(/<voice /g)).toHaveLength(2);
  });

  it("bills the spoken characters only", () => {
    expect(
      billedCharacters([
        { speaker: "a", text: " Hello " },
        { speaker: "b", text: "Hi" },
      ]),
    ).toBe(7);
  });
});

describe("listening material validation", () => {
  it("rejects answer keys outside the options", () => {
    const lines = Array.from({ length: 6 }, (_, i) => ({
      speaker: (i % 2 ? "b" : "a") as "a" | "b",
      text: "Some line here.",
    }));
    const question = (answer_index: number) => ({
      question: "Why?",
      options: ["A", "B", "C"],
      answer_index,
      explanation_tr: "Çünkü.",
    });
    const valid = validateComprehension({
      title: "T",
      context_tr: "C",
      lines,
      questions: [question(0), question(2), question(3)],
    });
    expect(valid.questions).toHaveLength(2);
    expect(() =>
      validateComprehension({
        title: "T",
        context_tr: "C",
        lines,
        questions: [question(5)],
      }),
    ).toThrow();
  });

  it("caps dictation at five non-empty sentences", () => {
    const sentences = Array.from({ length: 7 }, (_, i) => ({
      text: i === 1 ? " " : `Sentence number ${i}.`,
      focus_tr: "x",
    }));
    expect(validateDictation({ title: "T", sentences }).sentences).toHaveLength(
      5,
    );
  });
});
