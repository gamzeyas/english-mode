import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChatSession } from "@/components/conversation/chat-session";
import { Skeleton } from "@/components/ui/skeleton";
import { uuidParam } from "@/lib/api/handler";
import { findSessionView } from "@/lib/sessions/service";

export const metadata: Metadata = { title: "Conversation" };

// Session ids are request-time params, so param access sits behind Suspense.
export default function ConversationPage({
  params,
}: PageProps<"/conversation/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-2/3" />
        </div>
      }
    >
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({
  params,
}: {
  params: PageProps<"/conversation/[id]">["params"];
}) {
  const { id } = await params;
  const parsed = uuidParam.safeParse(id);
  if (!parsed.success) notFound();

  const session = await findSessionView(parsed.data);
  if (!session) notFound();
  return <ChatSession session={session} />;
}
