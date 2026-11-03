import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { AssessmentForm } from "@/components/assessment/assessment-form";
import {
  AssessmentComparison,
  AssessmentSummary,
} from "@/components/assessment/assessment-results";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser, getProfile } from "@/lib/auth/dal";
import { listAssessments } from "@/lib/assessment/service";
import { nextMatchedAt } from "@/lib/assessment/tasks";
import { formatLocalDate } from "@/lib/learning/day";

export const metadata: Metadata = { title: "Baseline" };

export default function AssessmentPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Baseline"
        title="Baseline & matched tasks"
        description="Üç kısa yazma görevi (~10 dk). İki haftada bir aynı görevleri tekrar yazarsın; böylece ilerlemeni aynı ölçütlerle karşılaştırabilirsin. Gayriresmîdir, resmî CEFR sonucu değildir."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Assessments />
      </Suspense>
    </PageContainer>
  );
}

async function Assessments() {
  const [user, profile] = await Promise.all([getCurrentUser(), getProfile()]);
  const assessments = await listAssessments(user);
  const [latest] = assessments;
  const baseline = assessments.findLast((a) => a.kind === "baseline");
  const opensAt = latest ? nextMatchedAt(latest.createdAt, new Date()) : null;

  return (
    <div className="space-y-6">
      {!latest && <AssessmentForm kind="baseline" />}
      {latest && !opensAt && (
        <section aria-labelledby="matched-heading" className="space-y-3">
          <h2
            id="matched-heading"
            className="font-heading text-lg font-semibold"
          >
            Matched task is open
          </h2>
          <AssessmentForm kind="matched" />
        </section>
      )}
      {latest && opensAt && (
        <Card size="sm">
          <CardContent className="text-sm text-muted-foreground">
            Bir sonraki eşleştirilmiş görev{" "}
            <strong className="text-foreground">
              {formatLocalDate(opensAt.toISOString(), profile.timezone)}
            </strong>{" "}
            tarihinde açılır.
          </CardContent>
        </Card>
      )}
      {latest && (
        <AssessmentSummary assessment={latest} timeZone={profile.timezone} />
      )}
      {baseline && latest && baseline.id !== latest.id && (
        <AssessmentComparison
          baseline={baseline}
          latest={latest}
          timeZone={profile.timezone}
        />
      )}
    </div>
  );
}
