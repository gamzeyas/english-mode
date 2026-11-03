import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { NewConversationForm } from "@/components/conversation/new-conversation-form";
import { Skeleton } from "@/components/ui/skeleton";
import { uuidParam } from "@/lib/api/handler";
import { getProfile } from "@/lib/auth/dal";
import { isSessionMinutes } from "@/lib/sessions/durations";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Speak" };

export default function NewConversationPage({
  searchParams,
}: PageProps<"/conversation/new">) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Speak"
        title="Start a conversation"
        description="Koç tek seferde bir soru sorar; sen doğal şekilde cevap verirsin. Geri bildirim oturum sonunda gelir."
      />
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <FormLoader searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function FormLoader({
  searchParams,
}: {
  searchParams: PageProps<"/conversation/new">["searchParams"];
}) {
  const [{ scenario, assignment, minutes }, profile, supabase] =
    await Promise.all([searchParams, getProfile(), createClient()]);
  const { data: scenarios } = await supabase
    .from("scenarios")
    .select("slug, title")
    .order("title");
  const list = scenarios ?? [];
  const requested = typeof scenario === "string" ? scenario : null;
  const assignmentId =
    typeof assignment === "string" && uuidParam.safeParse(assignment).success
      ? assignment
      : null;
  const requestedMinutes = Number(minutes);
  const defaultMinutes = isSessionMinutes(requestedMinutes)
    ? requestedMinutes
    : profile.daily_minutes;

  return (
    <NewConversationForm
      scenarios={list}
      defaultMinutes={defaultMinutes}
      feedbackMode={profile.feedback_mode}
      initialScenario={
        list.some((s) => s.slug === requested) ? requested : null
      }
      assignmentId={assignmentId}
    />
  );
}
