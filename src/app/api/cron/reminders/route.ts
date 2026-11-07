import { timingSafeEqual } from "node:crypto";
import { connection, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createPushSender } from "@/lib/notifications/push";
import { runDueReminders } from "@/lib/notifications/runner";
import { createAdminClient } from "@/lib/supabase/admin";

const headers = { "cache-control": "no-store" };

function authorized(request: Request, secret: string) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * POST /api/cron/reminders — called every 15 minutes by the Supabase pg_cron
 * job with the shared CRON_SECRET. Not a learner route: it sits outside the
 * session proxy and authenticates the scheduler instead.
 */
export async function POST(request: Request) {
  await connection();
  const secret = getServerEnv().CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: { code: "not_configured" } },
      { status: 503, headers },
    );
  if (!authorized(request, secret))
    return NextResponse.json(
      { error: { code: "unauthorized" } },
      { status: 401, headers },
    );
  const send = createPushSender();
  if (!send)
    return NextResponse.json(
      { error: { code: "push_not_configured" } },
      { status: 503, headers },
    );
  try {
    const summary = await runDueReminders({ admin: createAdminClient(), send });
    return NextResponse.json(summary, { headers });
  } catch (error) {
    console.error("[cron] reminders failed", (error as Error).message);
    return NextResponse.json(
      { error: { code: "internal" } },
      { status: 500, headers },
    );
  }
}
