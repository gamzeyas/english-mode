import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { PronunciationLab } from "@/components/pronunciation/pronunciation-lab";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser, getProfile } from "@/lib/auth/dal";
import { listPronunciationAttempts } from "@/lib/pronunciation/service";
import { MAX_REFERENCE_CHARS } from "@/lib/speech/pronunciation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pronunciation" };

export default function PronunciationPage({
  searchParams,
}: PageProps<"/pronunciation">) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pronunciation"
        title="Pronunciation lab"
        description="Bir cümle seç, önce dinle, sonra sesli oku. Azure kelime ve ses düzeyinde puan verir; zorlandığın sesler için Türkçe ipuçları görürsün."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Loader searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function Loader({
  searchParams,
}: {
  searchParams: PageProps<"/pronunciation">["searchParams"];
}) {
  const { set } = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [profile, attempts, { data: pool }] = await Promise.all([
    getProfile(),
    listPronunciationAttempts(user),
    supabase
      .from("learning_items")
      .select("id, phrase, meaning_tr")
      .eq("user_id", user.id)
      .in("status", ["new", "learning", "review", "mastered"])
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  return (
    <PronunciationLab
      attempts={attempts}
      dialect={profile.dialect === "en-GB" ? "en-GB" : "en-US"}
      initialSet={typeof set === "string" ? set : null}
      pool={(pool ?? [])
        .filter((item) => item.phrase.length <= MAX_REFERENCE_CHARS)
        .map((item) => ({
          id: item.id,
          text: item.phrase,
          meaningTr: item.meaning_tr,
        }))}
    />
  );
}
