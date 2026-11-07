import { readJson, withApi } from "@/lib/api/handler";
import {
  endpointSchema,
  pushSubscriptionSchema,
} from "@/lib/notifications/request";
import {
  addPushSubscription,
  removePushSubscription,
} from "@/lib/notifications/service";

/** POST /api/notifications/subscriptions -> stores this device */
export const POST = withApi(async ({ user }, request: Request) => {
  const body = await readJson(request, pushSubscriptionSchema);
  return addPushSubscription(user, body, request.headers.get("user-agent"));
});

/** DELETE /api/notifications/subscriptions {endpoint} -> forgets a device */
export const DELETE = withApi(async ({ user }, request: Request) => {
  const { endpoint } = await readJson(request, endpointSchema);
  return removePushSubscription(user, endpoint);
});
