import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { encodeWav } from "@/lib/audio/wav";
import { transcribeWithAzure } from "@/lib/speech/azure";

/**
 * Real Azure call with a synthetic recording (macOS `say`, 16 kHz mono WAV).
 * Skipped until AZURE_SPEECH_KEY / AZURE_SPEECH_REGION are configured.
 */
const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;

describe.skipIf(!key || !region)("Azure fast transcription (real)", () => {
  it("transcribes the sample recording", async () => {
    const audio = new Blob([readFileSync("tests/fixtures/speech-sample.wav")], {
      type: "audio/wav",
    });
    const result = await transcribeWithAzure({
      key: key!,
      region: region!,
      endpoint: process.env.AZURE_SPEECH_ENDPOINT,
      audio,
      locale: "en-US",
    });
    console.info("[azure] transcript:", result.text, result.confidence);
    expect(result.text.toLowerCase()).toContain("creative agency");
    expect(result.text.toLowerCase()).toContain("techno");
    expect(result.durationMs).toBeGreaterThan(2000);
  });

  it("transcribes audio re-encoded by the browser WAV encoder", async () => {
    // Same samples, but written by encodeWav (the path real recordings take).
    const bytes = readFileSync("tests/fixtures/speech-sample.wav");
    const dataAt = bytes.indexOf("data") + 8;
    const pcm = new Int16Array(
      bytes.buffer.slice(
        bytes.byteOffset + dataAt,
        bytes.byteOffset + bytes.byteLength,
      ),
    );
    const samples = Float32Array.from(pcm, (s) => s / 0x8000);
    const result = await transcribeWithAzure({
      key: key!,
      region: region!,
      endpoint: process.env.AZURE_SPEECH_ENDPOINT,
      audio: new Blob([encodeWav(samples)], { type: "audio/wav" }),
      locale: "en-US",
    });
    expect(result.text.toLowerCase()).toContain("creative agency");
  });
});
