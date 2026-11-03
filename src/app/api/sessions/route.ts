import { z } from "zod";
import { readJson, withApi } from "@/lib/api/handler";
import { createSession } from "@/lib/sessions/service";

const bodySchema = z.object({
  mode: z.literal("text").default("text"),
  scenarioId: z.string().max(100).nullish(),
  durationGoalMinutes: z
    .union([z.literal(5), z.literal(15), z.literal(25), z.literal(30)])
    .nullish(),
});

/** POST /api/sessions {mode, scenarioId?, durationGoalMinutes?} -> {sessionId, status} */
export const POST = withApi(async ({ user, profile }, request: Request) => {
  const body = await readJson(request, bodySchema);
  const sessionId = await createSession(user, profile, {
    scenarioSlug: body.scenarioId ?? null,
    durationGoalMinutes: body.durationGoalMinutes ?? null,
  });
  return { sessionId, status: "active" };
});
