import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { activeSeconds, MIN_ACTIVE_SECONDS } from "@/lib/audio/recorder";
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

describe("activeSeconds", () => {
  it("rejects silence with a stray click (wrong input device)", () => {
    const silent = new Float32Array(TARGET_SAMPLE_RATE * 4);
    silent.fill(0.33, 20_000, 20_040); // a 2.5 ms click
    expect(activeSeconds(silent)).toBeLessThan(MIN_ACTIVE_SECONDS);
  });

  it("accepts real speech", () => {
    const bytes = readFileSync("tests/fixtures/speech-sample.wav");
    const dataAt = bytes.indexOf("data") + 8;
    const pcm = new Int16Array(
      bytes.buffer.slice(
        bytes.byteOffset + dataAt,
        bytes.byteOffset + bytes.byteLength,
      ),
    );
    const samples = Float32Array.from(pcm, (s) => s / 0x8000);
    expect(activeSeconds(samples)).toBeGreaterThan(1);
  });

  it("accepts quiet but continuous speech-level signal", () => {
    const quiet = Float32Array.from(
      { length: TARGET_SAMPLE_RATE },
      (_, i) => Math.sin(i / 3) * 0.01,
    );
    expect(activeSeconds(quiet)).toBeGreaterThan(0.9);
  });
});
