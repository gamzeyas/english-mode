import { createClient } from "@supabase/supabase-js";
import { E2E_EMAIL } from "./constants";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "E2E tests need Supabase env vars (run `vercel env pull`).",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findE2EUser(client: ReturnType<typeof admin>) {
  const { data, error } = await client.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email === E2E_EMAIL) ?? null;
}

/** Recreates the e2e learner from scratch so every run starts at onboarding. */
export async function resetE2EUser(password: string) {
  const client = admin();
  const existing = await findE2EUser(client);
  if (existing) await client.auth.admin.deleteUser(existing.id);
  const { error } = await client.auth.admin.createUser({
    email: E2E_EMAIL,
    password,
    email_confirm: true,
  });
  if (error) throw error;
}

export async function deleteE2EUser() {
  const client = admin();
  const existing = await findE2EUser(client);
  if (existing) await client.auth.admin.deleteUser(existing.id);
}

/** Inserts a task for the e2e learner on their current local day. */
export async function addE2EAssignment(task: {
  title: string;
  kind: "rewrite" | "interview_answer" | "follow_up";
  instructions?: string;
}) {
  const client = admin();
  const user = await findE2EUser(client);
  if (!user) throw new Error("E2E user missing.");
  const { data: profile } = await client
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .single();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: profile?.timezone ?? "Europe/Istanbul",
  }).format(new Date());
  const { error } = await client.from("assignments").insert({
    user_id: user.id,
    title: task.title,
    instructions: task.instructions ?? "Answer in 3 sentences.",
    kind: task.kind,
    estimated_minutes: 5,
    scheduled_for: today,
  });
  if (error) throw error;
}
