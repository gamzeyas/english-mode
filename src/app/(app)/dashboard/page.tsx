import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Layers,
  Pencil,
  Play,
  Sparkles,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser, getProfile } from "@/lib/auth/dal";
import { listAssessments } from "@/lib/assessment/service";
import { nextMatchedAt } from "@/lib/assessment/tasks";
import { kindLabels, rankScenarios } from "@/lib/assignments/planner";
import { getAssignmentsOverview } from "@/lib/assignments/service";
import { formatLocalDate } from "@/lib/learning/day";
import { getLearningItems, getWeeklyStats } from "@/lib/learning/queries";
import { isDue } from "@/lib/learning/pool";
import { listScenarios } from "@/lib/scenarios/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Today" };

export default function DashboardPage() {
  return (
    <PageContainer>
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense
          fallback={<Skeleton className="h-96 rounded-xl lg:col-span-2" />}
        >
          <TodayPlan />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
          <DueCard />
        </Suspense>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
          <GoalsCard />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
          <NextScenarioCard />
        </Suspense>

        <Suspense
          fallback={
            <Skeleton className="h-48 rounded-xl md:col-span-2 lg:col-span-1" />
          }
        >
          <WeekCard />
        </Suspense>
      </div>

      <Suspense fallback={<Skeleton className="h-28 rounded-xl" />}>
        <BaselineCard />
      </Suspense>
    </PageContainer>
  );
}

async function Greeting() {
  const profile = await getProfile();
  const name = profile.display_name?.trim();

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">
        Today
      </p>
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {name
          ? `Hi ${name} — ready for a short session?`
          : "Ready for a short session?"}
      </h1>
      <p className="max-w-2xl text-sm text-pretty text-muted-foreground sm:text-base">
        5 dakikan bile varsa yeter. Günlük hedefin: {profile.daily_minutes}{" "}
        dakika.
      </p>
    </div>
  );
}

function GreetingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-8 w-80 max-w-full" />
      <Skeleton className="h-4 w-64 max-w-full" />
    </div>
  );
}

async function TodayPlan() {
  const [user, profile] = await Promise.all([getCurrentUser(), getProfile()]);
  const { today } = await getAssignmentsOverview(user, profile);
  const next = today.find((task) => task.status === "pending");
  const done = today.filter((task) => task.status === "completed").length;
  const minutes = today
    .filter((task) => task.status !== "skipped")
    .reduce((sum, task) => sum + task.estimatedMinutes, 0);

  return (
    <Card className="relative overflow-hidden lg:col-span-2">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-primary/15 blur-3xl"
      />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Sparkles aria-hidden className="size-4" />
          Today&apos;s plan
        </CardTitle>
        <CardDescription className="pt-1 text-lg font-semibold text-foreground sm:text-xl">
          {next
            ? next.title
            : today.length > 0
              ? "All done for today. Nice work."
              : "Nothing planned today."}
        </CardDescription>
        <p className="text-sm text-muted-foreground">
          {done}/{today.length} done · about {minutes} min. Vaktin azsa tek bir
          görev de sayılır.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="space-y-2">
          {today.map((task, index) => (
            <li key={task.id} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums",
                  task.status === "completed"
                    ? "bg-success/20 text-success"
                    : "bg-secondary",
                )}
              >
                {task.status === "completed" ? (
                  <Check aria-hidden className="size-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "flex-1",
                  task.status === "skipped" &&
                    "text-muted-foreground line-through",
                )}
              >
                {task.title}
                <span className="sr-only">
                  {" "}
                  ({kindLabels[task.kind]}, {task.status})
                </span>
              </span>
              <span className="text-muted-foreground tabular-nums">
                {task.estimatedMinutes} min
              </span>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2 sm:flex-row">
          {next && (
            <Button asChild size="lg" className="h-12 text-base sm:px-6">
              <Link href={next.href ?? "/assignments"}>
                <Play aria-hidden /> Start: {kindLabels[next.kind]}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="lg" className="h-12">
            <Link href="/assignments">
              All assignments <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

async function NextScenarioCard() {
  const [user, scenarios, supabase] = await Promise.all([
    getCurrentUser(),
    listScenarios(),
    createClient(),
  ]);
  const { data: recent } = await supabase
    .from("sessions")
    .select("scenario_id")
    .eq("user_id", user.id)
    .not("scenario_id", "is", null)
    .order("started_at", { ascending: false })
    .limit(20);
  const slugById = new Map(scenarios.map((s) => [s.id, s.slug]));
  const recentSlugs = (recent ?? [])
    .map((row) => slugById.get(row.scenario_id as string))
    .filter((slug): slug is string => Boolean(slug));
  const [nextSlug] = rankScenarios(
    scenarios.map((s) => ({
      slug: s.slug,
      title: s.title,
      personaName: s.persona.name,
    })),
    recentSlugs,
  );
  const next = scenarios.find((s) => s.slug === nextSlug?.slug);
  if (!next) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Next scenario</CardTitle>
        <CardDescription>
          {next.persona.name} · {next.persona.role}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium">{next.title}</p>
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href={`/scenarios/${next.slug}`}>
            Preview scenario <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

async function BaselineCard() {
  const [user, profile] = await Promise.all([getCurrentUser(), getProfile()]);
  const [latest] = await listAssessments(user);
  const opensAt = latest ? nextMatchedAt(latest.createdAt, new Date()) : null;

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ClipboardCheck aria-hidden className="size-5 shrink-0 text-chart-4" />
        <div className="flex-1 text-sm">
          {latest ? (
            <>
              <p className="font-medium">
                {latest.kind === "baseline" ? "Baseline" : "Matched task"} ·{" "}
                {formatLocalDate(latest.createdAt, profile.timezone)}
              </p>
              <p className="text-muted-foreground">
                {opensAt
                  ? `Bir sonraki eşleştirilmiş görev ${formatLocalDate(opensAt.toISOString(), profile.timezone)} tarihinde açılır.`
                  : "Eşleştirilmiş görev hazır: aynı görevleri tekrar yazıp ilerlemeni karşılaştır."}
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Take your 10-minute baseline</p>
              <p className="text-muted-foreground">
                Üç kısa yazma görevi. İki hafta sonra aynı görevlerle
                karşılaştırırsın.
              </p>
            </>
          )}
        </div>
        <Button asChild variant="outline" className="h-11">
          <Link href="/assessment">
            {latest && !opensAt
              ? "Start matched task"
              : latest
                ? "View results"
                : "Start baseline"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

async function DueCard() {
  const items = await getLearningItems();
  const now = new Date();
  const due = items.filter((item) => isDue(item, now));
  const pending = items.filter((item) => item.status === "suggested").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers aria-hidden className="size-4 text-chart-2" />
          Due phrases
        </CardTitle>
        <CardDescription>
          {due.length > 0
            ? `${due.length} saved ${due.length === 1 ? "phrase is" : "phrases are"} ready to practice.`
            : "Nothing due right now."}
          {pending > 0 &&
            ` ${pending} suggestion${pending === 1 ? "" : "s"} awaiting approval.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {due.length > 0 && (
          <ul className="space-y-2">
            {due.slice(0, 3).map((item) => (
              <li
                key={item.id}
                className="rounded-lg border bg-secondary/40 px-3 py-2 text-sm font-medium"
              >
                {item.phrase}
              </li>
            ))}
          </ul>
        )}
        {due.length > 0 ? (
          <Button asChild className="h-11 w-full">
            <Link href="/review">
              Start review <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="secondary" className="h-11 w-full">
            <Link href="/learning-pool">
              Open learning pool <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

async function WeekCard() {
  const profile = await getProfile();
  const stats = await getWeeklyStats(profile.timezone);
  return (
    <Card className="md:col-span-2 lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays aria-hidden className="size-4 text-chart-4" />
          Last 7 days
        </CardTitle>
        <CardDescription>
          Consistency, not streaks. Missing a day is fine.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Active days" value={`${stats.activeDays}/7`} />
          <Stat label="Sessions" value={String(stats.sessionsCompleted)} />
          <Stat label="Saved phrases" value={String(stats.savedPhrases)} />
        </dl>
      </CardContent>
    </Card>
  );
}

async function GoalsCard() {
  const profile = await getProfile();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target aria-hidden className="size-4 text-chart-3" />
          Goals & interests
          <Button
            asChild
            variant="ghost"
            size="icon-lg"
            className="ml-auto"
            aria-label="Edit goals and interests"
          >
            <Link href="/onboarding">
              <Pencil aria-hidden />
            </Link>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <TagList items={profile.goals} empty="No goals yet" />
        <TagList items={profile.interests} empty="No interests yet" muted />
      </CardContent>
    </Card>
  );
}

function TagList({
  items,
  empty,
  muted,
}: {
  items: string[];
  empty: string;
  muted?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className={
            muted
              ? "rounded-full border px-3 py-1 text-xs text-muted-foreground"
              : "rounded-full bg-secondary px-3 py-1 text-xs font-medium"
          }
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 px-2 py-3">
      <dt className="text-[0.7rem] text-muted-foreground">{label}</dt>
      <dd className="font-heading text-xl font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
