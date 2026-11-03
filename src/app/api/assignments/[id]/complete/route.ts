import { uuidParam, withApi } from "@/lib/api/handler";
import { completeReview } from "@/lib/assignments/service";

/** POST /api/assignments/:id/complete -> assignment (review task done once a card was graded today) */
export const POST = withApi(
  async (
    { user, profile },
    _request: Request,
    { params }: RouteContext<"/api/assignments/[id]/complete">,
  ) => {
    const { id } = await params;
    return {
      assignment: await completeReview(user, profile, uuidParam.parse(id)),
    };
  },
);
