import { encodeWav, TARGET_SAMPLE_RATE } from "@/lib/audio/wav";

/** Container the browser can record natively (Chrome: WebM, Safari: MP4). */
export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(
    (type) => MediaRecorder.isTypeSupported(type),
  );
}

export function canRecordAudio(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

/**
 * Peak below ~-46 dBFS: the mic delivered (near) silence. Typical when the OS
 * blocks the browser's microphone access or the wrong input device is
 * selected — getUserMedia still succeeds but every sample is ~0.
 */
export const SILENCE_PEAK = 0.005;

export function peakLevel(samples: Float32Array): number {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return peak;
}

/** Decodes any recorded container and resamples to 16 kHz mono WAV. */
export async function toWav16k(
  recording: Blob,
): Promise<{ wav: Blob; peak: number }> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(
      await recording.arrayBuffer(),
    );
    const frames = Math.max(
      1,
      Math.ceil(decoded.duration * TARGET_SAMPLE_RATE),
    );
    // A one-channel offline context down-mixes and resamples in one pass.
    const offline = new OfflineAudioContext(1, frames, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const samples = (await offline.startRendering()).getChannelData(0);
    return {
      wav: new Blob([encodeWav(samples)], { type: "audio/wav" }),
      peak: peakLevel(samples),
    };
  } finally {
    void context.close();
  }
}
