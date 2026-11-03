"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, SendHorizontal, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInput } from "@/components/voice/voice-input";
import type { SessionView } from "@/lib/sessions/service";

type ChatMessage = SessionView["messages"][number] & { pending?: boolean };
type Modality = "text" | "speech_transcript";
type FailedSend = {
  clientMessageId: string;
  content: string;
  modality: Modality;
  error: string;
  retryable: boolean;
};

const MAX_CHARS = 2000;

export function ChatSession({ session }: { session: SessionView }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(session.messages);
  const [draft, setDraft] = useState("");
  const [draftModality, setDraftModality] = useState<Modality>("text");
  const composer = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<FailedSend | null>(null);
  const [ending, setEnding] = useState(false);
  const active = session.status === "active";
  const listEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [messages, sending]);

  const userTurns = messages.filter(
    (m) => m.role === "user" && !m.pending,
  ).length;
  const title = session.scenario
    ? `${session.scenario.personaName ?? "Coach"} · ${session.scenario.title}`
    : "Free conversation";

  async function deliver(
    clientMessageId: string,
    content: string,
    modality: Modality,
  ) {
    setSending(true);
    setFailed(null);
    const result = await postJson<{
      message: ChatMessage;
      assistantMessage: ChatMessage;
    }>(`/api/sessions/${session.id}/messages`, {
      content,
      clientMessageId,
      modality,
    });
    setSending(false);

    if (result.ok) {
      setMessages((current) => [
        ...current.filter(
          (m) => m.id !== clientMessageId && m.id !== result.data.message.id,
        ),
        result.data.message,
        result.data.assistantMessage,
      ]);
      return;
    }
    // Keep the optimistic bubble; the retry reuses the same id (idempotent).
    setFailed({
      clientMessageId,
      content,
      modality,
      error: result.error,
      retryable: !["turn_limit", "not_active", "ai_not_configured"].includes(
        result.code,
      ),
    });
  }

  function send(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || sending || failed || !active) return;
    const clientMessageId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      {
        id: clientMessageId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ]);
    setDraft("");
    const modality = draftModality;
    setDraftModality("text");
    void deliver(clientMessageId, content, modality);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      send();
    }
  }

  async function endSession() {
    setEnding(true);
    const result = await postJson(`/api/sessions/${session.id}/end`);
    if (result.ok) router.push(`/conversation/${session.id}/feedback`);
    else {
      setEnding(false);
      setFailed(
        (current) =>
          current ?? {
            clientMessageId: "",
            content: "",
            modality: "text",
            error: result.error,
            retryable: false,
          },
      );
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-3xl flex-col md:min-h-[calc(100dvh-2rem)]">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Button
          asChild
          variant="ghost"
          size="icon-lg"
          aria-label="Back to Speak"
        >
          <Link href="/conversation/new">
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {active ? "Active" : "Ended"} · {userTurns}{" "}
            {userTurns === 1 ? "turn" : "turns"}
            {session.durationGoalMinutes
              ? ` · goal ${session.durationGoalMinutes} min`
              : ""}
          </p>
        </div>
        {active ? (
          <Button
            variant="outline"
            className="h-10"
            onClick={endSession}
            disabled={ending || sending || userTurns === 0}
          >
            <Square aria-hidden className="size-3.5" />{" "}
            {ending ? "Ending…" : "End"}
          </Button>
        ) : (
          <Button asChild className="h-10">
            <Link href={`/conversation/${session.id}/feedback`}>Feedback</Link>
          </Button>
        )}
      </div>

      {session.scenario && session.scenario.goals.length > 0 && (
        <details className="border-b px-4 py-2 text-sm">
          <summary className="flex min-h-10 cursor-pointer items-center font-medium text-muted-foreground">
            Your goals ({session.scenario.goals.length})
          </summary>
          <ul className="list-disc space-y-1 pt-1 pb-2 pl-5">
            {session.scenario.goals.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
        </details>
      )}

      <div
        className="flex-1 px-4 py-6"
        role="log"
        aria-label="Conversation transcript"
      >
        {messages.length === 0 && (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Say hi to start — the coach will reply with one question at a time.
          </p>
        )}
        <ol className="space-y-4">
          {messages.map((message) => (
            <li
              key={message.id}
              className={cn(
                "flex flex-col gap-1",
                message.role === "user" ? "items-end" : "items-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-wrap",
                  message.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-secondary",
                  message.pending && "opacity-70",
                )}
              >
                <span className="sr-only">
                  {message.role === "user" ? "You: " : "Coach: "}
                </span>
                {message.content}
              </div>
            </li>
          ))}
          {sending && (
            <li className="flex items-start" aria-label="Coach is typing">
              <span className="flex gap-1 rounded-2xl rounded-bl-md bg-secondary px-4 py-3.5">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </li>
          )}
        </ol>

        {failed && (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
          >
            <p className="flex-1">{failed.error}</p>
            {failed.retryable && failed.clientMessageId ? (
              <Button
                variant="outline"
                className="h-10"
                onClick={() =>
                  deliver(
                    failed.clientMessageId,
                    failed.content,
                    failed.modality,
                  )
                }
                disabled={sending}
              >
                <RotateCcw aria-hidden /> Retry
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="h-10"
                onClick={() => setFailed(null)}
              >
                Dismiss
              </Button>
            )}
          </div>
        )}
        {!active && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            This session has ended.{" "}
            <Link
              href={`/conversation/${session.id}/feedback`}
              className="text-primary underline-offset-4 hover:underline"
            >
              See your feedback
            </Link>
          </p>
        )}
        <div ref={listEnd} />
      </div>

      {active && (
        <form
          onSubmit={send}
          className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex items-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0"
        >
          <VoiceInput
            sessionId={session.id}
            disabled={sending || !!failed}
            statusPlacement="above"
            onTranscript={(text) => {
              // The learner can correct the transcript before sending.
              setDraft((current) => (current ? `${current} ${text}` : text));
              setDraftModality("speech_transcript");
              composer.current?.focus();
            }}
          />
          <label htmlFor="composer" className="sr-only">
            Your message
          </label>
          <Textarea
            id="composer"
            ref={composer}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (!event.target.value) setDraftModality("text");
            }}
            onKeyDown={onKeyDown}
            placeholder={
              failed
                ? "Retry or dismiss the error first"
                : "Type your answer in English…"
            }
            rows={1}
            maxLength={MAX_CHARS}
            disabled={!!failed}
            className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl py-3 text-[0.95rem]"
          />
          <Button
            type="submit"
            disabled={!draft.trim() || sending || !!failed}
            className="size-12 rounded-full"
            aria-label="Send message"
          >
            <SendHorizontal aria-hidden className="size-5" />
          </Button>
        </form>
      )}
    </div>
  );
}
