import { withApi } from "@/lib/api/handler";
import { exportUserData } from "@/lib/account/service";

/** POST /api/data/export -> JSON download of everything the learner owns */
export const POST = withApi(async ({ user }) => {
  const data = await exportUserData(user);
  const day = data.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="english-mode-export-${day}.json"`,
    },
  });
});
