import { uuidParam, withApi } from "@/lib/api/handler";
import { translateMessage } from "@/lib/assist/service";

/** POST /api/messages/:id/translation -> {textTr} (generated once, then stored) */
export const POST = withApi(
  async (
    { user },
    _request: Request,
    { params }: RouteContext<"/api/messages/[id]/translation">,
  ) => {
    const { id } = await params;
    return { textTr: await translateMessage(user, uuidParam.parse(id)) };
  },
);
