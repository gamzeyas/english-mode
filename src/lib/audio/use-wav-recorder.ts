"use client";

import { useEffect, useRef, useState } from "react";
import {
  canRecordAudio,
  MIN_ACTIVE_SECONDS,
  openMicrophone,
  pickRecorderMimeType,
  toWav16k,
} from "@/lib/audio/recorder";

export type RecorderPhase = "idle" | "starting" | "recording" | "processing";

export const SILENT_MIC_MESSAGE =
  "Mikrofondan ses gelmiyor. Settings → Microphone'dan doğru mikrofonu seç (ör. iPhone yerine MacBook mikrofonu). Mac'te Sistem Ayarları → Gizlilik ve Güvenlik → Mikrofon'da tarayıcıya izin verildiğini de kontrol et.";

function micErrorMessage(error: unknown): string {
  const name = (error as DOMException)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Mikrofon izni verilmedi. Yazarak devam edebilirsin; izni tarayıcı ayarlarından açabilirsin.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "Mikrofon bulunamadı. Yazarak devam edebilirsin.";
  if (name === "NotReadableError")
    return "Mikrofon başka bir uygulama tarafından kullanılıyor.";
  return "Kayıt başlatılamadı. Yazarak devam edebilirsin.";
}

/**
 * Mic → MediaRecorder → 16 kHz mono WAV. Hands the WAV to `onRecorded`
 * (which owns the upload) unless the recording is silent; mic tracks are
 * always released on stop and unmount. Auto-stops at `maxSeconds`.
 */
export function useWavRecorder({
  maxSeconds,
  onRecorded,
}: {
  maxSeconds: number;
  onRecorded: (wav: Blob) => Promise<void>;
}) {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  // The latest callback, so a recording started earlier uploads correctly.
  const handler = useRef(onRecorded);
  useEffect(() => {
    handler.current = onRecorded;
  });

  function release() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  useEffect(() => {
    const check = setTimeout(() => setSupported(canRecordAudio()));
    return () => {
      clearTimeout(check);
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      release();
    };
  }, []);

  async function finish(recording: Blob) {
    setPhase("processing");
    try {
      const { wav, activeSeconds } = await toWav16k(recording);
      // Don't send silence to Azure; the cause is local (OS permission/device).
      if (activeSeconds < MIN_ACTIVE_SECONDS) setError(SILENT_MIC_MESSAGE);
      else await handler.current(wav);
    } catch {
      setError("Kayıt işlenemedi. Tekrar dene ya da yazarak devam et.");
    } finally {
      setPhase("idle");
    }
  }

  async function start() {
    setError(null);
    if (!canRecordAudio()) {
      setSupported(false);
      return;
    }
    setPhase("starting");
    try {
      stream.current = await openMicrophone();
    } catch (micError) {
      release();
      setPhase("idle");
      setError(micErrorMessage(micError));
      return;
    }
    const mimeType = pickRecorderMimeType();
    const media = new MediaRecorder(
      stream.current,
      mimeType ? { mimeType } : undefined,
    );
    const chunks: Blob[] = [];
    media.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    media.onstop = () => {
      release();
      void finish(new Blob(chunks, { type: media.mimeType }));
    };
    recorder.current = media;
    media.start();
    setElapsed(0);
    setPhase("recording");
    startedAt.current = Date.now();
    timer.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(seconds);
      if (seconds >= maxSeconds) stop();
    }, 500);
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  return { phase, elapsed, error, setError, supported, start, stop };
}

export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
