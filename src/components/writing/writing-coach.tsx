"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { deleteJson, postJson } from "@/lib/api/client";
import type { Register, WritingEntryView } from "@/lib/writing/service";
import { ChoiceGroup, type ChoiceOption } from "@/components/choice-group";
import { TaskFeedbackView } from "@/components/assignments/assignment-card";
import { CorrectionCard } from "@/components/conversation/correction-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useServerState } from "@/lib/use-server-state";

const MAX_CHARS = 4000;

const registers: ChoiceOption<Register>[] = [
  { value: "casual", label: "Casual" },
  { value: "neutral", label: "Neutral" },
  { value: "professional", label: "Professional" },
  { value: "formal", label: "Formal" },
];

export function WritingCoach({ entries }: { entries: WritingEntryView[] }) {
  const [history, setHistory] = useServerState(entries);
  const [sourceText, setSourceText] = useState("");
  const [intent, setIntent] = useState("");
  const [register, setRegister] = useState<Register>("professional");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<WritingEntryView | null>(null);

  async function evaluate() {
    setPending(true);
    setError(null);
    const result = await postJson<{ entry: WritingEntryView }>(
      "/api/writing/evaluate",
      { sourceText, intent, tone: register },
    );
    setPending(false);
    if (!result.ok) return setError(result.error);
    setCurrent(result.data.entry);
    setHistory((items) => [result.data.entry, ...items]);
    setSourceText("");
    setIntent("");
  }

  function update(entry: WritingEntryView) {
    setCurrent((value) => (value?.id === entry.id ? entry : value));
    setHistory((items) => items.map((i) => (i.id === entry.id ? entry : i)));
  }

  function remove(id: string) {
    setCurrent((value) => (value?.id === id ? null : value));
    setHistory((items) => items.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void evaluate();
            }}
          >
            <div className="space-y-2">
              <label htmlFor="writing-source" className="text-sm font-medium">
                Your text
              </label>
              <Textarea
                id="writing-source"
                lang="en"
                rows={6}
                maxLength={MAX_CHARS}
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Paste an email, a LinkedIn message, a cover letter paragraph…"
                disabled={pending}
                required
              />
              <p className="text-right text-xs text-muted-foreground tabular-nums">
                {sourceText.length}/{MAX_CHARS}
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="writing-intent" className="text-sm font-medium">
                What should it achieve?
              </label>
              <Input
                id="writing-intent"
                className="h-11"
                maxLength={200}
                value={intent}
                onChange={(event) => setIntent(event.target.value)}
                placeholder="e.g. Ask a recruiter for a call next week"
                disabled={pending}
                required
              />
            </div>
            <ChoiceGroup
              legend="Register"
              name="register"
              options={registers}
              value={register}
              onChange={setRegister}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end border-t pt-5">
              <Button
                type="submit"
                size="lg"
                className="h-12 px-6 text-base"
                disabled={pending || !sourceText.trim() || !intent.trim()}
              >
                {pending ? (
                  <>
                    <Loader2 aria-hidden className="animate-spin" /> Coaching…
                  </>
                ) : (
                  "Improve my text"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {current && (
        <section aria-labelledby="writing-result" className="space-y-3">
          <h2
            id="writing-result"
            className="font-heading text-lg font-semibold"
          >
            Coach response
          </h2>
          <EntryDetail entry={current} onUpdate={update} onDelete={remove} />
        </section>
      )}

      <section aria-labelledby="writing-history" className="space-y-3">
        <h2 id="writing-history" className="font-heading text-lg font-semibold">
          Recent texts
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Henüz bir metin yok. İlk metnini yukarıya yapıştır.
          </p>
        ) : (
          <ul className="grid gap-2">
            {history.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setCurrent(entry)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
                  aria-current={current?.id === entry.id}
                >
                  <span className="flex-1 truncate">{entry.intent}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {entry.register}
                  </span>
                  {entry.revisionText && (
                    <Check
                      aria-label="Revised"
                      className="size-4 text-success"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EntryDetail({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: WritingEntryView;
  onUpdate: (entry: WritingEntryView) => void;
  onDelete: (id: string) => void;
}) {
  const { response } = entry;
  const [revision, setRevision] = useState("");
  const [pending, setPending] = useState<"revise" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  async function revise() {
    setPending("revise");
    setError(null);
    const result = await postJson<{ entry: WritingEntryView }>(
      `/api/writing/${entry.id}/revision`,
      { text: revision },
    );
    setPending(null);
    if (!result.ok) return setError(result.error);
    setRevision("");
    onUpdate(result.data.entry);
  }

  async function remove() {
    setPending("delete");
    const result = await deleteJson(`/api/writing/${entry.id}`);
    setPending(null);
    if (!result.ok) return setError(result.error);
    onDelete(entry.id);
  }

  async function savePhrase(
    phrase: WritingEntryView["response"]["useful_phrases"][number],
  ) {
    setError(null);
    const result = await postJson("/api/learning-items", {
      phrase: phrase.phrase,
      meaningTr: phrase.meaning_tr,
      example: phrase.example,
      sourceContext: `Writing coach: ${entry.intent}`,
    });
    if (result.ok || result.code === "duplicate") {
      setSaved((current) => new Set(current).add(phrase.phrase));
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <h3>Improved version</h3>
          </CardTitle>
          <CardDescription lang="tr">{response.summary_tr}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p
            lang="en"
            className="rounded-lg border bg-secondary/30 p-3 text-sm whitespace-pre-wrap"
          >
            {response.improved_text}
          </p>
          <p lang="tr" className="text-sm text-muted-foreground">
            {response.register_notes_tr}
          </p>
        </CardContent>
      </Card>

      {response.corrections.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {response.corrections.map((correction) => (
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

      {response.useful_phrases.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>
              <h3>Useful phrases</h3>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {response.useful_phrases.map((phrase) => (
                <li
                  key={phrase.phrase}
                  className="flex flex-wrap items-start gap-3"
                >
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{phrase.phrase}</p>
                    <p lang="tr" className="text-muted-foreground">
                      {phrase.meaning_tr}
                    </p>
                  </div>
                  {saved.has(phrase.phrase) ? (
                    <span className="flex h-10 items-center gap-1.5 text-sm font-medium text-success">
                      <Check aria-hidden className="size-4" /> In your pool
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={() => savePhrase(phrase)}
                      aria-label={`Save ${phrase.phrase} to your pool`}
                    >
                      <Plus aria-hidden /> Save
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-primary">
            <h3>Revision exercise · {response.revision_exercise.focus}</h3>
          </CardTitle>
          <CardDescription lang="tr" className="text-foreground/90">
            {response.revision_exercise.instructions_tr}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {entry.revisionText && entry.revisionFeedback && (
            <div className="space-y-2 rounded-lg border bg-secondary/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Your revision
              </p>
              <p lang="en" className="text-sm whitespace-pre-wrap">
                {entry.revisionText}
              </p>
              <TaskFeedbackView feedback={entry.revisionFeedback} />
            </div>
          )}
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (revision.trim()) void revise();
            }}
          >
            <label htmlFor={`revision-${entry.id}`} className="sr-only">
              Your revision
            </label>
            <Textarea
              id={`revision-${entry.id}`}
              lang="en"
              rows={4}
              maxLength={MAX_CHARS}
              value={revision}
              onChange={(event) => setRevision(event.target.value)}
              placeholder="Rewrite it yourself…"
              disabled={!!pending}
            />
            <Button
              type="submit"
              className="h-11"
              disabled={!!pending || !revision.trim()}
            >
              {pending === "revise" ? (
                <>
                  <Loader2 aria-hidden className="animate-spin" /> Checking…
                </>
              ) : entry.revisionText ? (
                "Check again"
              ) : (
                "Check my revision"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        variant="ghost"
        className="h-10 text-muted-foreground"
        onClick={remove}
        disabled={!!pending}
      >
        <Trash2 aria-hidden /> Delete this text
      </Button>
    </div>
  );
}
