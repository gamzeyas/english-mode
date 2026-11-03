import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { LearningPool } from "@/components/learning/learning-pool";
import { Skeleton } from "@/components/ui/skeleton";
import { getLearningItems } from "@/lib/learning/queries";

export const metadata: Metadata = { title: "Learning pool" };

export default function LearningPoolPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pool"
        title="Your learning pool"
        description="Konuşmalarından çıkan ve senin onayladığın ifadeler. Tekrar oturumları (FSRS) Milestone 3'te gelecek."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <PoolLoader />
      </Suspense>
    </PageContainer>
  );
}

async function PoolLoader() {
  const items = await getLearningItems();
  return <LearningPool items={items} now={new Date().toISOString()} />;
}
