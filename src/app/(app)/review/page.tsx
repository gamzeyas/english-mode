import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { ReviewSession } from "@/components/review/review-session";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Review"
        title="Recall practice"
        description="Önce ifadeyi kendin hatırlamaya çalış, sonra cevabı gör ve ne kadar zorlandığını işaretle. Bir sonraki tekrar tarihini FSRS belirler."
      />
      <ReviewSession />
    </PageContainer>
  );
}
