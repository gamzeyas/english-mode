"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isEmailAllowed } from "@/lib/env";
import { safeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error: string | null; email: string };

const signInSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});

const GENERIC_ERROR = "E-posta veya şifre hatalı.";

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: GENERIC_ERROR, email };

  // Same message for unknown and not-allowed accounts: no account enumeration.
  if (!isEmailAllowed(parsed.data.email))
    return { error: GENERIC_ERROR, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: GENERIC_ERROR, email };

  revalidatePath("/", "layout");
  redirect(safeNextPath(parsed.data.next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Never let signed-in pages linger in the client router cache.
  revalidatePath("/", "layout");
  redirect("/login");
}
