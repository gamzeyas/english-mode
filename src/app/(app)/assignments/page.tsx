import type { Metadata } from "next";
import { BookOpenText } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Assignments" };

export default function AssignmentsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Homework"
        title="Assignments"
        description="Son oturumuna ve hedeflerine göre kısa ödevler. Atlayabilir veya erteleyebilirsin — suçluluk yok."
      />
      <ComingSoon
        icon={BookOpenText}
        milestone="Milestone 4"
        title="Adaptive homework"
        description="One suggested task after each session, submitted as text or (later) recorded speech."
        bullets={[
          "Today, due, completed and skipped lists",
          "Text submissions with feedback",
          "Skip or reschedule without penalties",
        ]}
      />
    </PageContainer>
  );
}
