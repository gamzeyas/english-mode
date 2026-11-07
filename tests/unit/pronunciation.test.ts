import { describe, expect, it } from "vitest";
import {
  findPracticeSentence,
  PRACTICE_SETS,
} from "@/lib/pronunciation/catalog";
import { tipsForWord } from "@/lib/pronunciation/tips";
import {
  assessmentHeader,
  parsePronunciation,
} from "@/lib/speech/pronunciation";

// Shape of a real Azure response (trimmed), for "I think work" read as
// "I sink work work".
const response = {
  RecognitionStatus: "Success",
  NBest: [
    {
      Display: "I sink work work.",
      AccuracyScore: 71,
      FluencyScore: 88,
      CompletenessScore: 100,
      ProsodyScore: 80.4,
      PronScore: 79.6,
      Words: [
        {
          Word: "i",
          AccuracyScore: 100,
          ErrorType: "None",
          Phonemes: [{ Phoneme: "aɪ", AccuracyScore: 100 }],
        },
        {
          Word: "think",
          AccuracyScore: 42,
          ErrorType: "Mispronunciation",
          Phonemes: [
            { Phoneme: "θ", AccuracyScore: 8 },
            { Phoneme: "ɪ", AccuracyScore: 90 },
            { Phoneme: "ŋ", AccuracyScore: 55 },
            { Phoneme: "k", AccuracyScore: 95 },
          ],
        },
        {
          Word: "work",
          AccuracyScore: 97,
          ErrorType: "Insertion",
          Phonemes: [],
        },
        {
          Word: "work",
          AccuracyScore: 85,
          ErrorType: "None",
          Phonemes: [],
          Feedback: {
            Prosody: {
              Break: { ErrorTypes: ["MissingBreak"] },
              Intonation: { ErrorTypes: ["Monotone"] },
            },
          },
        },
        { Word: "today", ErrorType: "Omission", Phonemes: [] },
      ],
    },
  ],
};

describe("parsePronunciation", () => {
  it("normalises scores, error types and phonemes", () => {
    const result = parsePronunciation(response, "en-US")!;
    expect(result.scores).toEqual({
      pronunciation: 79.6,
      accuracy: 71,
      fluency: 88,
      completeness: 100,
      prosody: 80.4,
    });
    expect(result.words[1].phonemes[0]).toEqual({ phoneme: "θ", accuracy: 8 });
    expect(result.words[2].errorType).toBe("Insertion");
    // Break feedback surfaces when Azure reports no word-level error.
    expect(result.words[3].errorType).toBe("MissingBreak");
    expect(result.monotone).toBe(true);
    // Omitted words were never spoken, so they get no score.
    expect(result.words[4]).toMatchObject({
      errorType: "Omission",
      accuracy: null,
    });
  });

  it("drops unnamed phonemes (en-GB returns scores without names)", () => {
    const gb = parsePronunciation(
      {
        RecognitionStatus: "Success",
        NBest: [
          {
            AccuracyScore: 90,
            Words: [
              {
                Word: "in",
                AccuracyScore: 89,
                ErrorType: "None",
                Phonemes: [
                  { Phoneme: "", AccuracyScore: 40 },
                  { Phoneme: "", AccuracyScore: 100 },
                ],
              },
            ],
          },
        ],
      },
      "en-GB",
    )!;
    expect(gb.words[0].phonemes).toEqual([]);
  });

  it("never reports prosody outside en-US", () => {
    expect(parsePronunciation(response, "en-GB")!.scores.prosody).toBeNull();
  });

  it("returns null when nothing was recognised", () => {
    expect(
      parsePronunciation(
        { RecognitionStatus: "InitialSilenceTimeout" },
        "en-US",
      ),
    ).toBeNull();
  });

  it("asks for prosody only where it exists", () => {
    const decode = (header: string) =>
      JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    expect(decode(assessmentHeader("Hi.", "en-US"))).toMatchObject({
      ReferenceText: "Hi.",
      EnableMiscue: "True",
      EnableProsodyAssessment: "True",
      PhonemeAlphabet: "IPA",
    });
    expect(decode(assessmentHeader("Hi.", "en-GB"))).not.toHaveProperty(
      "EnableProsodyAssessment",
    );
  });
});

describe("tipsForWord", () => {
  it("explains the weakest sounds first, in Turkish", () => {
    const word = parsePronunciation(response, "en-US")!.words[1];
    const tips = tipsForWord(word);
    expect(tips.map((t) => t.phoneme)).toEqual(["θ", "ŋ"]);
    expect(tips[0].tip).toContain("dil ucunu");
  });

  it("flags devoiced final consonants", () => {
    const tips = tipsForWord({
      word: "bad",
      accuracy: 50,
      errorType: "Mispronunciation",
      phonemes: [
        { phoneme: "b", accuracy: 95 },
        { phoneme: "æ", accuracy: 90 },
        { phoneme: "d", accuracy: 20 },
      ],
    });
    expect(tips[0].tip).toContain("sertleşir");
  });

  it("stays silent when every sound is fine", () => {
    expect(
      tipsForWord({
        word: "hi",
        accuracy: 98,
        errorType: "None",
        phonemes: [{ phoneme: "h", accuracy: 98 }],
      }),
    ).toEqual([]);
  });
});

describe("practice catalog", () => {
  it("has unique keys, Turkish meanings and short sentences", () => {
    const sentences = PRACTICE_SETS.flatMap((s) => s.sentences);
    expect(new Set(sentences.map((s) => s.key)).size).toBe(sentences.length);
    for (const sentence of sentences) {
      expect(sentence.meaningTr.length).toBeGreaterThan(5);
      expect(sentence.text.length).toBeLessThanOrEqual(200);
      expect(findPracticeSentence(sentence.key)).toBe(sentence);
    }
  });
});
