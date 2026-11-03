import { uuidParam, withApi } from "@/lib/api/handler";
import { acceptCandidate } from "@/lib/sessions/service";

/** POST /api/sessions/:id/learning-candidates/:candidateId/accept -> {item} */
export const POST = withApi(
  async (
    { user },
    _request: Request,
    {
      params,
    }: RouteContext<"/api/sessions/[id]/learning-candidates/[candidateId]/accept">,
  ) => {
    const { id, candidateId } = await params;
    const item = await acceptCandidate(
      user,
      uuidParam.parse(id),
      uuidParam.parse(candidateId),
    );
    return { item };
  },
);
