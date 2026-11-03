import { uuidParam, withApi } from "@/lib/api/handler";
import { rescheduleAssignment } from "@/lib/assignments/service";

/** POST /api/assignments/:id/reschedule -> assignment (move to the next local day) */
export const POST = withApi(
  async (
    { user, profile },
    _request: Request,
    { params }: RouteContext<"/api/assignments/[id]/reschedule">,
  ) => {
    const { id } = await params;
    return {
      assignment: await rescheduleAssignment(
        user,
        profile,
        uuidParam.parse(id),
      ),
    };
  },
);
