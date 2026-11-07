"use client";

import { useState } from "react";
import { Lightbulb, Loader2, Plus, X } from "lucide-react";
import { postJson } from "@/lib/api/client";
import type { Hints } from "@/lib/assist/schema";
import { Button } from "@/components/ui/button";

/**
 * "Hint" for the coach's latest turn: an idea in Turkish, sentence frames
 * with an example, and useful words. Tapping one adds it to the draft, so
 * the learner still builds the answer themselves.
 */
export function ConversationHints({
  sessionId,
  lastCoachMessageId,
  disabled,
  onUse,
}: {
  sessionId: string;
  /** Hints belong to this coach turn; a new turn needs new hints. */
  lastCoachMessageId: string | null;
  disabled?: boolean;
  onUse: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = useState<{ forId: string; hints: Hints } | null>(
    null,
  );
  const hints =
    cache && cache.forId === lastCoachMessageId ? cache.hints : null;

  async function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    setError(null);
    if (hints || !lastCoachMessageId) return;
    setLoading(true);
    const result = await postJson<{ hints: Hints }>(
      `/api/sessions/${sessionId}/hints`,
    );
    setLoading(false);
    if (!result.ok) return setError(result.error);
    setCache({ forId: lastCoachMessageId, hints: result.data.hints });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={open ? "secondary" : "ghost"}
        className="h-10 px-3 text-sm"
        aria-expanded={open}
        aria-controls="conversation-hints"
        onClick={toggle}
        disabled={disabled || !lastCoachMessageId}
      >
        <Lightbulb aria-hidden /> İpucu
      </Button>

      {open && (
        <div
          id="conversation-hints"
          className="max-h-[45dvh] space-y-3 overflow-y-auto rounded-xl border bg-card p-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <p className="flex-1 font-medium">Cevabın için fikirler</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label="Close hints"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden />
            </Button>
          </div>
          {loading && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Öneriler hazırlanıyor…
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {hints && (
            <>
              {hints.idea_tr && (
                <p lang="tr" className="text-muted-foreground">
                  {hints.idea_tr}
                </p>
              )}
              {hints.patterns.length > 0 && (
                <section aria-label="Sentence patterns" className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase">
                    Cümle kalıpları
                  </h3>
                  <ul className="space-y-2">
                    {hints.patterns.map((pattern) => (
                      <li
                        key={pattern.pattern}
                        className="rounded-lg border px-3 py-2"
                      >
                        <p lang="en" className="font-medium">
                          {pattern.pattern}
                        </p>
                        <button
                          type="button"
                          className="mt-1 flex min-h-9 w-full items-start gap-2 rounded-md text-left text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          onClick={() => onUse(pattern.example)}
                          aria-label={`Use: ${pattern.example}`}
                        >
                          <Plus
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0"
                          />
                          <span lang="en">{pattern.example}</span>
                        </button>
                        <p lang="tr" className="text-xs text-muted-foreground">
                          {pattern.tr}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {hints.words.length > 0 && (
                <section aria-label="Useful words" className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase">
                    Kelimeler
                  </h3>
                  <ul className="flex flex-wrap gap-2">
                    {hints.words.map((word) => (
                      <li key={word.word}>
                        <button
                          type="button"
                          className="flex min-h-10 flex-col items-start rounded-lg border px-3 py-1 text-left hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          onClick={() => onUse(word.word)}
                          aria-label={`Use: ${word.word}`}
                        >
                          <span lang="en" className="font-medium">
                            {word.word}
                          </span>
                          <span
                            lang="tr"
                            className="text-xs text-muted-foreground"
                          >
                            {word.tr}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
