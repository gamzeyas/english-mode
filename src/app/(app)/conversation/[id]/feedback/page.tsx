import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/layout/app-shell";
import { FeedbackView } from "@/components/conversation/feedback-view";
import { Skeleton } from "@/components/ui/skeleton";
import { uuidParam } from "@/lib/api/handler";
import { findSessionView, getFeedbackState } from "@/lib/sessions/service";

export const metadata: Metadata = { title: "Session feedback" };

export default function FeedbackPage({
  params,
}: PageProps<"/conversation/[id]/feedback">) {
  return (
    <PageContainer>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Feedback params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function Feedback({
  params,
}: {
  params: PageProps<"/conversation/[id]/feedback">["params"];
}) {
  const { id } = await params;
  const parsed = uuidParam.safeParse(id);
  if (!parsed.success) notFound();

  const session = await findSessionView(parsed.data);
  if (!session) notFound();
  const state = await getFeedbackState(session.id);

  return (
    <FeedbackView
      sessionId={session.id}
      title={session.scenario?.title ?? "Free conversation"}
      userTurns={session.messages.filter((m) => m.role === "user").length}
      initialState={state}
      debrief={
        session.scenario
          ? { rubric: session.scenario.rubric, goals: session.scenario.goals }
          : null
      }
    />
  );
}
