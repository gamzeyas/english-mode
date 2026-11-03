import { readJson, uuidParam, withApi } from "@/lib/api/handler";
import {
  deleteItem,
  updateItem,
  updateItemSchema,
} from "@/lib/learning/mutations";

/** PATCH /api/learning-items/:id -> permitted fields or approve/archive/restore */
export const PATCH = withApi(
  async (
    { user },
    request: Request,
    { params }: RouteContext<"/api/learning-items/[id]">,
  ) => {
    const { id } = await params;
    const body = await readJson(request, updateItemSchema);
    return { item: await updateItem(user, uuidParam.parse(id), body) };
  },
);

/** DELETE /api/learning-items/:id -> removes the item and its review history */
export const DELETE = withApi(
  async (
    { user },
    _request: Request,
    { params }: RouteContext<"/api/learning-items/[id]">,
  ) => {
    const { id } = await params;
    await deleteItem(user, uuidParam.parse(id));
    return { ok: true };
  },
);
