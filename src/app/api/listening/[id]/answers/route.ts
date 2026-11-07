import { z } from "zod";
import { readJson, uuidParam, withApi } from "@/lib/api/handler";
import {
  MAX_DICTATION_ANSWER,
  submitListeningAnswers,
} from "@/lib/listening/service";

const bodySchema = z.object({
  dictation: z.array(z.string().max(MAX_DICTATION_ANSWER)).max(10).optional(),
  choices: z.array(z.number().int().min(0).max(3).nullable()).max(5).optional(),
});

/** POST /api/listening/:id/answers {dictation | choices} -> graded {exercise} */
export const POST = withApi(
  async (
    { user, profile },
    request: Request,
    { params }: RouteContext<"/api/listening/[id]/answers">,
  ) => {
    const { id } = await params;
    const body = await readJson(request, bodySchema);
    return {
      exercise: await submitListeningAnswers(
        user,
        profile,
        uuidParam.parse(id),
        body,
      ),
    };
  },
);
