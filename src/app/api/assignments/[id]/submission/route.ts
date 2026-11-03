import { z } from "zod";
import { readJson, uuidParam, withApi } from "@/lib/api/handler";
import { submitAnswer } from "@/lib/assignments/service";

const bodySchema = z.object({
  answer: z.string().trim().min(1).max(4000).nullish(),
});

/** POST /api/assignments/:id/submission {answer} -> assignment with feedback (idempotent) */
export const POST = withApi(
  async (
    { user, profile },
    request: Request,
    { params }: RouteContext<"/api/assignments/[id]/submission">,
  ) => {
    const { id } = await params;
    const body = await readJson(request, bodySchema);
    return {
      assignment: await submitAnswer(
        user,
        profile,
        uuidParam.parse(id),
        body.answer ?? null,
      ),
    };
  },
);
