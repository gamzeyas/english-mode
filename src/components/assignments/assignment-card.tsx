"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Loader2,
  RotateCcw,
  Shuffle,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { postJson } from "@/lib/api/client";
import { kindLabels, TEXT_KINDS } from "@/lib/assignments/planner";
import type { TaskFeedback } from "@/lib/ai/analysis/writing";
import type { AssignmentView } from "@/lib/assignments/service";
import { CorrectionCard } from "@/components/conversation/correction-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInput } from "@/components/voice/voice-input";
import { useServerState } from "@/lib/use-server-state";

const MAX_ANSWER = 4000;

const statusLabels: Record<AssignmentView["status"], string> = {
  pending: "To do",
  completed: "Done",
  skipped: "Skipped",
};

type Action = "submission" | "complete" | "skip" | "reschedule" | "swap";
type Result = {
  assignment: AssignmentView & { feedbackError?: string | null };
};

export function AssignmentCard({
  assignment: initial,
  onReplace,
}: {
  assignment: AssignmentView;
  /** Called when the task moves (rescheduled) or is replaced (swapped). */
  onReplace?: (previousId: string, next: AssignmentView | null) => void;
}) {
  const [assignment, setAssignment] = useServerState(initial);
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const isText = TEXT_KINDS.has(assignment.kind);
  const open = assignment.status === "pending";

  async function act(action: Action, body?: unknown) {
    setPending(action);
    setError(null);
    const result = await postJson<Result>(
      `/api/assignments/${assignment.id}/${action}`,
      body,
    );
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const next = result.data.assignment;
    if (action === "swap") return onReplace?.(assignment.id, next);
    if (action === "reschedule") return onReplace?.(assignment.id, null);
    setAssignment(next);
    setFeedbackError(next.feedbackError ?? null);
  }

  const feedback = assignment.submission?.feedback ?? null;
  const awaitingFeedback =
    assignment.submission?.answerText && !feedback && !pending;

  return (
    <Card
      size="sm"
      className={cn(assignment.status === "skipped" && "opacity-70")}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{kindLabels[assignment.kind]}</Badge>
          <Badge variant="outline">{assignment.estimatedMinutes} min</Badge>
          <Badge
            variant={assignment.status === "completed" ? "default" : "outline"}
            className="ml-auto"
          >
            {assignment.status === "completed" && (
              <Check aria-hidden className="size-3" />
            )}
            {statusLabels[assignment.status]}
          </Badge>
        </div>
        <CardTitle className="pt-1 text-base font-semibold">
          <h3>{assignment.title}</h3>
        </CardTitle>
        <CardDescription className="text-sm whitespace-pre-wrap text-foreground/90">
          {assignment.instructions}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {open && isText && (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (answer.trim()) void act("submission", { answer });
            }}
          >
            <label htmlFor={`answer-${assignment.id}`} className="sr-only">
              Your answer
            </label>
            <Textarea
              id={`answer-${assignment.id}`}
              lang="en"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              maxLength={MAX_ANSWER}
              rows={4}
              placeholder="Write or record your answer in English…"
              disabled={!!pending}
            />
            <VoiceInput
              disabled={!!pending}
              onTranscript={(text) =>
                setAnswer((current) => (current ? `${current} ${text}` : text))
              }
            />
            <Button
              type="submit"
              className="h-11"
              disabled={!!pending || !answer.trim()}
            >
              {pending === "submission" ? (
                <>
                  <Loader2 aria-hidden className="animate-spin" /> Checking…
                </>
              ) : (
                "Submit answer"
              )}
            </Button>
          </form>
        )}

        {open && !isText && assignment.href && (
          <div className="flex flex-wrap gap-2">
            <Button asChild className="h-11">
              <Link href={assignment.href}>
                Start <ArrowRight aria-hidden />
              </Link>
            </Button>
            {assignment.kind === "review" && (
              <Button
                variant="outline"
                className="h-11"
                onClick={() => act("complete")}
                disabled={!!pending}
              >
                <Check aria-hidden /> Mark done
              </Button>
            )}
          </div>
        )}

        {assignment.submission?.answerText && (
          <div className="space-y-3 rounded-lg border bg-secondary/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Your answer
            </p>
            <p lang="en" className="text-sm whitespace-pre-wrap">
              {assignment.submission.answerText}
            </p>
            {feedback && <TaskFeedbackView feedback={feedback} />}
            {awaitingFeedback && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {feedbackError ??
                    "Cevabın kaydedildi; geri bildirim henüz yok."}
                </p>
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={() => act("submission", {})}
                >
                  <RotateCcw aria-hidden /> Get feedback
                </Button>
              </div>
            )}
          </div>
        )}

        {assignment.submission?.sessionId && (
          <Button asChild variant="outline" className="h-10">
            <Link
              href={`/conversation/${assignment.submission.sessionId}/feedback`}
            >
              View session feedback
            </Link>
          </Button>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {open && (
          <div className="flex flex-wrap gap-1 border-t pt-2">
            {assignment.canSwap && (
              <Button
                variant="ghost"
                className="h-10"
                onClick={() => act("swap")}
                disabled={!!pending}
              >
                <Shuffle aria-hidden /> Swap
              </Button>
            )}
            <Button
              variant="ghost"
              className="h-10"
              onClick={() => act("reschedule")}
              disabled={!!pending}
            >
              <CalendarClock aria-hidden /> Tomorrow
            </Button>
            <Button
              variant="ghost"
              className="h-10"
              onClick={() => act("skip")}
              disabled={!!pending}
            >
              <SkipForward aria-hidden /> Skip
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TaskFeedbackView({ feedback }: { feedback: TaskFeedback }) {
  return (
    <div className="space-y-3 border-t pt-3">
      <p lang="tr" className="text-sm">
        {feedback.summary_tr}
      </p>
      {feedback.corrections.length > 0 && (
        <ul className="grid gap-2">
          {feedback.corrections.map((correction) => (
            <li key={correction.original}>
              <CorrectionCard
                correction={{
                  original: correction.original,
                  improved: correction.improved,
                  reasonTr: correction.reason_tr,
                  category: correction.category,
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          A natural version
        </p>
        <p lang="en" className="text-sm whitespace-pre-wrap text-success">
          {feedback.improved_version}
        </p>
      </div>
    </div>
  );
}
