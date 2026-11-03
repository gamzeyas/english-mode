import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { AssignmentList } from "@/components/assignments/assignment-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser, getProfile } from "@/lib/auth/dal";
import { getAssignmentsOverview } from "@/lib/assignments/service";

export const metadata: Metadata = { title: "Assignments" };

export default function AssignmentsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Homework"
        title="Assignments"
        description="Hedeflerine, tekrar kartlarına ve son oturumlarına göre kısa görevler. Atlayabilir, yarına erteleyebilir ya da değiştirebilirsin — suçluluk yok. Az vaktin varsa tek bir görev de sayılır."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Overview />
      </Suspense>
    </PageContainer>
  );
}

async function Overview() {
  const [user, profile] = await Promise.all([getCurrentUser(), getProfile()]);
  const overview = await getAssignmentsOverview(user, profile);

  return (
    <div className="space-y-8">
      <Section title="Today" id="today">
        <AssignmentList
          assignments={overview.today}
          empty="Bugün için görev yok."
        />
      </Section>
      {overview.overdue.length > 0 && (
        <Section
          title="Still open"
          id="overdue"
          description="Önceki günlerden kalanlar. İstersen yap, istersen atla."
        >
          <AssignmentList assignments={overview.overdue} empty="" />
        </Section>
      )}
      {overview.upcoming.length > 0 && (
        <Section title="Upcoming" id="upcoming">
          <AssignmentList assignments={overview.upcoming} empty="" />
        </Section>
      )}
      <Section title="Done & skipped" id="history" description="Son 14 gün.">
        <AssignmentList
          assignments={overview.history}
          empty="Henüz tamamlanan görev yok."
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  id,
  description,
  children,
}: {
  title: string;
  id: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3" aria-labelledby={`${id}-heading`}>
      <div>
        <h2 id={`${id}-heading`} className="font-heading text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
