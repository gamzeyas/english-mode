import { uuidParam, withApi } from "@/lib/api/handler";
import { deletePronunciationAttempt } from "@/lib/pronunciation/service";

/** DELETE /api/pronunciation/:id -> removes the attempt */
export const DELETE = withApi(
  async (
    { user },
    _request: Request,
    { params }: RouteContext<"/api/pronunciation/[id]">,
  ) => {
    const { id } = await params;
    await deletePronunciationAttempt(user, uuidParam.parse(id));
    return { ok: true };
  },
);
