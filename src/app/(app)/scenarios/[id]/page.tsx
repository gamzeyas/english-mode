import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, UserRound } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { StartRoleplay } from "@/components/scenarios/start-roleplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { uuidParam } from "@/lib/api/handler";
import { getCurrentUser, getProfile } from "@/lib/auth/dal";
import { formatLocalDate } from "@/lib/learning/day";
import {
  scenarioCatalog,
  scenarioCategoryLabels,
} from "@/lib/scenarios/catalog";
import { getScenario } from "@/lib/scenarios/queries";
import { createClient } from "@/lib/supabase/server";

// The route segment is the scenario slug (PRD route: /scenarios/[id]).
// Catalog slugs are known at build time; the scenario itself is read from
// the database at request time.
export async function generateStaticParams() {
  return scenarioCatalog.map((scenario) => ({ id: scenario.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/scenarios/[id]">): Promise<Metadata> {
  const { id } = await params;
  return {
    title: scenarioCatalog.find((s) => s.slug === id)?.title ?? "Scenario",
  };
}

export default function ScenarioPage({
  params,
  searchParams,
}: PageProps<"/scenarios/[id]">) {
  return (
    <PageContainer>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ScenarioDetail params={params} searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function ScenarioDetail({
  params,
  searchParams,
}: {
  params: PageProps<"/scenarios/[id]">["params"];
  searchParams: PageProps<"/scenarios/[id]">["searchParams"];
}) {
  const [{ id }, { assignment }] = await Promise.all([params, searchParams]);
  const scenario = await getScenario(id);
  if (!scenario) notFound();
  const assignmentId =
    typeof assignment === "string" && uuidParam.safeParse(assignment).success
      ? assignment
      : null;

  return (
    <>
      <Button asChild variant="ghost" className="-ml-2 h-10">
        <Link href="/scenarios">
          <ArrowLeft aria-hidden /> All scenarios
        </Link>
      </Button>

      <PageHeader
        eyebrow={`${scenarioCategoryLabels[scenario.category]} · ${scenario.difficulty}`}
        title={scenario.title}
        description={scenario.summary}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound aria-hidden className="size-4 text-chart-2" />{" "}
              Character
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-base font-semibold">{scenario.persona.name}</p>
            <p className="text-muted-foreground">{scenario.persona.role}</p>
            <p className="pt-2">{scenario.persona.style}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your goals</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {scenario.goals.map((goal) => (
                <li key={goal} className="flex gap-2">
                  <CheckCircle2
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-success"
                  />
                  {goal}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debrief rubric</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              {scenario.rubric.map((criterion) => (
                <div key={criterion.key}>
                  <dt className="font-medium">{criterion.label}</dt>
                  <dd className="text-muted-foreground">
                    {criterion.description}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <StartRoleplay
        slug={scenario.slug}
        durationOptions={scenario.durationOptions}
        defaultDifficulty={scenario.difficulty}
        assignmentId={assignmentId}
      />

      <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
        <PastDebriefs scenarioId={scenario.id} />
      </Suspense>
    </>
  );
}

async function PastDebriefs({ scenarioId }: { scenarioId: string }) {
  const [user, profile, supabase] = await Promise.all([
    getCurrentUser(),
    getProfile(),
    createClient(),
  ]);
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, started_at")
    .eq("user_id", user.id)
    .eq("scenario_id", scenarioId)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(5);
  if (!sessions || sessions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Past debriefs</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                href={`/conversation/${session.id}/feedback`}
                className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-primary"
              >
                {formatLocalDate(session.started_at, profile.timezone)}
                <span className="text-primary">View debrief</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
