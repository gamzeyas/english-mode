import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { WritingCoach } from "@/components/writing/writing-coach";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/dal";
import { listWritingEntries } from "@/lib/writing/service";

export const metadata: Metadata = { title: "Writing Coach" };

export default function WritingCoachPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Writing"
        title="Writing Coach"
        description="Bir metin yapıştır, amacını ve tonunu seç; koç daha doğal bir versiyon, kısa açıklamalar ve senin yeniden yazacağın bir alıştırma önersin."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Loader />
      </Suspense>
    </PageContainer>
  );
}

async function Loader() {
  const user = await getCurrentUser();
  const entries = await listWritingEntries(user);
  return <WritingCoach entries={entries} />;
}
