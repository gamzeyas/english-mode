import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { DemoBanner } from "@/components/layout/demo-banner";
import { DemoBadge } from "@/components/demo-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { demoScenarios, scenarioCategoryLabels } from "@/lib/demo/scenarios";

export const metadata: Metadata = { title: "Simulate" };

export default function ScenariosPage() {
  return (
    <PageContainer>
      <DemoBanner milestone="Milestone 4" />
      <PageHeader
        eyebrow="Simulate"
        title="Real-life scenarios"
        description="Mülakat, yatırımcı sunumu, müşteri toplantısı ya da festival sohbeti. Bunlar pratik amaçlıdır, resmi değerlendirme değildir."
        actions={<DemoBadge label="Demo templates" />}
      />
      <ul className="grid gap-4 sm:grid-cols-2">
        {demoScenarios.map((scenario) => (
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
        ))}
      </ul>
    </PageContainer>
  );
}
