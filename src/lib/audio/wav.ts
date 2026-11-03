/**
 * Recordings are normalised in the browser to 16 kHz mono 16-bit PCM WAV:
 * every browser can produce it and every speech provider accepts it, so the
 * server only has to validate one format (PRD §9 MIME/size/duration checks).
 */
export const TARGET_SAMPLE_RATE = 16_000;
export const MAX_RECORDING_SECONDS = 120;
export const MIN_RECORDING_SECONDS = 0.5;
const BYTES_PER_SECOND = TARGET_SAMPLE_RATE * 2;
export const MAX_WAV_BYTES =
  44 + Math.ceil((MAX_RECORDING_SECONDS + 2) * BYTES_PER_SECOND);

/** Encodes mono float samples (-1..1) as 16-bit PCM WAV. */
export function encodeWav(
  samples: Float32Array,
  sampleRate = TARGET_SAMPLE_RATE,
): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++)
      view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export type WavInfo = {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationSeconds: number;
};

/**
 * Validates a PCM WAV header and returns its duration. Walks the chunk list,
 * so files with extra chunks (e.g. LIST) from other encoders still parse.
 */
export function parseWav(bytes: ArrayBuffer): WavInfo | null {
  if (bytes.byteLength < 44) return null;
  const view = new DataView(bytes);
  const tag = (offset: number) =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;

  let offset = 12;
  let format: Omit<WavInfo, "durationSeconds"> | null = null;
  let audioFormat = 0;
  while (offset + 8 <= bytes.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt " && body + 16 <= bytes.byteLength) {
      audioFormat = view.getUint16(body, true);
      format = {
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === "data" && format) {
      if (audioFormat !== 1 || format.sampleRate === 0) return null;
      const available = Math.min(size, bytes.byteLength - body);
      const bytesPerSecond =
        format.sampleRate * format.channels * (format.bitsPerSample / 8);
      return { ...format, durationSeconds: available / bytesPerSecond };
    }
    offset = body + size + (size % 2);
  }
  return null;
}
