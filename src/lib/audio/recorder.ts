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

/** Decodes any recorded container and resamples to 16 kHz mono WAV. */
export async function toWav16k(recording: Blob): Promise<Blob> {
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
    const rendered = await offline.startRendering();
    return new Blob([encodeWav(rendered.getChannelData(0))], {
      type: "audio/wav",
    });
  } finally {
    void context.close();
  }
}
