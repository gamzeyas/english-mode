import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { encodeWav, parseWav, TARGET_SAMPLE_RATE } from "@/lib/audio/wav";
import {
  AZURE_STT_API_VERSION,
  azureSttEndpoint,
  parseFastTranscription,
} from "@/lib/speech/azure";

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  new Uint8Array(bytes).buffer;

describe("WAV encoding and validation", () => {
  it("round-trips 16 kHz mono PCM", () => {
    const samples = new Float32Array(TARGET_SAMPLE_RATE * 2).map((_, i) =>
      Math.sin(i / 10),
    );
    const info = parseWav(encodeWav(samples));
    expect(info).toEqual({
      sampleRate: 16_000,
      channels: 1,
      bitsPerSample: 16,
      durationSeconds: 2,
    });
  });

  it("clamps samples outside -1..1", () => {
    const view = new DataView(encodeWav(new Float32Array([2, -2])));
    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(-0x8000);
  });

  it("walks extra chunks written by other encoders", () => {
    const fixture = readFileSync("tests/fixtures/speech-sample.wav");
    const info = parseWav(toArrayBuffer(fixture));
    expect(info?.sampleRate).toBe(16_000);
    expect(info?.channels).toBe(1);
    expect(info?.durationSeconds).toBeGreaterThan(2);
  });

  it("rejects non-WAV data", () => {
    expect(parseWav(new TextEncoder().encode("x".repeat(100)).buffer)).toBe(
      null,
    );
    expect(parseWav(new ArrayBuffer(10))).toBe(null);
  });
});

describe("Azure fast transcription", () => {
  it("builds the regional endpoint with the pinned API version", () => {
    expect(azureSttEndpoint("westeurope")).toBe(
      `https://westeurope.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=${AZURE_STT_API_VERSION}`,
    );
    expect(
      azureSttEndpoint("x", "https://my-res.cognitiveservices.azure.com/"),
    ).toMatch(/^https:\/\/my-res\.cognitiveservices\.azure\.com\/speechtotext/);
  });

  it("joins combined phrases and averages confidence", () => {
    expect(
      parseFastTranscription({
        durationMilliseconds: 4200,
        combinedPhrases: [{ text: "I work worked at an agency." }],
        phrases: [{ confidence: 0.9 }, { confidence: 0.7 }],
      }),
    ).toEqual({
      text: "I work worked at an agency.",
      durationMs: 4200,
      confidence: 0.8,
    });
    expect(parseFastTranscription({})).toEqual({
      text: "",
      durationMs: 0,
      confidence: null,
    });
  });
});
