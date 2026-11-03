import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Play, UserRound } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { DemoBanner } from "@/components/layout/demo-banner";
import { DemoBadge } from "@/components/demo-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  demoScenarios,
  getDemoScenario,
  scenarioCategoryLabels,
} from "@/lib/demo/scenarios";

// The route segment is the scenario slug (PRD route: /scenarios/[id]).
export async function generateStaticParams() {
  return demoScenarios.map((scenario) => ({ id: scenario.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/scenarios/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getDemoScenario(id)?.title ?? "Scenario" };
}

// Unknown slugs are request-time params, so param access sits behind Suspense.
export default function ScenarioPage({ params }: PageProps<"/scenarios/[id]">) {
  return (
    <PageContainer>
      <DemoBanner milestone="Milestone 4" />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ScenarioDetail params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function ScenarioDetail({
  params,
}: {
  params: PageProps<"/scenarios/[id]">["params"];
}) {
  const { id } = await params;
  const scenario = getDemoScenario(id);
  if (!scenario) notFound();

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
        actions={<DemoBadge label="Demo template" />}
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

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">Session length</p>
            <p className="text-sm text-muted-foreground">
              {scenario.durationOptions
                .map((minutes) => `${minutes} min`)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
            <Button disabled size="lg" className="h-12 px-6 text-base">
              <Play aria-hidden /> Start roleplay
            </Button>
            <p className="text-xs text-muted-foreground">
              Roleplay sessions arrive in Milestone 4.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
