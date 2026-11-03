import { uuidParam, withApi } from "@/lib/api/handler";
import { getSessionView } from "@/lib/sessions/service";

/** GET /api/sessions/:id -> session and the learner's own messages */
export const GET = withApi(
  async (
    _context,
    _request: Request,
    { params }: RouteContext<"/api/sessions/[id]">,
  ) => {
    const { id } = await params;
    return getSessionView(uuidParam.parse(id));
  },
);
