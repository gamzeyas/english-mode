import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveConsents, getProfile } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Set up your coach" };

export default function OnboardingPage() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8 sm:py-12">
      <BrandMark />
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Setup
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Let&apos;s tailor your coach
        </h1>
        <p className="text-sm text-pretty text-muted-foreground sm:text-base">
          Birkaç tercih yeter; hepsini sonra Ayarlar&apos;dan değiştirebilirsin.
          Seviye tahmini ya da etiket yok — koç, konuşmalarından öğrenecek.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-[48rem] w-full rounded-xl" />}>
        <OnboardingLoader />
      </Suspense>
    </main>
  );
}

async function OnboardingLoader() {
  const [profile, consents] = await Promise.all([
    getProfile(),
    getActiveConsents(),
  ]);
  const active = new Set(consents.map((consent) => consent.consent_type));
  const isEditing = !!profile.onboarding_completed_at;

  return (
    <OnboardingForm
      isEditing={isEditing}
      defaults={{
        displayName: profile.display_name ?? "",
        purpose:
          (profile.purpose as "career" | "casual" | "travel" | null) ??
          "career",
        goals: profile.goals,
        interests: profile.interests,
        dailyMinutes: profile.daily_minutes,
        dialect: profile.dialect as "en-US" | "en-GB",
        feedbackMode: profile.feedback_mode as
          "end" | "on_request" | "immediate",
        consentDataProcessing: active.has("data_processing"),
        consentVoiceProcessing: active.has("voice_processing"),
      }}
    />
  );
}
