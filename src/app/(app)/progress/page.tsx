import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile } from "@/lib/auth/dal";
import { formatLocalDate } from "@/lib/learning/day";
import {
  getProgressStats,
  getSkillProgress,
  MIN_SAMPLE,
} from "@/lib/learning/progress";
import { DAYPARTS_TR, WEEKDAYS_TR } from "@/lib/learning/skill-progress";
import { tipForPhoneme } from "@/lib/pronunciation/tips";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Progress"
        title="Your progress"
        description="Gerçek oturum ve tekrarlarından hesaplanan gayriresmî koçluk ölçüleri. Resmî seviye (CEFR) değerlendirmesi değildir."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Stats />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <SkillSections />
      </Suspense>
    </PageContainer>
  );
}

async function Stats() {
  const profile = await getProfile();
  const stats = await getProgressStats(profile.timezone);
  const smallSample = stats.reviews28 < MIN_SAMPLE;
  const pool = stats.statusCounts;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Active days"
          value={`${stats.activeDays7}/7`}
          hint={`${stats.activeDays28}/28 in the last 4 weeks`}
        />
        <Metric
          label="Sessions (28d)"
          value={String(stats.sessionsCompleted28)}
          hint="Completed conversations"
        />
        <Metric
          label="Reviews"
          value={String(stats.reviews7)}
          hint={`${stats.reviews28} in the last 28 days`}
        />
        <Metric
          label="Successful recalls (28d)"
          value={String(stats.successfulRetrievals28)}
          hint={
            stats.recallRate28 === null
              ? "No reviews yet"
              : `${Math.round(stats.recallRate28 * 100)}% graded Good/Easy${smallSample ? " · small sample" : ""}`
          }
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Your words (28d)"
          value={String(stats.learnerWords28)}
          hint={`${stats.learnerUtterances28} messages in conversations`}
        />
        <Metric
          label="Roleplays (28d)"
          value={String(stats.roleplays28)}
          hint="Completed scenario sessions"
        />
        <Metric
          label="Assignments (28d)"
          value={String(stats.assignmentsCompleted28)}
          hint={`${stats.assignmentsSkipped28} skipped — that's fine`}
        />
        <Metric
          label="Writing coach (28d)"
          value={String(stats.writingEntries28)}
          hint="Texts reviewed"
        />
      </div>

      {smallSample && stats.reviews28 > 0 && (
        <p className="text-xs text-muted-foreground">
          Not: Son 28 günde {stats.reviews28} tekrar var; oranlar {MIN_SAMPLE}+
          tekrardan sonra daha anlamlı olur.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Baseline & matched tasks</h2>
          </CardTitle>
          <CardDescription>
            Aynı görevler, aynı ölçütler; yüzde artış iddiası yok. Karşılaştırma
            için cevaplarını yan yana oku.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.assessments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No baseline yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {stats.assessments.map((assessment) => (
                <li
                  key={assessment.createdAt}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span>
                    {assessment.kind === "baseline" ? "Baseline" : "Matched"} ·{" "}
                    {formatLocalDate(assessment.createdAt, profile.timezone)}
                  </span>
                  <span className="text-muted-foreground">
                    {assessment.estimatedLevel}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" className="h-11">
            <Link href="/assessment">
              {stats.assessments.length === 0
                ? "Start baseline"
                : "Open results"}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Learning pool</h2>
            </CardTitle>
            <CardDescription>
              “Mastered” is a label for long FSRS intervals; it can change back.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <Count label="New" value={pool.new ?? 0} />
              <Count
                label="Learning"
                value={(pool.learning ?? 0) + (pool.review ?? 0)}
              />
              <Count label="Mastered" value={pool.mastered ?? 0} />
              <Count label="Suggested" value={pool.suggested ?? 0} />
              <Count label="Archived" value={pool.archived ?? 0} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Recurring patterns</h2>
            </CardTitle>
            <CardDescription>
              Most frequent correction patterns from your session feedback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.patterns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No patterns yet — they appear after analyzed conversations.
              </p>
            ) : (
              <ul className="space-y-3">
                {stats.patterns.map((pattern) => (
                  <li
                    key={pattern.key}
                    className="rounded-lg border p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {pattern.key.replaceAll("_", " ")}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ×{pattern.occurrences}
                      </span>
                    </div>
                    {pattern.example && (
                      <p className="mt-1 text-xs">
                        <span className="text-muted-foreground line-through">
                          {pattern.example.original}
                        </span>{" "}
                        →{" "}
                        <span className="text-success">
                          {pattern.example.improved}
                        </span>
                      </p>
                    )}
                    {pattern.explanationTr && (
                      <p
                        lang="tr"
                        className="mt-1 text-xs text-muted-foreground"
                      >
                        {pattern.explanationTr}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function SkillSections() {
  const profile = await getProfile();
  const { listening, pronunciation, activity } = await getSkillProgress(
    profile.timezone,
  );
  const pct = (value: number | null) =>
    value === null ? "—" : `${Math.round(value * 100)}%`;
  const totalActivity = activity.weekdays.reduce((a, b) => a + b, 0);

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Listening</CardTitle>
          <CardDescription>
            Son 28 gündeki dikte ve anlama alıştırmaların.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Count label="Exercises" value={listening.count} />
            <div>
              <dt className="text-xs text-muted-foreground">Dictation</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {pct(listening.dictationAvg)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Comprehension</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {pct(listening.comprehensionAvg)}
              </dd>
            </div>
          </dl>
          {listening.count === 0 ? (
            <EmptyHint
              href="/listening"
              text="Henüz ölçülmedi — bir dikte ile başla."
            />
          ) : (
            <ScoreBars
              label="Recent listening scores"
              scores={listening.recent.map((r) => ({
                value: r.score * 100,
                at: r.at,
              }))}
              timeZone={profile.timezone}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pronunciation</CardTitle>
          <CardDescription>
            Sesli okuma değerlendirmeleri (Azure, otomatik tahmin).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-center">
            <Count label="Attempts" value={pronunciation.count} />
            <div>
              <dt className="text-xs text-muted-foreground">Average</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {pronunciation.average === null
                  ? "—"
                  : Math.round(pronunciation.average)}
              </dd>
            </div>
          </dl>
          {pronunciation.count === 0 ? (
            <EmptyHint
              href="/pronunciation"
              text="Henüz ölçülmedi — bir cümleyi sesli oku."
            />
          ) : (
            <ScoreBars
              label="Recent pronunciation scores"
              scores={pronunciation.recent.map((r) => ({
                value: r.score,
                at: r.at,
              }))}
              timeZone={profile.timezone}
            />
          )}
          {pronunciation.weakestSounds.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">En çok zorlandığın sesler</p>
              <ul className="space-y-2 text-sm">
                {pronunciation.weakestSounds.map((sound) => (
                  <li key={sound.phoneme} className="flex gap-3">
                    <span className="w-12 shrink-0 font-mono">
                      /{sound.phoneme}/
                    </span>
                    <span className="w-10 shrink-0 tabular-nums">
                      {Math.round(sound.average)}
                    </span>
                    <span lang="tr" className="text-muted-foreground">
                      {tipForPhoneme(sound.phoneme) ??
                        `${sound.samples} örnekte ortalama.`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>When you practise</CardTitle>
          <CardDescription>
            Son 28 gündeki çalışmaların gün ve saat dağılımı ({profile.timezone}
            ). Hatırlatmayı en çok çalıştığın zamana koymak işe yarar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totalActivity === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz veri yok.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <Distribution
                label="Weekday"
                names={WEEKDAYS_TR}
                counts={activity.weekdays}
              />
              <Distribution
                label="Time of day"
                names={[...DAYPARTS_TR]}
                counts={activity.dayparts}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyHint({ href, text }: { href: string; text: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      <Link
        href={href}
        className="text-primary underline-offset-4 hover:underline"
      >
        {text}
      </Link>
    </p>
  );
}

/** Latest scores as bars (0–100), oldest first, with an accessible list. */
function ScoreBars({
  label,
  scores,
  timeZone,
}: {
  label: string;
  scores: { value: number | null; at: string }[];
  timeZone: string;
}) {
  return (
    <figure className="space-y-1">
      <div className="flex h-20 items-end gap-1" aria-hidden>
        {scores.map((score, index) => (
          <div
            key={index}
            className="flex-1 rounded-t bg-primary/70"
            style={{ height: `${Math.max(4, score.value ?? 0)}%` }}
          />
        ))}
      </div>
      <figcaption className="text-xs text-muted-foreground">
        {label}: oldest → newest
      </figcaption>
      <ol className="sr-only">
        {scores.map((score, index) => (
          <li key={index}>
            {formatLocalDate(score.at, timeZone)}:{" "}
            {score.value === null ? "no score" : Math.round(score.value)}
          </li>
        ))}
      </ol>
    </figure>
  );
}

function Distribution({
  label,
  names,
  counts,
}: {
  label: string;
  names: string[];
  counts: number[];
}) {
  const max = Math.max(1, ...counts);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <dl className="space-y-1.5">
        {names.map((name, index) => (
          <div key={name} className="flex items-center gap-2 text-sm">
            <dt className="w-12 shrink-0 text-muted-foreground">{name}</dt>
            <dd className="flex flex-1 items-center gap-2">
              <span
                className="h-2.5 rounded-full bg-chart-2"
                style={{ width: `${(counts[index] / max) * 100}%` }}
                aria-hidden
              />
              <span className="tabular-nums">{counts[index]}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl font-semibold tabular-nums">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-secondary/50 px-2 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-xl font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
