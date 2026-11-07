/**
 * Azure pronunciation assessment over the REST API for short audio (PRD
 * F5, §10). Scripted mode: the learner reads a known reference text, which
 * gives reliable word/phoneme alignment. Prosody exists only for en-US; for
 * other locales it is reported as unavailable, never as zero.
 * Docs: learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text-short
 */
export const MAX_ASSESSMENT_SECONDS = 30;
export const MAX_REFERENCE_CHARS = 200;
export const PRONUNCIATION_ASSESSOR = "azure-pa-rest-2026-11";

export type WordErrorType =
  | "None"
  | "Mispronunciation"
  | "Omission"
  | "Insertion"
  | "UnexpectedBreak"
  | "MissingBreak"
  | "Monotone";

export type PronunciationWord = {
  word: string;
  /** null for omitted words (never spoken, so not scored). */
  accuracy: number | null;
  errorType: WordErrorType;
  phonemes: { phoneme: string; accuracy: number }[];
};

export type PronunciationResult = {
  recognized: string;
  scores: {
    pronunciation: number;
    accuracy: number;
    fluency: number;
    completeness: number;
    /** null when the locale has no prosody model (anything but en-US). */
    prosody: number | null;
  };
  words: PronunciationWord[];
  /** The whole utterance was flagged as flat intonation. */
  monotone: boolean;
};

export class AzurePronunciationError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`Azure pronunciation assessment failed (${status} ${code})`);
  }
}

export const prosodySupported = (locale: string) => locale === "en-US";

export function assessmentHeader(referenceText: string, locale: string) {
  const params: Record<string, string> = {
    ReferenceText: referenceText,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableMiscue: "True",
    PhonemeAlphabet: "IPA",
  };
  if (prosodySupported(locale)) params.EnableProsodyAssessment = "True";
  return Buffer.from(JSON.stringify(params), "utf8").toString("base64");
}

type Scored = {
  AccuracyScore?: number;
  FluencyScore?: number;
  CompletenessScore?: number;
  ProsodyScore?: number;
  PronScore?: number;
  ErrorType?: string;
};
// Scores sit on the item itself or under PronunciationAssessment,
// depending on the API surface; accept both.
const scoresOf = (item: Scored & { PronunciationAssessment?: Scored }) =>
  item.PronunciationAssessment ?? item;

const round = (value: number | undefined) => Math.round((value ?? 0) * 10) / 10;

const ERROR_TYPES = new Set<WordErrorType>([
  "None",
  "Mispronunciation",
  "Omission",
  "Insertion",
  "UnexpectedBreak",
  "MissingBreak",
  "Monotone",
]);

type RawWord = Scored & {
  Word: string;
  PronunciationAssessment?: Scored;
  Phonemes?: (Scored & { Phoneme: string; PronunciationAssessment?: Scored })[];
  Feedback?: {
    Prosody?: {
      Break?: { ErrorTypes?: string[] };
      Intonation?: { ErrorTypes?: string[] };
    };
  };
};

/** Normalises the detailed REST response; null when nothing was recognised. */
export function parsePronunciation(
  json: unknown,
  locale: string,
): PronunciationResult | null {
  const body = json as {
    RecognitionStatus?: string;
    NBest?: (Scored & {
      Display?: string;
      PronunciationAssessment?: Scored;
      Words?: RawWord[];
    })[];
  };
  const best = body.NBest?.[0];
  if (body.RecognitionStatus !== "Success" || !best) return null;
  const overall = scoresOf(best);
  let monotone = false;

  const words = (best.Words ?? []).map((raw): PronunciationWord => {
    const scores = scoresOf(raw);
    const prosody = raw.Feedback?.Prosody;
    if (prosody?.Intonation?.ErrorTypes?.includes("Monotone")) monotone = true;
    const breakError = prosody?.Break?.ErrorTypes?.find((t) => t !== "None");
    const reported = (scores.ErrorType ?? "None") as WordErrorType;
    const errorType: WordErrorType = !ERROR_TYPES.has(reported)
      ? "None"
      : reported === "None" &&
          breakError &&
          ERROR_TYPES.has(breakError as WordErrorType)
        ? (breakError as WordErrorType)
        : reported;
    return {
      word: raw.Word,
      accuracy: errorType === "Omission" ? null : round(scores.AccuracyScore),
      errorType,
      // en-GB scores phonemes but leaves their names empty: an unlabeled
      // score can't be explained, so only named sounds are kept.
      phonemes: (raw.Phonemes ?? [])
        .filter((p) => p.Phoneme)
        .map((p) => ({
          phoneme: p.Phoneme,
          accuracy: round(scoresOf(p).AccuracyScore),
        })),
    };
  });

  return {
    recognized: best.Display ?? "",
    scores: {
      pronunciation: round(overall.PronScore),
      accuracy: round(overall.AccuracyScore),
      fluency: round(overall.FluencyScore),
      completeness: round(overall.CompletenessScore),
      prosody:
        prosodySupported(locale) && overall.ProsodyScore !== undefined
          ? round(overall.ProsodyScore)
          : null,
    },
    words,
    monotone,
  };
}

export function azurePronunciationEndpoint(region: string, locale: string) {
  const url = new URL(
    `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
  );
  url.searchParams.set("language", locale);
  url.searchParams.set("format", "detailed");
  return url.toString();
}

export async function assessWithAzure(input: {
  key: string;
  region: string;
  audio: ArrayBuffer;
  referenceText: string;
  locale: "en-US" | "en-GB";
  signal?: AbortSignal;
}): Promise<PronunciationResult | null> {
  const response = await fetch(
    azurePronunciationEndpoint(input.region, input.locale),
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": input.key,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        Accept: "application/json",
        "Pronunciation-Assessment": assessmentHeader(
          input.referenceText,
          input.locale,
        ),
      },
      body: input.audio,
      signal: input.signal ?? AbortSignal.timeout(45_000),
    },
  );
  if (!response.ok) {
    throw new AzurePronunciationError(response.status, String(response.status));
  }
  return parsePronunciation(await response.json(), input.locale);
}
