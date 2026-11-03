import { withApi, uuidParam } from "@/lib/api/handler";
import { MAX_WAV_BYTES } from "@/lib/audio/wav";
import { SessionError } from "@/lib/sessions/errors";
import { transcribeRecording } from "@/lib/speech/service";

/**
 * POST /api/audio/transcribe multipart {audio: 16 kHz mono WAV, sessionId?}
 * -> {transcript, durationSeconds, confidence}. Consent required; the audio
 * itself is never stored.
 */
export const POST = withApi(async ({ user, profile }, request: Request) => {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_WAV_BYTES + 4096) throw new SessionError("invalid_request");

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob)) throw new SessionError("invalid_request");
  const rawSession = form?.get("sessionId");
  const sessionId =
    typeof rawSession === "string" && uuidParam.safeParse(rawSession).success
      ? rawSession
      : null;

  return transcribeRecording(user, profile, { audio, sessionId });
});
