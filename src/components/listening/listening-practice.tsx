"use client";

import { useState } from "react";
import {
  Check,
  Headphones,
  Loader2,
  MessagesSquare,
  PenLine,
  Snail,
  Square,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteJson, postJson } from "@/lib/api/client";
import { useSpeechPlayer } from "@/lib/audio/use-speech-player";
import type {
  ListeningExerciseView,
  ListeningKind,
  ListeningResult,
} from "@/lib/listening/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const kindLabels: Record<ListeningKind, string> = {
  dictation: "Dictation",
  comprehension: "Comprehension",
};

const percent = (score: number) => `${Math.round(score * 100)}%`;

export function ListeningPractice({
  exercises,
}: {
  exercises: ListeningExerciseView[];
}) {
  const [history, setHistory] = useState(exercises);
  const [current, setCurrent] = useState<ListeningExerciseView | null>(
    () => exercises.find((e) => !e.completedAt) ?? null,
  );
  const [creating, setCreating] = useState<ListeningKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(kind: ListeningKind) {
    setCreating(kind);
    setError(null);
    const result = await postJson<{ exercise: ListeningExerciseView }>(
      "/api/listening",
      { kind },
    );
    setCreating(null);
    if (!result.ok) return setError(result.error);
    setCurrent(result.data.exercise);
    setHistory((items) => [result.data.exercise, ...items]);
  }

  function update(exercise: ListeningExerciseView) {
    setCurrent(exercise);
    setHistory((items) =>
      items.map((item) => (item.id === exercise.id ? exercise : item)),
    );
  }

  async function remove(id: string) {
    const result = await deleteJson(`/api/listening/${id}`);
    if (!result.ok) return setError(result.error);
    setHistory((items) => items.filter((item) => item.id !== id));
    setCurrent((value) => (value?.id === id ? null : value));
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2">
        <StartCard
          icon={<PenLine aria-hidden />}
          title="New dictation"
          description="5 cümle. Her birini istediğin kadar dinle, duyduğunu yaz."
          pending={creating === "dictation"}
          disabled={!!creating}
          onClick={() => create("dictation")}
        />
        <StartCard
          icon={<MessagesSquare aria-hidden />}
          title="New listening quiz"
          description="İki kişilik kısa bir diyalog ve 3 soru."
          pending={creating === "comprehension"}
          disabled={!!creating}
          onClick={() => create("comprehension")}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {current && (
        <ExerciseCard key={current.id} exercise={current} onUpdate={update} />
      )}

      {history.length > 0 && (
        <section aria-labelledby="listening-history" className="space-y-3">
          <h2 id="listening-history" className="text-lg font-semibold">
            Recent exercises
          </h2>
          <ul className="grid gap-2">
            {history.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2",
                  current?.id === item.id && "border-primary",
                )}
              >
                <button
                  type="button"
                  className="flex min-h-11 flex-1 flex-col items-start text-left"
                  onClick={() => setCurrent(item)}
                  aria-current={current?.id === item.id}
                >
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {kindLabels[item.kind]} ·{" "}
                    {item.score === null ? "Devam ediyor" : percent(item.score)}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label={`Delete ${item.title}`}
                  onClick={() => remove(item.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StartCard({
  icon,
  title,
  description,
  pending,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon} {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="h-11" onClick={onClick} disabled={disabled}>
          {pending ? (
            <>
              <Loader2 aria-hidden className="animate-spin" /> Hazırlanıyor…
            </>
          ) : (
            "Start"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function ExerciseCard({
  exercise,
  onUpdate,
}: {
  exercise: ListeningExerciseView;
  onUpdate: (exercise: ListeningExerciseView) => void;
}) {
  const player = useSpeechPlayer();
  const [typed, setTyped] = useState<string[]>(() =>
    new Array(exercise.items).fill(""),
  );
  const [choices, setChoices] = useState<(number | null)[]>(() =>
    exercise.questions.map(() => null),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = !!exercise.completedAt;

  function listen(item: number, rate: "slow" | "normal") {
    const key = `${item}:${rate}`;
    if (player.playing === key) return player.stop();
    void player.play(key, `/api/listening/${exercise.id}/audio`, {
      item,
      rate,
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    player.stop();
    const result = await postJson<{ exercise: ListeningExerciseView }>(
      `/api/listening/${exercise.id}/answers`,
      exercise.kind === "dictation" ? { dictation: typed } : { choices },
    );
    setSubmitting(false);
    if (!result.ok) return setError(result.error);
    onUpdate(result.data.exercise);
  }

  const playButtons = (item: number, label: string) => (
    <div className="flex flex-wrap gap-2">
      <PlayButton
        label={label}
        icon={<Volume2 aria-hidden />}
        playing={player.playing === `${item}:normal`}
        loading={player.loading === `${item}:normal`}
        onClick={() => listen(item, "normal")}
      />
      <PlayButton
        label="Slow"
        icon={<Snail aria-hidden />}
        playing={player.playing === `${item}:slow`}
        loading={player.loading === `${item}:slow`}
        onClick={() => listen(item, "slow")}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <Headphones aria-hidden className="size-3" />
            {kindLabels[exercise.kind]}
          </Badge>
          <Badge variant="outline">
            {exercise.dialect === "en-GB" ? "British" : "American"}
          </Badge>
          {exercise.score !== null && (
            <Badge className="ml-auto">Score {percent(exercise.score)}</Badge>
          )}
        </div>
        <CardTitle className="pt-1 text-lg">
          <h2>{exercise.title}</h2>
        </CardTitle>
        {exercise.contextTr && (
          <CardDescription>{exercise.contextTr}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {player.error && (
          <p role="alert" className="text-sm text-destructive">
            {player.error}
          </p>
        )}

        {exercise.kind === "comprehension" && playButtons(0, "Play dialogue")}

        {!done && exercise.kind === "dictation" && (
          <ol className="space-y-4">
            {typed.map((value, index) => (
              <li key={index} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    Sentence {index + 1}
                  </span>
                  {playButtons(index, "Play")}
                </div>
                <label htmlFor={`dictation-${index}`} className="sr-only">
                  What you heard in sentence {index + 1}
                </label>
                <Input
                  id={`dictation-${index}`}
                  lang="en"
                  autoComplete="off"
                  spellCheck={false}
                  value={value}
                  maxLength={400}
                  placeholder="Type what you hear…"
                  className="h-11"
                  onChange={(event) =>
                    setTyped((items) =>
                      items.map((item, i) =>
                        i === index ? event.target.value : item,
                      ),
                    )
                  }
                />
              </li>
            ))}
          </ol>
        )}

        {!done && exercise.kind === "comprehension" && (
          <ol className="space-y-5">
            {exercise.questions.map((question, qi) => (
              <li key={qi}>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">
                    {qi + 1}. {question.question}
                  </legend>
                  {question.options.map((option, oi) => (
                    <label
                      key={oi}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/60",
                        choices[qi] === oi
                          ? "border-primary bg-primary/10"
                          : "hover:bg-secondary",
                      )}
                    >
                      <input
                        type="radio"
                        name={`question-${qi}`}
                        className="sr-only"
                        checked={choices[qi] === oi}
                        onChange={() =>
                          setChoices((items) =>
                            items.map((item, i) => (i === qi ? oi : item)),
                          )
                        }
                      />
                      {option}
                    </label>
                  ))}
                </fieldset>
              </li>
            ))}
          </ol>
        )}

        {!done && (
          <Button className="h-11" onClick={submit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 aria-hidden className="animate-spin" /> Checking…
              </>
            ) : (
              "Check answers"
            )}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {exercise.result && (
          <ResultView result={exercise.result} playButtons={playButtons} />
        )}
      </CardContent>
    </Card>
  );
}

function PlayButton({
  label,
  icon,
  playing,
  loading,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  playing: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="h-11"
      onClick={onClick}
      disabled={loading}
      aria-label={playing ? `Stop ${label}` : label}
    >
      {loading ? (
        <Loader2 aria-hidden className="animate-spin" />
      ) : playing ? (
        <Square aria-hidden />
      ) : (
        icon
      )}
      {playing ? "Stop" : label}
    </Button>
  );
}

function ResultView({
  result,
  playButtons,
}: {
  result: ListeningResult;
  playButtons: (item: number, label: string) => React.ReactNode;
}) {
  if (result.kind === "dictation") {
    return (
      <ol className="space-y-4 border-t pt-4">
        {result.sentences.map((sentence, index) => (
          <li key={index} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                Sentence {index + 1} · {sentence.grade.correct}/
                {sentence.grade.total}
              </span>
              {playButtons(index, "Replay")}
            </div>
            <p lang="en" className="leading-relaxed">
              {sentence.grade.marks.map((mark, i) => (
                <span key={i}>
                  {i > 0 && " "}
                  {mark.status === "ok" ? (
                    <span className="text-success">{mark.word}</span>
                  ) : mark.status === "missed" ? (
                    <mark className="rounded bg-destructive/15 px-1 text-destructive">
                      {mark.word}
                      <span className="sr-only"> (missed)</span>
                    </mark>
                  ) : (
                    <mark className="rounded bg-destructive/15 px-1 text-destructive">
                      {mark.word}
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        (you: {mark.heard})
                      </span>
                    </mark>
                  )}
                </span>
              ))}
            </p>
            {sentence.meaningTr && (
              <p lang="tr" className="text-sm">
                {sentence.meaningTr}
              </p>
            )}
            {sentence.grade.extra.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Fazladan yazdıkların: {sentence.grade.extra.join(", ")}
              </p>
            )}
            <p lang="tr" className="text-sm text-muted-foreground">
              {sentence.focusTr}
            </p>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="space-y-5 border-t pt-4">
      <ol className="space-y-4">
        {result.questions.map((question, qi) => {
          const correct = question.chosen === question.answerIndex;
          return (
            <li key={qi} className="space-y-1">
              <p className="flex items-start gap-2 text-sm font-medium">
                {correct ? (
                  <Check aria-label="Correct" className="size-4 text-success" />
                ) : (
                  <X
                    aria-label="Incorrect"
                    className="size-4 text-destructive"
                  />
                )}
                {qi + 1}. {question.question}
              </p>
              <p className="pl-6 text-sm">
                {question.options[question.answerIndex]}
                {!correct && question.chosen !== null && (
                  <span className="text-muted-foreground">
                    {" "}
                    (senin cevabın: {question.options[question.chosen]})
                  </span>
                )}
              </p>
              <p lang="tr" className="pl-6 text-sm text-muted-foreground">
                {question.explanationTr}
              </p>
            </li>
          );
        })}
      </ol>
      <details className="rounded-lg border px-3 py-2">
        <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium">
          Transcript
        </summary>
        <dl lang="en" className="space-y-2 pt-2 pb-1 text-sm">
          {result.lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              <dt className="font-medium text-muted-foreground uppercase">
                {line.speaker}
              </dt>
              <dd>
                {line.text}
                {line.meaning_tr && (
                  <span
                    lang="tr"
                    className="block text-xs text-muted-foreground"
                  >
                    {line.meaning_tr}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
