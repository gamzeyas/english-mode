import { uuidParam, withApi } from "@/lib/api/handler";
import { endSession } from "@/lib/sessions/service";

/** POST /api/sessions/:id/end -> {status}; feedback is then produced via /feedback. */
export const POST = withApi(
  async (
    { user },
    _request: Request,
    { params }: RouteContext<"/api/sessions/[id]/end">,
  ) => {
    const { id } = await params;
    return endSession(user, uuidParam.parse(id));
  },
);
