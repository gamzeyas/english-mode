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
import { getProgressStats, MIN_SAMPLE } from "@/lib/learning/progress";

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
