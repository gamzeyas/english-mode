import { uuidParam, withApi } from "@/lib/api/handler";
import { rejectCandidate } from "@/lib/sessions/service";

/** POST /api/sessions/:id/learning-candidates/:candidateId/reject -> {ok} */
export const POST = withApi(
  async (
    { user },
    _request: Request,
    {
      params,
    }: RouteContext<"/api/sessions/[id]/learning-candidates/[candidateId]/reject">,
  ) => {
    const { id, candidateId } = await params;
    await rejectCandidate(
      user,
      uuidParam.parse(id),
      uuidParam.parse(candidateId),
    );
    return { ok: true };
  },
);
