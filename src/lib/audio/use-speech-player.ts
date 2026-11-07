"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const NETWORK_ERROR = "Ses yüklenemedi. Bağlantını kontrol edip tekrar dene.";

/**
 * Plays server-synthesized speech. One audio element per player, so starting
 * a clip stops the previous one; clips are cached as object URLs for replay
 * (no second Azure call) and released on unmount.
 */
export function useSpeechPlayer() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const cache = useRef(new Map<string, string>());
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clips = cache.current;
    return () => {
      audio.current?.pause();
      for (const url of clips.values()) URL.revokeObjectURL(url);
      clips.clear();
    };
  }, []);

  const stop = useCallback(() => {
    audio.current?.pause();
    setPlaying(null);
  }, []);

  /** Fetches (or reuses) the clip for `key` and plays it. */
  const play = useCallback(
    async (key: string, url: string, body: unknown = {}) => {
      audio.current?.pause();
      setPlaying(null);
      setError(null);
      let src = cache.current.get(key);
      if (!src) {
        setLoading(key);
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!response.ok) {
            const json = await response.json().catch(() => null);
            setError(json?.error?.message ?? NETWORK_ERROR);
            return false;
          }
          src = URL.createObjectURL(await response.blob());
          cache.current.set(key, src);
        } catch {
          setError(NETWORK_ERROR);
          return false;
        } finally {
          setLoading(null);
        }
      }
      const element = (audio.current ??= new Audio());
      element.src = src;
      element.onended = () => setPlaying(null);
      try {
        await element.play();
        setPlaying(key);
        return true;
      } catch {
        // Autoplay blocked (no user gesture yet): the play button still works.
        return false;
      }
    },
    [],
  );

  return {
    play,
    stop,
    playing,
    loading,
    error,
    clearError: () => setError(null),
  };
}
