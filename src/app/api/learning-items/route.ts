import { readJson, withApi } from "@/lib/api/handler";
import { createItem, createItemSchema } from "@/lib/learning/mutations";
import { getLearningItems } from "@/lib/learning/queries";

/** GET /api/learning-items -> the learner's pool */
export const GET = withApi(async () => ({ items: await getLearningItems() }));

/** POST /api/learning-items {phrase, meaningTr?, example?} -> {item} (deduplicated) */
export const POST = withApi(async ({ user }, request: Request) => {
  const body = await readJson(request, createItemSchema);
  return { item: await createItem(user, body) };
});
