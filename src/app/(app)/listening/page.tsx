import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { ListeningPractice } from "@/components/listening/listening-practice";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/dal";
import { listListeningExercises } from "@/lib/listening/service";

export const metadata: Metadata = { title: "Listening" };

export default function ListeningPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Listening"
        title="Listening practice"
        description="Dikte: duyduğun cümleyi yaz, kaçırdığın kelimeleri gör. Anlama: kısa bir diyaloğu dinle, soruları cevapla. Alıştırmalar hedeflerine ve ilgi alanlarına göre üretilir."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Loader />
      </Suspense>
    </PageContainer>
  );
}

async function Loader() {
  const user = await getCurrentUser();
  const exercises = await listListeningExercises(user);
  return <ListeningPractice exercises={exercises} />;
}
