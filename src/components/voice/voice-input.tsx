"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { postForm } from "@/lib/api/client";
import { formatTime, useWavRecorder } from "@/lib/audio/use-wav-recorder";
import { MAX_RECORDING_SECONDS } from "@/lib/audio/wav";
import { Button } from "@/components/ui/button";

type TranscribeResult = {
  transcript: string;
  durationSeconds: number;
  confidence: number | null;
};

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
  const { phase, elapsed, error, setError, supported, start, stop } =
    useWavRecorder({
      maxSeconds: MAX_RECORDING_SECONDS,
      onRecorded: async (wav) => {
        const form = new FormData();
        form.append("audio", wav, "recording.wav");
        if (sessionId) form.append("sessionId", sessionId);
        const result = await postForm<TranscribeResult>(
          "/api/audio/transcribe",
          form,
        );
        if (result.ok) onTranscript(result.data.transcript);
        else setError(result.error);
      },
    });

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
