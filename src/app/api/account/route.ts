import { z } from "zod";
import { readJson, withApi } from "@/lib/api/handler";
import { deleteAccount } from "@/lib/account/service";

const bodySchema = z.object({ confirm: z.literal("DELETE") });

/** DELETE /api/account {confirm: "DELETE"} -> erases the account and all data */
export const DELETE = withApi(async ({ user }, request: Request) => {
  await readJson(request, bodySchema);
  await deleteAccount(user);
  return { deleted: true };
});
