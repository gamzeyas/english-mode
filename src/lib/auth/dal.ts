import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isEmailAllowed } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

/**
 * Data Access Layer: the only place that turns the request's session into a
 * user. Every server read/write that needs a user goes through here, so the
 * check is never skipped (proxy.ts only does the optimistic redirect).
 */

export type CurrentUser = { id: string; email: string };
export type Profile = Tables<"profiles">;

export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) redirect("/login");
  if (!isEmailAllowed(claims.email)) redirect("/login?error=not_allowed");

  return { id: claims.sub, email: claims.email as string };
});

export const getProfile = cache(async (): Promise<Profile> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    throw new Error("Profile could not be loaded.", { cause: error });
  }
  return data;
});

export const getActiveConsents = cache(async () => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consents")
    .select("consent_type, version, granted_at")
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (error) throw new Error("Consents could not be loaded.", { cause: error });
  return data;
});
