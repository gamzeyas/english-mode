import { z } from "zod";
import { readJson, uuidParam, withApi } from "@/lib/api/handler";
import { listeningAudio } from "@/lib/listening/service";
import { TTS_MIME_TYPE } from "@/lib/speech/tts";

const bodySchema = z.object({
  item: z.number().int().min(0).max(20).default(0),
  rate: z.enum(["slow", "normal"]).default("normal"),
});

/** POST /api/listening/:id/audio {item, rate} -> MP3 of a sentence or dialogue */
export const POST = withApi(
  async (
    { user },
    request: Request,
    { params }: RouteContext<"/api/listening/[id]/audio">,
  ) => {
    const { id } = await params;
    const body = await readJson(request, bodySchema);
    const audio = await listeningAudio(
      user,
      uuidParam.parse(id),
      body.item,
      body.rate,
    );
    return new Response(audio, { headers: { "content-type": TTS_MIME_TYPE } });
  },
);
