import { readJson, withApi } from "@/lib/api/handler";
import { reminderSettingsSchema } from "@/lib/notifications/request";
import {
  getReminderSettings,
  saveReminderSettings,
} from "@/lib/notifications/service";

/** GET /api/notifications -> reminder preferences, devices, suggestion */
export const GET = withApi(async ({ user, profile }) =>
  getReminderSettings(user, profile),
);

/** PUT /api/notifications {enabled, reminderTime, weekdays} */
export const PUT = withApi(async ({ user, profile }, request: Request) => {
  const body = await readJson(request, reminderSettingsSchema);
  return saveReminderSettings(user, profile, body);
});
