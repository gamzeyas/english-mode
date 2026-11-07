import { withApi } from "@/lib/api/handler";
import {
  assessPronunciation,
  listPronunciationAttempts,
} from "@/lib/pronunciation/service";
import { referenceSchema } from "@/lib/pronunciation/request";
import { SessionError } from "@/lib/sessions/errors";
import { MAX_ASSESSMENT_SECONDS } from "@/lib/speech/pronunciation";

/** ~30 s of 16 kHz mono 16-bit WAV plus headroom; checked before parsing. */
const MAX_UPLOAD_BYTES = 44 + (MAX_ASSESSMENT_SECONDS + 2) * 32_000 + 4_096;

/** GET /api/pronunciation -> recent attempts, newest first */
export const GET = withApi(async ({ user }) => ({
  attempts: await listPronunciationAttempts(user),
}));

/**
 * POST /api/pronunciation (multipart: audio, reference JSON) -> {attempt}
 * Read-aloud assessment against a server-resolved reference text.
 */
export const POST = withApi(async ({ user, profile }, request: Request) => {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES)
    throw new SessionError(
      "invalid_request",
      `Kayıt en fazla ${MAX_ASSESSMENT_SECONDS} saniye olabilir.`,
    );
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const reference = form?.get("reference");
  if (!(audio instanceof Blob) || typeof reference !== "string")
    throw new SessionError("invalid_request");
  let parsed;
  try {
    parsed = referenceSchema.parse(JSON.parse(reference));
  } catch {
    throw new SessionError("invalid_request");
  }
  return {
    attempt: await assessPronunciation(user, profile, {
      audio,
      reference: parsed,
    }),
  };
});
