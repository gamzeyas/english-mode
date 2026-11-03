import { uuidParam, withApi } from "@/lib/api/handler";
import { swapAssignment } from "@/lib/assignments/service";

/** POST /api/assignments/:id/swap -> assignment (replace with a similar-size alternative) */
export const POST = withApi(
  async (
    { user, profile },
    _request: Request,
    { params }: RouteContext<"/api/assignments/[id]/swap">,
  ) => {
    const { id } = await params;
    return {
      assignment: await swapAssignment(user, profile, uuidParam.parse(id)),
    };
  },
);
