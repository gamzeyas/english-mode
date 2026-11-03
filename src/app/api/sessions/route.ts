import { z } from "zod";
import { readJson, withApi } from "@/lib/api/handler";
import { isSessionMinutes } from "@/lib/sessions/durations";
import { createSession } from "@/lib/sessions/service";

const bodySchema = z.object({
  mode: z.literal("text").default("text"),
  scenarioId: z.string().max(100).nullish(),
  durationGoalMinutes: z.number().int().refine(isSessionMinutes).nullish(),
  difficulty: z.enum(["easy", "medium", "hard", "adaptive"]).nullish(),
  assignmentId: z.uuid().nullish(),
});

/** POST /api/sessions {mode, scenarioId?, durationGoalMinutes?, difficulty?, assignmentId?} -> {sessionId, status} */
export const POST = withApi(async ({ user, profile }, request: Request) => {
  const body = await readJson(request, bodySchema);
  const sessionId = await createSession(user, profile, {
    scenarioSlug: body.scenarioId ?? null,
    durationGoalMinutes: body.durationGoalMinutes ?? null,
    difficulty: body.difficulty ?? null,
    assignmentId: body.assignmentId ?? null,
  });
  return { sessionId, status: "active" };
});
