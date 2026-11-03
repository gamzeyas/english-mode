import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";

/** Sends learners who have not finished onboarding to /onboarding. */
export async function OnboardingGate() {
  const profile = await getProfile();
  if (!profile.onboarding_completed_at) redirect("/onboarding");
  return null;
}
