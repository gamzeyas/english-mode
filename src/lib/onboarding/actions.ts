"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  CONSENT_VERSION,
  onboardingFromFormData,
  onboardingSchema,
} from "@/lib/onboarding/schema";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error: string | null; done?: boolean };

type ConsentType = "data_processing" | "voice_processing";

/**
 * Saves onboarding/preferences. The user is re-derived from the session here
 * (never trusted from the form) and every write goes through RLS.
 */
export async function saveOnboarding(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  const parsed = onboardingSchema.safeParse(onboardingFromFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }
  const values = parsed.data;
  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("user_id", user.id)
    .single();
  if (readError) return { error: "Profil okunamadı. Tekrar dene." };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: values.displayName,
      purpose: values.purpose,
      goals: values.goals,
      interests: values.interests,
      daily_minutes: values.dailyMinutes,
      dialect: values.dialect,
      feedback_mode: values.feedbackMode,
      onboarding_completed_at:
        existing.onboarding_completed_at ?? new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (profileError) return { error: "Tercihler kaydedilemedi. Tekrar dene." };

  const consentError =
    (await syncConsent(
      user.id,
      "data_processing",
      values.consentDataProcessing,
    )) ??
    (await syncConsent(
      user.id,
      "voice_processing",
      values.consentVoiceProcessing,
    ));
  if (consentError) return { error: consentError };

  revalidatePath("/", "layout");
  // The form performs a full navigation: a client-side redirect could reuse
  // the router-cached dashboard that still redirects back to onboarding.
  return { error: null, done: true };
}

/** Grants a consent if missing, or revokes the active grant if withdrawn. */
async function syncConsent(
  userId: string,
  type: ConsentType,
  granted: boolean,
): Promise<string | null> {
  const supabase = await createClient();
  const { data: active, error } = await supabase
    .from("consents")
    .select("id")
    .eq("user_id", userId)
    .eq("consent_type", type)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) return "Onaylar okunamadı. Tekrar dene.";

  if (granted && !active) {
    const { error: insertError } = await supabase.from("consents").insert({
      user_id: userId,
      consent_type: type,
      version: CONSENT_VERSION,
    });
    // 23505: a concurrent submit already granted it, which is the desired state.
    if (insertError && insertError.code !== "23505") {
      return "Onay kaydedilemedi. Tekrar dene.";
    }
  }

  if (!granted && active) {
    const { error: revokeError } = await supabase
      .from("consents")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", active.id);
    if (revokeError) return "Onay geri alınamadı. Tekrar dene.";
  }

  return null;
}
