import { z } from "zod";

export const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Local "HH:MM"; required when reminders are on. */
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  weekdays: z
    .array(z.number().int().min(1).max(7))
    .min(1)
    .max(7)
    .transform((days) => [...new Set(days)].sort()),
});
export type ReminderSettingsInput = z.infer<typeof reminderSettingsSchema>;

/** PushSubscription.toJSON() from the browser. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({
    p256dh: z.string().min(40).max(200),
    auth: z.string().min(10).max(100),
  }),
});

export const endpointSchema = z.object({
  endpoint: z.url().max(1000),
});
