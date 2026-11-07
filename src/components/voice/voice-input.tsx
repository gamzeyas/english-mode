"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { postForm } from "@/lib/api/client";
import {
  canRecordAudio,
  pickRecorderMimeType,
  MIN_ACTIVE_SECONDS,
  toWav16k,
} from "@/lib/audio/recorder";
import { MAX_RECORDING_SECONDS } from "@/lib/audio/wav";
import { Button } from "@/components/ui/button";

type Phase = "idle" | "starting" | "recording" | "processing";

type TranscribeResult = {
  transcript: string;
  durationSeconds: number;
  confidence: number | null;
};

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const SILENT_MIC_MESSAGE =
  "Mikrofondan ses gelmiyor. Tarayıcıda doğru mikrofonun seçili olduğunu kontrol et (adres çubuğundaki site ayarları → Mikrofon; iPhone mikrofonu seçiliyse Mac'in kendi mikrofonunu seç). Mac'te ayrıca Sistem Ayarları → Gizlilik ve Güvenlik → Mikrofon'da tarayıcıya izin ver.";

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
 * Record → transcribe → hand the text back for the learner to correct
 * (PRD §10 phase 1). Mic tracks are always released on stop and unmount.
 */
export function VoiceInput({
  onTranscript,
  sessionId,
  disabled,
  className,
  statusPlacement = "inline",
}: {
  onTranscript: (text: string) => void;
  sessionId?: string;
  disabled?: boolean;
  className?: string;
  /** "above" floats status/errors over the button (tight composer rows). */
  statusPlacement?: "inline" | "above";
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

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

  async function upload(recording: Blob) {
    setPhase("processing");
    try {
      const { wav, activeSeconds } = await toWav16k(recording);
      if (activeSeconds < MIN_ACTIVE_SECONDS) {
        // Don't send silence to Azure; the cause is local (OS permission/device).
        setError(SILENT_MIC_MESSAGE);
        return;
      }
      const form = new FormData();
      form.append("audio", wav, "recording.wav");
      if (sessionId) form.append("sessionId", sessionId);
      const result = await postForm<TranscribeResult>(
        "/api/audio/transcribe",
        form,
      );
      if (result.ok) onTranscript(result.data.transcript);
      else setError(result.error);
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
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
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
      void upload(new Blob(chunks, { type: media.mimeType }));
    };
    recorder.current = media;
    media.start();
    setElapsed(0);
    setPhase("recording");
    startedAt.current = Date.now();
    timer.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(seconds);
      if (seconds >= MAX_RECORDING_SECONDS) stop();
    }, 500);
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  if (!supported) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Bu tarayıcıda ses kaydı yok; yazarak devam et.
      </p>
    );
  }

  const recording = phase === "recording";
  const status = recording
    ? `● ${formatTime(elapsed)} / ${formatTime(MAX_RECORDING_SECONDS)}`
    : phase === "processing"
      ? "Yazıya çevriliyor…"
      : "";
  const above = statusPlacement === "above";
  return (
    <div
      className={cn(
        above ? "relative" : "flex flex-col items-start gap-1",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          above && "absolute bottom-full left-0 mb-2 w-72 flex-col items-start",
        )}
      >
        {above && (status || error) && (
          <div className="rounded-lg border bg-popover px-3 py-2 shadow-sm">
            <span aria-live="polite" className="block text-xs tabular-nums">
              {status}
            </span>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={recording ? "destructive" : "secondary"}
          className="size-12 shrink-0 rounded-full"
          onClick={recording ? stop : start}
          disabled={disabled || phase === "starting" || phase === "processing"}
          aria-pressed={recording}
          aria-label={
            recording
              ? `Stop recording (${formatTime(elapsed)})`
              : phase === "processing"
                ? "Transcribing"
                : "Record voice"
          }
        >
          {phase === "processing" || phase === "starting" ? (
            <Loader2 aria-hidden className="size-5 animate-spin" />
          ) : recording ? (
            <Square aria-hidden className="size-4" />
          ) : (
            <Mic aria-hidden className="size-5" />
          )}
        </Button>
        {!above && (
          <span
            aria-live="polite"
            className="text-xs text-muted-foreground tabular-nums"
          >
            {status}
          </span>
        )}
      </div>
      {!above && error && (
        <p role="alert" className="max-w-xs text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
