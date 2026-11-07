"use client";

import { useEffect, useState } from "react";
import { postJson } from "@/lib/api/client";

/**
 * Turkish meaning under a coach turn. Uses the stored translation when the
 * page already has it; otherwise asks the server once (which stores it).
 */
export function CoachTranslation({
  messageId,
  initial,
}: {
  messageId: string;
  initial: string | null | undefined;
}) {
  const [text, setText] = useState(initial ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    void postJson<{ textTr: string }>(
      `/api/messages/${messageId}/translation`,
    ).then((result) => {
      if (cancelled) return;
      if (result.ok) setText(result.data.textTr);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [messageId, initial]);

  if (failed) return null;
  return (
    <p
      lang="tr"
      aria-live="polite"
      className="max-w-[85%] px-1 text-sm leading-snug text-muted-foreground"
    >
      {text ?? <span className="animate-pulse">Türkçesi hazırlanıyor…</span>}
    </p>
  );
}
