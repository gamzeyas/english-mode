import { uuidParam, withApi } from "@/lib/api/handler";
import { skipAssignment } from "@/lib/assignments/service";

/** POST /api/assignments/:id/skip -> assignment (skip without penalty) */
export const POST = withApi(
  async (
    { user },
    _request: Request,
    { params }: RouteContext<"/api/assignments/[id]/skip">,
  ) => {
    const { id } = await params;
    return { assignment: await skipAssignment(user, uuidParam.parse(id)) };
  },
);
