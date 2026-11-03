import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
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
});
