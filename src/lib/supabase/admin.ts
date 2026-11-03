import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv, requireSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Secret-key client that bypasses RLS. Only for server-written tables
 * (analyzer feedback, error patterns, usage logs). Callers must have already
 * authorized the user and scope every query by that user's id.
 */
export function createAdminClient() {
  const { url } = requireSupabasePublicEnv();
  const secretKey = getServerEnv().SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not configured.");
  return createClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
