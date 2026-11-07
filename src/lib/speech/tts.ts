/**
 * Azure neural text to speech over REST (PRD §10, M7a). Pure helpers so the
 * SSML can be unit-tested; the key is passed in by server code only.
 * Docs: learn.microsoft.com/azure/ai-services/speech-service/rest-text-to-speech
 */
export type Dialect = "en-US" | "en-GB";
export type Speaker = "a" | "b";
export type SpeechRate = "slow" | "normal";

/** Two GA neural voices per variety, so dialogues have distinct speakers. */
export const VOICES: Record<Dialect, Record<Speaker, string>> = {
  "en-US": { a: "en-US-JennyNeural", b: "en-US-GuyNeural" },
  "en-GB": { a: "en-GB-SoniaNeural", b: "en-GB-RyanNeural" },
};

export const TTS_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
export const TTS_MIME_TYPE = "audio/mpeg";
/** Cap per request: a coach turn or one listening item, not a monologue. */
export const MAX_TTS_CHARS = 2500;

const RATES: Record<SpeechRate, string> = { slow: "-25%", normal: "0%" };

export type SpeechSegment = { speaker: Speaker; text: string };

export class AzureTtsError extends Error {
  constructor(
    readonly status: number,
    message = `Azure text to speech failed (${status})`,
  ) {
    super(message);
  }
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** One <voice> per segment; a short pause separates dialogue turns. */
export function buildSsml(
  segments: SpeechSegment[],
  { dialect, rate }: { dialect: Dialect; rate: SpeechRate },
): string {
  const body = segments
    .filter((segment) => segment.text.trim())
    .map(
      (segment) =>
        `<voice name="${VOICES[dialect][segment.speaker]}"><prosody rate="${RATES[rate]}">${escapeXml(segment.text.trim())}</prosody><break time="400ms"/></voice>`,
    )
    .join("");
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${dialect}">${body}</speak>`;
}

/** Characters billed by Azure: the spoken text, not the SSML markup. */
export const billedCharacters = (segments: SpeechSegment[]) =>
  segments.reduce((total, segment) => total + segment.text.trim().length, 0);

export function azureTtsEndpoint(region: string): string {
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

export async function synthesizeWithAzure(input: {
  key: string;
  region: string;
  ssml: string;
  signal?: AbortSignal;
}): Promise<ArrayBuffer> {
  const response = await fetch(azureTtsEndpoint(input.region), {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": input.key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": TTS_OUTPUT_FORMAT,
      "User-Agent": "english-mode",
    },
    body: input.ssml,
    signal: input.signal ?? AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new AzureTtsError(response.status);
  const audio = await response.arrayBuffer();
  if (audio.byteLength === 0) throw new AzureTtsError(502, "Empty audio");
  return audio;
}
