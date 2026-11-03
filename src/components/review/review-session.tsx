"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  MessageSquareText,
  PartyPopper,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson, postJson } from "@/lib/api/client";
import { formatInterval, GRADES, type Grade } from "@/lib/srs/grades";
import type { ReviewCard } from "@/lib/review/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Queue = { cards: ReviewCard[]; newAllowance: number; newWaiting: number };
type Reveal = {
  phrase: string;
  example: string | null;
  match: "exact" | "partial" | "none";
  now: string;
  dueByGrade: Record<Grade, string>;
};
type Evaluation = {
  suggestedGrade: Grade;
  conveysMeaning: boolean;
  commentTr: string;
  betterVersion: string;
};

const matchCopy: Record<Reveal["match"], { label: string; className: string }> =
  {
    exact: {
      label: "Matches the phrase",
      className: "bg-success/15 text-success",
    },
    partial: {
      label: "Partly matches",
      className: "bg-primary/15 text-primary",
    },
    none: {
      label: "Different wording",
      className: "bg-secondary text-muted-foreground",
    },
  };

export function ReviewSession() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const loaded = useRef(false);

  function load() {
    void getJson<Queue>("/api/review/due").then((result) => {
      if (result.ok) {
        setQueue(result.data);
        setIndex(0);
        setLoadError(null);
      } else setLoadError(result.error);
    });
  }

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    load();
  }, []);

  if (loadError) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-6 text-sm">
          <p role="alert" className="text-destructive">
            {loadError}
          </p>
          <Button variant="outline" className="h-11" onClick={load}>
            <RotateCcw aria-hidden /> Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!queue) {
    return (
      <p
        className="flex items-center gap-2 text-sm text-muted-foreground"
        aria-live="polite"
      >
        <Loader2 aria-hidden className="size-4 animate-spin" /> Loading your due
        phrases…
      </p>
    );
  }

  const card = queue.cards[index];
  if (!card) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-4 py-8">
          <PartyPopper aria-hidden className="size-8 text-primary" />
          <div className="space-y-1">
            <h2 className="font-heading text-lg font-semibold">
              {reviewed > 0
                ? `Done — ${reviewed} reviewed.`
                : "Nothing due right now."}
            </h2>
            <p className="text-sm text-muted-foreground">
              {queue.newWaiting > 0
                ? `Bugünkü yeni kart sınırına ulaştın; ${queue.newWaiting} yeni ifade yarın sıraya girecek.`
                : "Sıradaki tekrarlar zamanı gelince burada olacak."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="h-11">
              <Link href="/conversation/new">Start a conversation</Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/learning-pool">Open learning pool</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Card {index + 1} of {queue.cards.length}
      </p>
      <ReviewCardView
        key={card.id}
        card={card}
        onDone={() => {
          setReviewed((n) => n + 1);
          setIndex((i) => i + 1);
        }}
        onConflict={load}
      />
    </div>
  );
}

function ReviewCardView({
  card,
  onDone,
  onConflict,
}: {
  card: ReviewCard;
  onDone: () => void;
  onConflict: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [busy, setBusy] = useState<"reveal" | "evaluate" | Grade | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One id per card attempt: retries of the same grade are idempotent.
  const [requestId] = useState(() => crypto.randomUUID());

  async function doReveal() {
    setBusy("reveal");
    setError(null);
    const result = await postJson<Reveal>(`/api/review/${card.id}/reveal`, {
      answer,
    });
    setBusy(null);
    if (result.ok) setReveal(result.data);
    else setError(result.error);
  }

  async function doEvaluate() {
    setBusy("evaluate");
    setError(null);
    const result = await postJson<Evaluation>(
      `/api/review/${card.id}/evaluate`,
      { answer },
    );
    setBusy(null);
    if (result.ok) setEvaluation(result.data);
    else setError(result.error);
  }

  async function grade(value: Grade) {
    setBusy(value);
    setError(null);
    const result = await postJson(`/api/review/${card.id}/grade`, {
      grade: value,
      answer,
      clientRequestId: requestId,
      aiSuggestedGrade: evaluation?.suggestedGrade ?? null,
    });
    setBusy(null);
    if (result.ok) onDone();
    else if (result.code === "conflict") onConflict();
    else setError(result.error);
  }

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap gap-2">
          {card.isNew && <Badge variant="secondary">New</Badge>}
        </div>
        <CardTitle>
          <h2 className="text-lg font-semibold">Say it in English</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3 rounded-xl bg-secondary/50 p-4">
          {card.meaningTr && (
            <p lang="tr" className="text-base font-medium">
              {card.meaningTr}
            </p>
          )}
          {card.cloze && (
            <p className="text-sm text-muted-foreground italic">
              “{card.cloze}”
            </p>
          )}
          {!card.meaningTr && !card.cloze && card.sourceContext && (
            <p className="text-sm text-muted-foreground">
              {card.sourceContext}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor={`answer-${card.id}`} className="text-sm font-medium">
            Your answer
          </label>
          <Textarea
            id={`answer-${card.id}`}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={!!reveal}
            maxLength={2000}
            rows={2}
            placeholder="Write a full sentence using the expression…"
            className="min-h-16 text-[0.95rem]"
          />
        </div>

        {!reveal ? (
          <Button
            onClick={doReveal}
            disabled={busy === "reveal"}
            className="h-11"
          >
            {busy === "reveal" ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <CheckCircle2 aria-hidden />
            )}
            {answer.trim() ? "Check answer" : "Show answer"}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold">{reveal.phrase}</p>
                {answer.trim() && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-transparent",
                      matchCopy[reveal.match].className,
                    )}
                  >
                    {matchCopy[reveal.match].label}
                  </Badge>
                )}
              </div>
              {reveal.example && (
                <p className="text-sm italic">“{reveal.example}”</p>
              )}
            </div>

            {answer.trim() && !evaluation && (
              <Button
                variant="outline"
                className="h-10"
                onClick={doEvaluate}
                disabled={busy === "evaluate"}
              >
                {busy === "evaluate" ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : (
                  <MessageSquareText aria-hidden />
                )}
                Ask the coach (optional)
              </Button>
            )}
            {evaluation && (
              <div className="space-y-1 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                <p lang="tr">{evaluation.commentTr}</p>
                {evaluation.betterVersion && (
                  <p className="text-muted-foreground italic">
                    “{evaluation.betterVersion}”
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Coach suggests: {GRADES[evaluation.suggestedGrade - 1].label}{" "}
                  — the choice is yours.
                </p>
              </div>
            )}

            <fieldset>
              <legend className="mb-2 text-sm font-medium">
                How well did you recall it?
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GRADES.map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={
                      evaluation?.suggestedGrade === value
                        ? "default"
                        : "outline"
                    }
                    className="h-auto min-h-14 flex-col gap-0.5 py-2"
                    onClick={() => grade(value)}
                    disabled={busy !== null}
                  >
                    <span className="font-semibold">
                      {busy === value ? "Saving…" : label}
                    </span>
                    <span className="text-xs opacity-70">
                      {formatInterval(reveal.now, reveal.dueByGrade[value])}
                    </span>
                  </Button>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
