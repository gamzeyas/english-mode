import { z } from "zod";
import { readJson, uuidParam, withApi } from "@/lib/api/handler";
import { speakMessage } from "@/lib/speech/speak";
import { TTS_MIME_TYPE } from "@/lib/speech/tts";

const bodySchema = z.object({
  rate: z.enum(["slow", "normal"]).default("normal"),
});

/** POST /api/messages/:id/speech {rate} -> MP3 of a coach turn */
export const POST = withApi(
  async (
    { user, profile },
    request: Request,
    { params }: RouteContext<"/api/messages/[id]/speech">,
  ) => {
    const { id } = await params;
    const body = await readJson(request, bodySchema);
    const audio = await speakMessage(
      user,
      profile,
      uuidParam.parse(id),
      body.rate,
    );
    return new Response(audio, { headers: { "content-type": TTS_MIME_TYPE } });
  },
);
