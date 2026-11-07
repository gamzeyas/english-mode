import { uuidParam, withApi } from "@/lib/api/handler";
import { deleteListeningExercise } from "@/lib/listening/service";

/** DELETE /api/listening/:id -> removes the exercise */
export const DELETE = withApi(
  async (
    { user },
    _request: Request,
    { params }: RouteContext<"/api/listening/[id]">,
  ) => {
    const { id } = await params;
    await deleteListeningExercise(user, uuidParam.parse(id));
    return { ok: true };
  },
);
