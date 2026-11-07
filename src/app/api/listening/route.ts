import { z } from "zod";
import { readJson, withApi } from "@/lib/api/handler";
import {
  createListeningExercise,
  listListeningExercises,
} from "@/lib/listening/service";

const bodySchema = z.object({ kind: z.enum(["dictation", "comprehension"]) });

/** GET /api/listening -> recent exercises, newest first */
export const GET = withApi(async ({ user }) => ({
  exercises: await listListeningExercises(user),
}));

/** POST /api/listening {kind} -> {exercise} generated for this learner */
export const POST = withApi(async ({ user, profile }, request: Request) => {
  const body = await readJson(request, bodySchema);
  return {
    exercise: await createListeningExercise(user, profile, body.kind),
  };
});
