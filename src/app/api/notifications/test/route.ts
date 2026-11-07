import { withApi } from "@/lib/api/handler";
import { sendTestNotification } from "@/lib/notifications/service";

/** POST /api/notifications/test -> one notification to every device now */
export const POST = withApi(async ({ user }) => sendTestNotification(user));
