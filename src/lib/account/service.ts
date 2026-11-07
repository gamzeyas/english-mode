import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Table = keyof Database["public"]["Tables"];

/** Every learner-owned table (all have a `user_id` column). */
export const EXPORT_TABLES = [
  "profiles",
  "consents",
  "assessments",
  "sessions",
  "messages",
  "session_feedback",
  "learning_items",
  "review_logs",
  "error_patterns",
  "assignments",
  "submissions",
  "writing_entries",
  "listening_exercises",
  "audio_assets",
  "pronunciation_attempts",
  "notification_preferences",
  "push_subscriptions",
  "ai_usage_logs",
] as const satisfies readonly Table[];

/**
 * User-owned export (PRD §14): every row the learner owns, as JSON. Read with
 * the secret key but always filtered by the verified session's user id, so
 * server-only tables (e.g. push subscriptions) are included too.
 */
export async function exportUserData(user: CurrentUser) {
  const admin = createAdminClient();
  const tables: Record<string, unknown[]> = {};
  for (const table of EXPORT_TABLES) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .eq("user_id", user.id);
    if (error) throw new Error(`Export of ${table} failed.`, { cause: error });
    tables[table] = data ?? [];
  }
  return {
    format: "english-mode-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    note: "Scores and levels in this export are informal coaching estimates, not official assessments.",
    tables,
  };
}

/**
 * Account erasure: deleting the auth user cascades to every learner table
 * (all FKs end at profiles → auth.users ON DELETE CASCADE). No raw audio is
 * stored yet, so there are no storage objects to remove.
 */
export async function deleteAccount(user: CurrentUser) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) throw new Error("Account could not be deleted.", { cause: error });
}
