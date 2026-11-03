import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Client = SupabaseClient<Database>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `${name} is required for integration tests (run \`vercel env pull\`).`,
    );
  return value;
}

const url = () => requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const options = { auth: { autoRefreshToken: false, persistSession: false } };

export function adminClient(): Client {
  return createClient<Database>(
    url(),
    requireEnv("SUPABASE_SECRET_KEY"),
    options,
  );
}

export function anonClient(): Client {
  return createClient<Database>(
    url(),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    options,
  );
}

export type TestUser = { id: string; email: string; client: Client };

/** Creates a confirmed throwaway user and returns a client signed in as them. */
export async function createTestUser(admin: Client): Promise<TestUser> {
  const email = `rls-test-${randomUUID()}@english-mode.test`;
  const password = randomUUID() + randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

export async function deleteTestUser(
  admin: Client,
  user: TestUser | undefined,
) {
  if (user) await admin.auth.admin.deleteUser(user.id);
}
