import { z } from "zod";
import { readJson, withApi } from "@/lib/api/handler";
import { referenceSchema } from "@/lib/pronunciation/request";
import { referenceAudio } from "@/lib/pronunciation/service";
import { TTS_MIME_TYPE } from "@/lib/speech/tts";

const bodySchema = z.object({
  reference: referenceSchema,
  word: z.string().trim().min(1).max(40).optional(),
  rate: z.enum(["slow", "normal"]).default("normal"),
});

/** POST /api/pronunciation/reference {reference, word?, rate} -> MP3 sample */
export const POST = withApi(async ({ user, profile }, request: Request) => {
  const body = await readJson(request, bodySchema);
  const audio = await referenceAudio(user, profile, {
    ...body.reference,
    word: body.word,
    rate: body.rate,
  });
  return new Response(audio, { headers: { "content-type": TTS_MIME_TYPE } });
});
