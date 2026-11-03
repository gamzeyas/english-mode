import { z } from "zod";
import { MAX_MESSAGE_CHARS } from "@/lib/ai/config";
import { readJson, uuidParam, withApi } from "@/lib/api/handler";
import { sendMessage } from "@/lib/sessions/service";

const bodySchema = z.object({
  content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  clientMessageId: z.uuid(),
  /** "speech_transcript" when the learner dictated (and maybe corrected) it. */
  modality: z.enum(["text", "speech_transcript"]).default("text"),
});

/** POST /api/sessions/:id/messages {content, clientMessageId, modality?} -> {message, assistantMessage} (idempotent) */
export const POST = withApi(
  async (
    { user, profile },
    request: Request,
    { params }: RouteContext<"/api/sessions/[id]/messages">,
  ) => {
    const { id } = await params;
    const body = await readJson(request, bodySchema);
    return sendMessage(user, profile, uuidParam.parse(id), body);
  },
);
