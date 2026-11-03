import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { requireSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Per-request Supabase client acting as the signed-in learner (RLS applies).
 * Create a new one for every request; never share it across requests.
 */
export async function createClient() {
  // Auth reads the clock (token expiry), so this must render at request time,
  // never during a (runtime) prerender.
  await connection();
  const { url, key } = requireSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes the
          // session on every request, so this is safe to ignore here.
        }
      },
    },
  });
}
