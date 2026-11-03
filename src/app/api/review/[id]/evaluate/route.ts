import { z } from "zod";
import { readJson, uuidParam, withApi } from "@/lib/api/handler";
import { evaluateAttempt } from "@/lib/review/service";

const bodySchema = z.object({ answer: z.string().trim().min(1).max(2000) });

/** POST /api/review/:id/evaluate {answer} -> advisory AI grade (never applied automatically) */
export const POST = withApi(
  async (
    { user },
    request: Request,
    { params }: RouteContext<"/api/review/[id]/evaluate">,
  ) => {
    const { id } = await params;
    const { answer } = await readJson(request, bodySchema);
    return evaluateAttempt(user, uuidParam.parse(id), answer);
  },
);
