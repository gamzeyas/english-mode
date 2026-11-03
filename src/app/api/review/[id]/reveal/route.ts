import { z } from "zod";
import { readJson, uuidParam, withApi } from "@/lib/api/handler";
import { revealCard } from "@/lib/review/service";

const bodySchema = z.object({ answer: z.string().max(2000) });

/** POST /api/review/:id/reveal {answer} -> {phrase, example, match, dueByGrade} */
export const POST = withApi(
  async (
    { user },
    request: Request,
    { params }: RouteContext<"/api/review/[id]/reveal">,
  ) => {
    const { id } = await params;
    const { answer } = await readJson(request, bodySchema);
    return revealCard(user, uuidParam.parse(id), answer);
  },
);
