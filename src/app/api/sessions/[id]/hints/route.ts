import { uuidParam, withApi } from "@/lib/api/handler";
import { conversationHints } from "@/lib/assist/service";

/** POST /api/sessions/:id/hints -> {hints} for answering the coach's last turn */
export const POST = withApi(
  async (
    { user, profile },
    _request: Request,
    { params }: RouteContext<"/api/sessions/[id]/hints">,
  ) => {
    const { id } = await params;
    return {
      hints: await conversationHints(user, profile, uuidParam.parse(id)),
    };
  },
);
