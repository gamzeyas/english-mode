import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Progress"
        title="Progress"
        description="Kanıta dayalı ilerleme: tekrarlar, oturumlar ve karşılaştırılabilir görevler. Şişirilmiş puan yok."
      />
      <ComingSoon
        icon={BarChart3}
        milestone="Milestone 3–4"
        title="Evidence-based progress dashboard"
        description="Metrics will be derived from your real sessions and reviews, with sample-size warnings and no unearned percentage claims."
        bullets={[
          "Active days in the last 7 / 28 days (no punitive streaks)",
          "Due, reviewed and mastered phrases",
          "Error frequency per 100 comparable utterances",
          "Baseline and fortnightly matched tasks",
        ]}
      />
    </PageContainer>
  );
}
