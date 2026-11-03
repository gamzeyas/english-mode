import { withApi } from "@/lib/api/handler";
import { getDueQueue } from "@/lib/review/service";

/** GET /api/review/due -> recall prompts only (no target phrase) */
export const GET = withApi(async ({ user, profile }) =>
  getDueQueue(user, profile),
);
