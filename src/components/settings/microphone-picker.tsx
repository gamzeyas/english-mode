"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import {
  canRecordAudio,
  matchPreferredMic,
  openMicrophone,
  setPreferredMic,
} from "@/lib/audio/recorder";
import { Button } from "@/components/ui/button";

type Device = { deviceId: string; label: string };

const TEST_SECONDS = 10;

/**
 * Lets the learner choose the recording input and check its level. Browsers
 * can silently pick a device that hears nothing (e.g. a Continuity iPhone
 * mic), and their own settings are hard to find.
 */
export function MicrophonePicker() {
  const [supported, setSupported] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState("");
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef<(() => void) | null>(null);

  async function loadDevices() {
    const all = await navigator.mediaDevices.enumerateDevices();
    // Labels stay empty until the site has microphone permission.
    const inputs = all
      .filter(
        (d) =>
          d.kind === "audioinput" &&
          d.label &&
          d.deviceId !== "default" &&
          d.deviceId !== "communications",
      )
      .map((d) => ({ deviceId: d.deviceId, label: d.label }));
    setDevices(inputs);
    // Set the value only once its option exists, or the select shows the
    // default; a remembered device that is gone falls back to the default.
    setSelected(matchPreferredMic(inputs) ?? "");
  }

  useEffect(() => {
    const init = setTimeout(() => {
      if (!canRecordAudio()) return setSupported(false);
      void loadDevices();
    });
    const media = navigator.mediaDevices;
    const onChange = () => void loadDevices();
    media?.addEventListener("devicechange", onChange);
    return () => {
      clearTimeout(init);
      media?.removeEventListener("devicechange", onChange);
      stop.current?.();
    };
  }, []);

  async function test() {
    setError(null);
    setHeard(false);
    let stream: MediaStream;
    try {
      stream = await openMicrophone();
    } catch {
      setError("Mikrofon açılamadı. Tarayıcının mikrofon iznini kontrol et.");
      return;
    }
    await loadDevices(); // permission granted now, so labels are available
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let frame = 0;
    const timeout = setTimeout(() => stop.current?.(), TEST_SECONDS * 1000);

    stop.current = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
      stop.current = null;
      setTesting(false);
      setLevel(0);
    };
    const tick = () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const rms = Math.sqrt(sum / samples.length);
      // ~-60 dBFS → 0 %, ~-10 dBFS → 100 %.
      const db = 20 * Math.log10(rms || 1e-6);
      setLevel(Math.max(0, Math.min(1, (db + 60) / 50)));
      if (rms > 0.01) setHeard(true);
      frame = requestAnimationFrame(tick);
    };
    setTesting(true);
    tick();
  }

  function choose(id: string) {
    stop.current?.();
    setSelected(id);
    const device = devices.find((d) => d.deviceId === id);
    setPreferredMic(device ? { id, label: device.label } : null);
  }

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Bu tarayıcı ses kaydını desteklemiyor.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {devices.length > 0 ? (
        <div className="space-y-1">
          <label htmlFor="mic-device" className="text-sm font-medium">
            Microphone
          </label>
          <select
            id="mic-device"
            value={selected}
            onChange={(event) => choose(event.target.value)}
            className="h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="">Tarayıcı varsayılanı</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Mikrofonları listelemek için bir kez test et; tarayıcı izin
          isteyebilir.
        </p>
      )}

      <div className="flex items-center gap-3">
        {testing ? (
          <Button
            variant="outline"
            className="h-11"
            onClick={() => stop.current?.()}
          >
            <Square aria-hidden /> Stop test
          </Button>
        ) : (
          <Button variant="outline" className="h-11" onClick={test}>
            <Mic aria-hidden /> Test microphone
          </Button>
        )}
        <div
          role="meter"
          aria-label="Microphone level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level * 100)}
          className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"
        >
          <div
            className="h-full bg-primary transition-[width] duration-75"
            style={{ width: `${level * 100}%` }}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {testing
          ? heard
            ? "Sesin geliyor 👍"
            : "Konuş; çubuk hareket etmeli. Hareket etmiyorsa başka bir mikrofon seç."
          : heard
            ? "Bu mikrofon çalışıyor. Seçimin bu tarayıcıda hatırlanır."
            : ""}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
