import { z } from "zod";
import { readJson, uuidParam, withApi } from "@/lib/api/handler";
import { gradeCard } from "@/lib/review/service";
import type { Grade } from "@/lib/srs/scheduler";

const grade = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const bodySchema = z.object({
  grade,
  answer: z.string().max(2000).default(""),
  clientRequestId: z.uuid(),
  aiSuggestedGrade: grade.nullish(),
});

/** POST /api/review/:id/grade {grade, answer, clientRequestId} -> {nextDue, reviewLogId} (idempotent) */
export const POST = withApi(
  async (
    { user },
    request: Request,
    { params }: RouteContext<"/api/review/[id]/grade">,
  ) => {
    const { id } = await params;
    const body = await readJson(request, bodySchema);
    return gradeCard(user, uuidParam.parse(id), {
      grade: body.grade as Grade,
      answer: body.answer,
      clientRequestId: body.clientRequestId,
      aiSuggestedGrade: (body.aiSuggestedGrade ?? null) as Grade | null,
    });
  },
);
