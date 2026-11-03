import { uuidParam, withApi } from "@/lib/api/handler";
import { deleteWritingEntry } from "@/lib/writing/service";

/** DELETE /api/writing/:id -> removes the entry */
export const DELETE = withApi(
  async (
    { user },
    _request: Request,
    { params }: RouteContext<"/api/writing/[id]">,
  ) => {
    const { id } = await params;
    await deleteWritingEntry(user, uuidParam.parse(id));
    return { ok: true };
  },
);
