import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Layers, Pencil, Target } from "lucide-react";
import { PageContainer } from "@/components/layout/app-shell";
import { DemoBadge } from "@/components/demo-badge";
import { MissionCard } from "@/components/dashboard/mission-card";
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
import { demoMission } from "@/lib/demo/data";
import { getLearningItems, getWeeklyStats } from "@/lib/learning/queries";
import { demoScenarios } from "@/lib/demo/scenarios";
import { isDue } from "@/lib/learning/pool";
import type { DailyMinutes } from "@/types/domain";

export const metadata: Metadata = { title: "Today" };

export default function DashboardPage() {
  const nextScenario = demoScenarios[0];

  return (
    <PageContainer>
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense
          fallback={<Skeleton className="h-96 rounded-xl lg:col-span-2" />}
        >
          <Mission />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
          <DueCard />
        </Suspense>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
          <GoalsCard />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Next scenario
              <DemoBadge className="ml-auto" />
            </CardTitle>
            <CardDescription>{nextScenario.persona.role}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium">{nextScenario.title}</p>
            <Button asChild variant="outline" className="h-11 w-full">
              <Link href={`/scenarios/${nextScenario.slug}`}>
                Preview scenario <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Suspense
          fallback={
            <Skeleton className="h-48 rounded-xl md:col-span-2 lg:col-span-1" />
          }
        >
          <WeekCard />
        </Suspense>
      </div>
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

async function Mission() {
  const profile = await getProfile();
  return (
    <MissionCard
      mission={demoMission}
      defaultMinutes={profile.daily_minutes as DailyMinutes}
      className="lg:col-span-2"
    />
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
        <Button asChild variant="secondary" className="h-11 w-full">
          <Link href="/learning-pool">
            Open learning pool <ArrowRight aria-hidden />
          </Link>
        </Button>
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
