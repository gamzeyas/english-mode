"use client";

import { useState } from "react";
import {
  Info,
  Loader2,
  Mic,
  Snail,
  Square,
  Trash2,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteJson, postForm } from "@/lib/api/client";
import { useSpeechPlayer } from "@/lib/audio/use-speech-player";
import { formatTime, useWavRecorder } from "@/lib/audio/use-wav-recorder";
import { PRACTICE_SETS } from "@/lib/pronunciation/catalog";
import type { PronunciationAttemptView } from "@/lib/pronunciation/service";
import {
  ERROR_LABELS_TR,
  tipsForWord,
  WEAK_SCORE,
} from "@/lib/pronunciation/tips";
import type {
  PronunciationResult,
  PronunciationWord,
} from "@/lib/speech/pronunciation";
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

const MAX_SECONDS = 30;
const MAX_CHARS = 200;

type Reference =
  | { source: "catalog"; ref: string }
  | { source: "pool"; ref: string }
  | { source: "custom"; text: string };

type Selection = {
  reference: Reference;
  text: string;
  meaningTr: string | null;
  focusTr: string | null;
};

type PoolPhrase = { id: string; text: string; meaningTr: string | null };

const referenceKey = (reference: Reference) =>
  reference.source === "custom"
    ? `custom:${reference.text}`
    : `${reference.source}:${reference.ref}`;

const scoreTone = (score: number | null) =>
  score === null
    ? "text-muted-foreground"
    : score >= 80
      ? "text-success"
      : score >= WEAK_SCORE
        ? "text-chart-4"
        : "text-destructive";

export function PronunciationLab({
  attempts: initialAttempts,
  pool,
  dialect,
}: {
  attempts: PronunciationAttemptView[];
  pool: PoolPhrase[];
  dialect: "en-US" | "en-GB";
}) {
  const [attempts, setAttempts] = useState(initialAttempts);
  const [tab, setTab] = useState<"sets" | "pool" | "custom">("sets");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [custom, setCustom] = useState("");
  const [latest, setLatest] = useState<PronunciationAttemptView | null>(null);

  function select(next: Selection) {
    setSelection(next);
    setLatest(null);
  }

  async function remove(id: string) {
    const result = await deleteJson(`/api/pronunciation/${id}`);
    if (!result.ok) return;
    setAttempts((items) => items.filter((item) => item.id !== id));
    setLatest((value) => (value?.id === id ? null : value));
  }

  const previous = selection
    ? attempts.filter((a) => a.referenceText === selection.text)
    : [];

  return (
    <div className="space-y-8">
      <div
        role="tablist"
        aria-label="Sentence source"
        className="flex flex-wrap gap-1"
      >
        {(
          [
            ["sets", "Practice sets"],
            ["pool", `My phrases (${pool.length})`],
            ["custom", "My sentence"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            role="tab"
            aria-selected={tab === value}
            variant={tab === value ? "secondary" : "ghost"}
            className="h-11"
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "sets" && (
        <div className="grid gap-3 md:grid-cols-2">
          {PRACTICE_SETS.map((set) => (
            <details key={set.slug} className="rounded-xl border px-4 py-2">
              <summary className="flex min-h-11 cursor-pointer flex-col justify-center">
                <span className="font-medium">{set.title}</span>
                <span lang="tr" className="text-xs text-muted-foreground">
                  {set.focusTr}
                </span>
              </summary>
              <ul className="space-y-1 pt-2 pb-1">
                {set.sentences.map((sentence) => (
                  <li key={sentence.key}>
                    <SentenceButton
                      text={sentence.text}
                      meaningTr={sentence.meaningTr}
                      active={selection?.text === sentence.text}
                      onClick={() =>
                        select({
                          reference: { source: "catalog", ref: sentence.key },
                          text: sentence.text,
                          meaningTr: sentence.meaningTr,
                          focusTr: set.focusTr,
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}

      {tab === "pool" &&
        (pool.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Havuzunda henüz ifade yok. Konuşma geri bildirimlerinden ifade
            kaydettiğinde burada okuyabilirsin.
          </p>
        ) : (
          <ul className="grid gap-1 md:grid-cols-2">
            {pool.map((item) => (
              <li key={item.id}>
                <SentenceButton
                  text={item.text}
                  meaningTr={item.meaningTr}
                  active={selection?.text === item.text}
                  onClick={() =>
                    select({
                      reference: { source: "pool", ref: item.id },
                      text: item.text,
                      meaningTr: item.meaningTr,
                      focusTr: null,
                    })
                  }
                />
              </li>
            ))}
          </ul>
        ))}

      {tab === "custom" && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const text = custom.replace(/\s+/g, " ").trim();
            if (!text) return;
            select({
              reference: { source: "custom", text },
              text,
              meaningTr: null,
              focusTr: null,
            });
          }}
        >
          <label htmlFor="custom-sentence" className="sr-only">
            Your sentence
          </label>
          <Input
            id="custom-sentence"
            lang="en"
            value={custom}
            maxLength={MAX_CHARS}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="Type an English sentence to practise…"
            className="h-11 flex-1"
          />
          <Button type="submit" className="h-11" disabled={!custom.trim()}>
            Use this sentence
          </Button>
        </form>
      )}

      {selection && (
        <PracticeCard
          key={referenceKey(selection.reference)}
          selection={selection}
          dialect={dialect}
          latest={latest}
          previous={previous}
          onAssessed={(attempt) => {
            setLatest(attempt);
            setAttempts((items) => [attempt, ...items]);
          }}
        />
      )}

      {attempts.length > 0 && (
        <section aria-labelledby="attempt-history" className="space-y-3">
          <h2 id="attempt-history" className="text-lg font-semibold">
            Recent attempts
          </h2>
          <ul className="grid gap-2">
            {attempts.slice(0, 15).map((attempt) => (
              <li
                key={attempt.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2"
              >
                <span
                  className={cn(
                    "w-10 text-right text-lg font-semibold tabular-nums",
                    scoreTone(attempt.pronScore),
                  )}
                >
                  {attempt.pronScore === null
                    ? "–"
                    : Math.round(attempt.pronScore)}
                </span>
                <span lang="en" className="flex-1 text-sm">
                  {attempt.referenceText}
                </span>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label={`Delete attempt: ${attempt.referenceText}`}
                  onClick={() => remove(attempt.id)}
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

function SentenceButton({
  text,
  meaningTr,
  active,
  onClick,
}: {
  text: string;
  meaningTr: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-11 w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && "bg-primary/10",
      )}
    >
      <span lang="en" className="text-sm">
        {text}
      </span>
      {meaningTr && (
        <span lang="tr" className="text-xs text-muted-foreground">
          {meaningTr}
        </span>
      )}
    </button>
  );
}

function PracticeCard({
  selection,
  dialect,
  latest,
  previous,
  onAssessed,
}: {
  selection: Selection;
  dialect: "en-US" | "en-GB";
  latest: PronunciationAttemptView | null;
  previous: PronunciationAttemptView[];
  onAssessed: (attempt: PronunciationAttemptView) => void;
}) {
  const player = useSpeechPlayer();
  const recorder = useWavRecorder({
    maxSeconds: MAX_SECONDS,
    onRecorded: async (wav) => {
      const form = new FormData();
      form.append("audio", wav, "reading.wav");
      form.append("reference", JSON.stringify(selection.reference));
      const result = await postForm<{ attempt: PronunciationAttemptView }>(
        "/api/pronunciation",
        form,
      );
      if (result.ok) onAssessed(result.data.attempt);
      else recorder.setError(result.error);
    },
  });

  function listen(rate: "slow" | "normal", word?: string) {
    const key = `${word ?? ""}:${rate}`;
    if (player.playing === key) return player.stop();
    void player.play(key, "/api/pronunciation/reference", {
      reference: selection.reference,
      word,
      rate,
    });
  }

  const recording = recorder.phase === "recording";
  const busy = recorder.phase === "starting" || recorder.phase === "processing";
  const history = previous
    .filter((attempt) => attempt.id !== latest?.id)
    .slice(0, 5)
    .reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl leading-snug">
          <h2 lang="en">{selection.text}</h2>
        </CardTitle>
        {selection.meaningTr && (
          <CardDescription lang="tr">{selection.meaningTr}</CardDescription>
        )}
        {selection.focusTr && (
          <p lang="tr" className="text-xs text-muted-foreground">
            Odak: {selection.focusTr}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-11"
            onClick={() => listen("normal")}
            disabled={player.loading === ":normal"}
          >
            {player.playing === ":normal" ? (
              <Square aria-hidden />
            ) : (
              <Volume2 aria-hidden />
            )}
            Listen
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => listen("slow")}
            disabled={player.loading === ":slow"}
          >
            <Snail aria-hidden /> Slow
          </Button>
          <Button
            className="h-11"
            variant={recording ? "destructive" : "default"}
            onClick={recording ? recorder.stop : recorder.start}
            disabled={busy || !recorder.supported}
            aria-label={
              recording
                ? `Stop recording (${formatTime(recorder.elapsed)})`
                : "Record reading"
            }
          >
            {busy ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : recording ? (
              <Square aria-hidden />
            ) : (
              <Mic aria-hidden />
            )}
            {recording
              ? `Stop · ${formatTime(recorder.elapsed)}`
              : recorder.phase === "processing"
                ? "Değerlendiriliyor…"
                : latest
                  ? "Try again"
                  : "Record"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cümleyi doğal hızında, bir kez oku (en fazla {MAX_SECONDS} sn).
        </p>
        {(recorder.error || player.error) && (
          <p role="alert" className="text-sm text-destructive">
            {recorder.error ?? player.error}
          </p>
        )}

        {latest?.result && (
          <AssessmentView
            result={latest.result}
            dialect={dialect}
            onListenWord={(word) => listen("slow", word)}
          />
        )}

        {history.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Önceki denemeler:{" "}
            {history
              .map((attempt) =>
                attempt.pronScore === null
                  ? "–"
                  : Math.round(attempt.pronScore),
              )
              .join(" → ")}
            {latest?.pronScore != null &&
              ` → ${Math.round(latest.pronScore)} (şimdi)`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AssessmentView({
  result,
  dialect,
  onListenWord,
}: {
  result: PronunciationResult;
  dialect: "en-US" | "en-GB";
  onListenWord: (word: string) => void;
}) {
  const [selected, setSelected] = useState<number | null>(() => {
    const weakest = result.words
      .map((word, index) => ({ word, index }))
      .filter(
        ({ word }) => word.accuracy !== null && word.accuracy < WEAK_SCORE,
      )
      .sort((a, b) => a.word.accuracy! - b.word.accuracy!)[0];
    return weakest?.index ?? null;
  });
  const scores: [string, number | null, string][] = [
    ["Overall", result.scores.pronunciation, "Genel telaffuz"],
    ["Accuracy", result.scores.accuracy, "Seslerin doğruluğu"],
    ["Fluency", result.scores.fluency, "Akıcılık ve duraklamalar"],
    ["Completeness", result.scores.completeness, "Cümlenin ne kadarı okundu"],
    ["Prosody", result.scores.prosody, "Vurgu, tonlama ve ritim"],
  ];
  const word = selected === null ? null : result.words[selected];

  return (
    <div className="space-y-5 border-t pt-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {scores.map(([label, score, hint]) => (
          <div key={label} className="rounded-lg border px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                "text-2xl font-semibold tabular-nums",
                scoreTone(score),
              )}
            >
              {score === null ? "—" : Math.round(score)}
            </dd>
            <p
              lang="tr"
              className="text-[11px] leading-tight text-muted-foreground"
            >
              {score === null && label === "Prosody"
                ? "Yalnızca Amerikan İngilizcesinde ölçülür"
                : hint}
            </p>
          </div>
        ))}
      </dl>

      <div className="space-y-2">
        <p className="text-sm font-medium">
          Kelimeler{" "}
          <span className="font-normal text-muted-foreground">
            — ayrıntı için dokun
          </span>
        </p>
        <ul className="flex flex-wrap gap-2" lang="en">
          {result.words.map((item, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-pressed={selected === index}
                aria-label={`${item.word}: ${
                  item.accuracy === null ? "omitted" : Math.round(item.accuracy)
                }${item.errorType !== "None" ? `, ${item.errorType}` : ""}`}
                className={cn(
                  "flex min-h-11 flex-col items-center rounded-lg border px-3 py-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  selected === index && "border-primary bg-primary/10",
                  item.errorType === "Omission" && "line-through opacity-70",
                  item.errorType === "Insertion" && "border-dashed",
                )}
              >
                <span className="font-medium">{item.word}</span>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    scoreTone(item.accuracy),
                  )}
                >
                  {item.accuracy === null ? "–" : Math.round(item.accuracy)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {word && (
        <WordDetail
          word={word}
          dialect={dialect}
          onListen={() => onListenWord(word.word)}
        />
      )}

      {result.monotone && (
        <p lang="tr" className="text-sm">
          Tonlama oldukça düz: soru cümlelerinde sonu yükselt, önemli kelimeleri
          vurgula.
        </p>
      )}
      <p
        lang="tr"
        className="flex items-start gap-2 text-xs text-muted-foreground"
      >
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Puanlar Azure&apos;un {dialect === "en-GB"
          ? "İngiliz"
          : "Amerikan"}{" "}
        İngilizcesi modeline göre otomatik tahmindir; aksanın bir kusur
        değildir. Hedef anlaşılır olmak. Duyulan metin: “{result.recognized}”
      </p>
    </div>
  );
}

function WordDetail({
  word,
  dialect,
  onListen,
}: {
  word: PronunciationWord;
  dialect: "en-US" | "en-GB";
  onListen: () => void;
}) {
  const tips = tipsForWord(word);
  return (
    <div className="space-y-3 rounded-xl border bg-secondary/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span lang="en" className="text-lg font-semibold">
          {word.word}
        </span>
        {word.errorType !== "None" && (
          <Badge variant="outline" lang="tr">
            {ERROR_LABELS_TR[word.errorType]}
          </Badge>
        )}
        {word.errorType !== "Insertion" && (
          <Button
            variant="ghost"
            className="ml-auto h-10"
            onClick={onListen}
            aria-label={`Listen to ${word.word} slowly`}
          >
            <Volume2 aria-hidden /> Listen
          </Button>
        )}
      </div>
      {word.phonemes.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Sounds">
          {word.phonemes.map((phoneme, index) => (
            <li
              key={index}
              className="flex min-w-10 flex-col items-center rounded-md border bg-background px-2 py-1"
            >
              <span className="font-mono text-base">/{phoneme.phoneme}/</span>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  scoreTone(phoneme.accuracy),
                )}
              >
                {Math.round(phoneme.accuracy)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {tips.length > 0 ? (
        <ul className="space-y-1 text-sm" lang="tr">
          {tips.map((tip) => (
            <li key={tip.phoneme}>
              <span className="font-mono">/{tip.phoneme}/</span> {tip.tip}
            </li>
          ))}
        </ul>
      ) : (
        <p lang="tr" className="text-sm text-muted-foreground">
          {word.errorType === "Omission"
            ? "Bu kelime okunmamış görünüyor; cümleyi baştan sona oku."
            : word.errorType === "Insertion"
              ? "Bu kelime cümlede yok; fazladan söylenmiş."
              : word.accuracy !== null && word.accuracy < WEAK_SCORE
                ? "Bu kelimeyi yavaş dinleyip tekrar et."
                : "Bu kelime iyi görünüyor."}
        </p>
      )}
      {dialect === "en-GB" && word.phonemes.length === 0 && (
        <p lang="tr" className="text-xs text-muted-foreground">
          Azure, İngiliz İngilizcesinde ses (fonem) düzeyinde ayrıntı vermiyor.
          Ses bazında ipuçları için Settings → Edit&apos;ten Amerikan
          İngilizcesini seçebilirsin.
        </p>
      )}
    </div>
  );
}
