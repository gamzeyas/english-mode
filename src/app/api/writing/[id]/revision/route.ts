import { z } from "zod";
import { readJson, uuidParam, withApi } from "@/lib/api/handler";
import { MAX_WRITING_CHARS, reviseWriting } from "@/lib/writing/service";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(MAX_WRITING_CHARS),
});

/** POST /api/writing/:id/revision {text} -> {entry} with revision feedback */
export const POST = withApi(
  async (
    { user, profile },
    request: Request,
    { params }: RouteContext<"/api/writing/[id]/revision">,
  ) => {
    const { id } = await params;
    const body = await readJson(request, bodySchema);
    return {
      entry: await reviseWriting(user, profile, uuidParam.parse(id), body.text),
    };
  },
);
