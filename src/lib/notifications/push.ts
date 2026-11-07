import "server-only";
import webpush from "web-push";
import { getServerEnv } from "@/lib/env";
import type { PushSender } from "@/lib/notifications/runner";

const DEFAULT_SUBJECT = "https://english-mode.vercel.app";
/** A reminder older than a day is pointless; let the push service drop it. */
const TTL_SECONDS = 12 * 60 * 60;

export function getVapidPublicKey(): string | null {
  return getServerEnv().VAPID_PUBLIC_KEY ?? null;
}

/** Web Push sender (RFC 8030/8291/8292) with the server's VAPID keys. */
export function createPushSender(): PushSender | null {
  const env = getServerEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  const vapidDetails = {
    subject: env.VAPID_SUBJECT ?? DEFAULT_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  return async (target, payload) => {
    try {
      await webpush.sendNotification(target, payload, {
        vapidDetails,
        TTL: TTL_SECONDS,
        urgency: "normal",
        timeout: 10_000,
      });
      return "sent";
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "gone";
      // Never log the endpoint: it is a capability URL for the device.
      console.error("[push] delivery failed", status ?? "network");
      return "failed";
    }
  };
}
