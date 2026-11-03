import { z } from "zod";
import { readJson, withApi } from "@/lib/api/handler";
import { listAssessments, submitAssessment } from "@/lib/assessment/service";
import { ASSESSMENT_TASKS } from "@/lib/assessment/tasks";

const bodySchema = z.object({
  answers: z.object(
    Object.fromEntries(
      ASSESSMENT_TASKS.map((task) => [task.key, z.string().trim().max(1500)]),
    ),
  ),
});

/** GET /api/assessments -> baseline and matched results, newest first */
export const GET = withApi(async ({ user }) => ({
  assessments: await listAssessments(user),
}));

/** POST /api/assessments {answers} -> {id}; baseline first, matched every 14 days */
export const POST = withApi(async ({ user, profile }, request: Request) => {
  const body = await readJson(request, bodySchema);
  return submitAssessment(
    user,
    profile,
    body.answers as Record<string, string>,
  );
});
