import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/dal";
import { scenarioCategoryLabels } from "@/lib/scenarios/catalog";
import { listScenarios } from "@/lib/scenarios/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Simulate" };

export default function ScenariosPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Simulate"
        title="Real-life scenarios"
        description="Mülakat, yatırımcı sunumu, müşteri toplantısı ya da festival sohbeti. Sonunda ölçütlere göre bir değerlendirme alırsın. Bunlar pratik amaçlıdır, resmi değerlendirme değildir."
      />
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        }
      >
        <ScenarioGallery />
      </Suspense>
    </PageContainer>
  );
}

async function ScenarioGallery() {
  const [user, scenarios, supabase] = await Promise.all([
    getCurrentUser(),
    listScenarios(),
    createClient(),
  ]);
  const { data: sessions } = await supabase
    .from("sessions")
    .select("scenario_id")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .not("scenario_id", "is", null);
  const practiced = new Map<string, number>();
  for (const row of sessions ?? []) {
    const id = row.scenario_id as string;
    practiced.set(id, (practiced.get(id) ?? 0) + 1);
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {scenarios.map((scenario) => {
        const count = practiced.get(scenario.id) ?? 0;
        return (
          <li key={scenario.id}>
            <Link
              href={`/scenarios/${scenario.slug}`}
              className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
            >
              <Card className="h-full transition-colors group-hover:bg-secondary/40">
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {scenarioCategoryLabels[scenario.category]}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {scenario.difficulty}
                    </Badge>
                    {count > 0 && (
                      <Badge variant="outline">Practiced {count}×</Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {scenario.title}
                  </CardTitle>
                  <CardDescription>{scenario.summary}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {scenario.persona.name} · {scenario.persona.role}
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
                  />
                </CardContent>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
