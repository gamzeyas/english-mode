"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { getJson, postJson, type ApiResult } from "@/lib/api/client";
import { CorrectionCard } from "@/components/conversation/correction-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FeedbackCandidate, FeedbackState } from "@/lib/sessions/service";

const POLL_MS = 3000;

export function FeedbackView({
  sessionId,
  title,
  userTurns,
  initialState,
}: {
  sessionId: string;
  title: string;
  userTurns: number;
  initialState: FeedbackState;
}) {
  const [state, setState] = useState<FeedbackState>(initialState);
  const [requestError, setRequestError] = useState<string | null>(null);
  const started = useRef(false);

  const applyResult = useCallback((result: ApiResult<FeedbackState>) => {
    if (result.ok) setState(result.data);
    else setRequestError(result.error);
  }, []);

  function run(retry = false) {
    setRequestError(null);
    setState({ state: "running" });
    void postJson<FeedbackState>(
      `/api/sessions/${sessionId}/feedback${retry ? "?retry=1" : ""}`,
    ).then(applyResult);
  }

  // Kick off the analysis once; the endpoint is idempotent and resumable.
  useEffect(() => {
    if (started.current || initialState.state !== "running") return;
    started.current = true;
    void postJson<FeedbackState>(`/api/sessions/${sessionId}/feedback`).then(
      applyResult,
    );
  }, [initialState.state, sessionId, applyResult]);

  // Another request (or a previous tab) is analyzing: poll until it settles.
  useEffect(() => {
    if (state.state !== "running" || requestError) return;
    const timer = setInterval(async () => {
      const result = await getJson<FeedbackState>(
        `/api/sessions/${sessionId}/feedback`,
      );
      if (result.ok && result.data.state !== "running") setState(result.data);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [state.state, requestError, sessionId]);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Feedback
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {userTurns} {userTurns === 1 ? "turn" : "turns"} · Bu bir koçluk geri
          bildirimidir, resmi seviye değerlendirmesi değildir.
        </p>
      </div>

      {(state.state === "running" || requestError) && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center">
            {requestError ? (
              <>
                <p role="alert" className="flex-1 text-sm text-destructive">
                  {requestError}
                </p>
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => run()}
                >
                  <RotateCcw aria-hidden /> Try again
                </Button>
              </>
            ) : (
              <p className="flex items-center gap-3 text-sm" aria-live="polite">
                <Loader2
                  aria-hidden
                  className="size-5 animate-spin text-primary"
                />
                Konuşman analiz ediliyor… Bu genellikle 10–30 saniye sürer.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {state.state === "failed" && !requestError && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center">
            <p role="alert" className="flex-1 text-sm text-destructive">
              {state.error}
            </p>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => run(true)}
            >
              <RotateCcw aria-hidden /> Retry analysis
            </Button>
          </CardContent>
        </Card>
      )}

      {state.state === "empty" && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Bu oturumda analiz edilecek bir cevabın yok. Bir sonraki konuşmada
            birkaç cümle yazman yeterli.
          </CardContent>
        </Card>
      )}

      {state.state === "not_ended" && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-6 text-sm">
            <p>Bu oturum hâlâ devam ediyor.</p>
            <Button asChild className="h-11">
              <Link href={`/conversation/${sessionId}`}>
                Back to conversation
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {state.state === "ready" && (
        <ReadyFeedback sessionId={sessionId} state={state} />
      )}

      <div className="flex flex-col gap-2 border-t pt-6 sm:flex-row">
        <Button asChild className="h-11">
          <Link href="/conversation/new">New conversation</Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href="/dashboard">Back to Today</Link>
        </Button>
      </div>
    </div>
  );
}

function ReadyFeedback({
  sessionId,
  state,
}: {
  sessionId: string;
  state: Extract<FeedbackState, { state: "ready" }>;
}) {
  const { payload } = state;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Summary</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p lang="tr" className="text-sm leading-relaxed">
            {payload.summary_tr}
          </p>
          {payload.strengths.length > 0 && (
            <ul className="space-y-2">
              {payload.strengths.map((strength) => (
                <li
                  key={strength.evidence_message_id + strength.comment_tr}
                  className="flex gap-2 text-sm"
                >
                  <Check
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-success"
                  />
                  <span lang="tr">{strength.comment_tr}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="corrections-heading">
        <h2
          id="corrections-heading"
          className="font-heading text-lg font-semibold"
        >
          Top corrections
        </h2>
        {payload.corrections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Bu oturumda öncelikli bir düzeltme yok. 👏
          </p>
        ) : (
          <ul className="grid gap-3">
            {payload.corrections.map((correction) => (
              <li key={correction.evidence_message_id + correction.original}>
                <CorrectionCard
                  correction={{
                    original: correction.original,
                    improved: correction.improved,
                    reasonTr: correction.reason_tr,
                    category: correction.category,
                    severity: correction.severity,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {state.candidates.length > 0 && (
        <section className="space-y-3" aria-labelledby="candidates-heading">
          <div>
            <h2
              id="candidates-heading"
              className="font-heading text-lg font-semibold"
            >
              Save to your learning pool?
            </h2>
            <p className="text-sm text-muted-foreground">
              Onayladıkların tekrar listene girer; reddettiklerin silinir.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {state.candidates.map((candidate) => (
              <li key={candidate.id}>
                <CandidateCard sessionId={sessionId} candidate={candidate} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-primary">
            <h2 className="flex items-center gap-2">
              <Sparkles aria-hidden className="size-4" /> Next task ·{" "}
              {payload.next_task.estimated_minutes} min
            </h2>
          </CardTitle>
          <CardDescription className="text-base font-semibold text-foreground">
            {payload.next_task.title}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">
            {payload.next_task.instructions}
          </p>
        </CardContent>
      </Card>

      {payload.confidence_notes.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {payload.confidence_notes.map((note) => (
            <li key={note}>Note: {note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CandidateCard({
  sessionId,
  candidate,
}: {
  sessionId: string;
  candidate: FeedbackCandidate;
}) {
  const [status, setStatus] = useState(candidate.status);
  const [pending, setPending] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "accept" | "reject") {
    setPending(action);
    setError(null);
    const result = await postJson(
      `/api/sessions/${sessionId}/learning-candidates/${candidate.id}/${action}`,
    );
    setPending(null);
    if (result.ok) setStatus(action === "accept" ? "new" : "rejected");
    else setError(result.error);
  }

  if (status === "rejected") {
    return (
      <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
        “{candidate.phrase}” removed.
      </p>
    );
  }

  const saved = status !== "suggested";
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {candidate.phrase}
        </CardTitle>
        {candidate.meaningTr && (
          <p lang="tr" className="text-sm text-muted-foreground">
            {candidate.meaningTr}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {candidate.example && (
          <p className="text-sm italic">“{candidate.example}”</p>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        {saved ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-success">
            <Check aria-hidden className="size-4" /> In your pool
          </p>
        ) : (
          <div className="flex gap-2">
            <Button
              className="h-10 flex-1"
              onClick={() => act("accept")}
              disabled={!!pending}
            >
              <Plus aria-hidden /> {pending === "accept" ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => act("reject")}
              disabled={!!pending}
              aria-label={`Reject ${candidate.phrase}`}
            >
              <X aria-hidden />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
