/**
 * Azure AI Speech "fast transcription" REST client (synchronous, short files).
 * Verified against learn.microsoft.com "Use the fast transcription API"
 * (api-version 2025-10-15): multipart fields `audio` + `definition`,
 * `Ocp-Apim-Subscription-Key` header. No SDK, no server-only imports, so the
 * integration test can call it directly.
 */
export const AZURE_STT_API_VERSION = "2025-10-15";

export class AzureSpeechError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(`Azure Speech request failed (${status}${code ? ` ${code}` : ""}).`);
    this.name = "AzureSpeechError";
  }
}

export type Transcription = {
  text: string;
  durationMs: number;
  /** Mean phrase confidence (0..1), when the service returns it. */
  confidence: number | null;
};

type FastTranscriptionResponse = {
  durationMilliseconds?: number;
  combinedPhrases?: { text?: string }[];
  phrases?: { text?: string; confidence?: number }[];
};

export function parseFastTranscription(
  json: FastTranscriptionResponse,
): Transcription {
  const text = (json.combinedPhrases ?? [])
    .map((p) => p.text?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  const scores = (json.phrases ?? [])
    .map((p) => p.confidence)
    .filter((c): c is number => typeof c === "number");
  return {
    text,
    durationMs: json.durationMilliseconds ?? 0,
    confidence: scores.length
      ? scores.reduce((sum, c) => sum + c, 0) / scores.length
      : null,
  };
}

export function azureSttEndpoint(region: string, endpoint?: string) {
  const base = (
    endpoint ?? `https://${region}.api.cognitive.microsoft.com`
  ).replace(/\/+$/, "");
  return `${base}/speechtotext/transcriptions:transcribe?api-version=${AZURE_STT_API_VERSION}`;
}

export async function transcribeWithAzure(input: {
  key: string;
  region: string;
  endpoint?: string;
  audio: Blob;
  locale: "en-US" | "en-GB";
  signal?: AbortSignal;
}): Promise<Transcription> {
  const form = new FormData();
  form.append("audio", input.audio, "recording.wav");
  form.append(
    "definition",
    // Verbatim matters for a coach: keep the learner's words unmasked.
    JSON.stringify({ locales: [input.locale], profanityFilterMode: "None" }),
  );
  const response = await fetch(azureSttEndpoint(input.region, input.endpoint), {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": input.key },
    body: form,
    signal: input.signal ?? AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string };
      code?: string;
    } | null;
    throw new AzureSpeechError(
      response.status,
      body?.error?.code ?? body?.code ?? null,
    );
  }
  return parseFastTranscription(await response.json());
}
