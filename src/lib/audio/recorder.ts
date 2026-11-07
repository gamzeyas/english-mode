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

const WINDOW_SECONDS = 0.02;
/** 20 ms windows quieter than ~-50 dBFS RMS count as silence. */
const ACTIVE_RMS = 0.003;
/** Less than 0.3 s of signal in total: nothing the learner said got through. */
export const MIN_ACTIVE_SECONDS = 0.3;

/**
 * Seconds of the recording that carry signal. Near zero when the OS blocks
 * the browser's microphone or the wrong input is selected (e.g. a Continuity
 * iPhone mic): getUserMedia succeeds but the samples are ~0, apart from the
 * odd click — which is why a single peak is not enough.
 */
export function activeSeconds(
  samples: Float32Array,
  sampleRate = TARGET_SAMPLE_RATE,
): number {
  const size = Math.round(sampleRate * WINDOW_SECONDS);
  let active = 0;
  for (let start = 0; start + size <= samples.length; start += size) {
    let sum = 0;
    for (let i = start; i < start + size; i++) sum += samples[i] * samples[i];
    if (Math.sqrt(sum / size) >= ACTIVE_RMS) active++;
  }
  return active * WINDOW_SECONDS;
}

/** Decodes any recorded container and resamples to 16 kHz mono WAV. */
export async function toWav16k(
  recording: Blob,
): Promise<{ wav: Blob; activeSeconds: number }> {
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
      activeSeconds: activeSeconds(samples),
    };
  } finally {
    void context.close();
  }
}
