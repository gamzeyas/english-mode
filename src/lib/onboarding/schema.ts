import { z } from "zod";

/** Version of the consent wording shown in onboarding; bump when it changes. */
/**
 * Bump when consent wording changes. v2 names the actual subprocessors
 * (Anthropic for coaching, Microsoft Azure Speech for voice).
 */
export const CONSENT_VERSION = "2026-11-v2";

export const purposeOptions = [
  {
    value: "career",
    label: "Career",
    hint: "Interviews, networking, work abroad",
  },
  { value: "casual", label: "Everyday", hint: "Small talk, friends, media" },
  {
    value: "travel",
    label: "Travel",
    hint: "Trips, festivals, getting around",
  },
] as const;

export const goalOptions = [
  "Work interviews abroad",
  "Networking small talk",
  "Spoken fluency",
  "Pronunciation",
  "Listening",
  "Business writing",
] as const;

export const interestSuggestions = [
  "Melodic techno",
  "Technology",
  "AI",
  "Travel",
  "Cinema",
  "Startups",
  "Design",
  "Food",
  "Sports",
  "Books",
] as const;

export const minuteOptions = [5, 15, 25, 30] as const;

export const feedbackOptions = [
  { value: "end", label: "At the end of a session", hint: "Recommended" },
  { value: "on_request", label: "Only when I ask" },
  { value: "immediate", label: "After each answer" },
] as const;

const trimmedTag = z.string().trim().min(1).max(40);

export const onboardingSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || null),
  purpose: z.enum(["career", "casual", "travel"]),
  goals: z.array(z.enum(goalOptions)).max(6),
  interests: z
    .array(trimmedTag)
    .max(5, "En fazla 5 ilgi alanı seçebilirsin.")
    .transform((list) => [...new Set(list)]),
  dailyMinutes: z.coerce
    .number()
    .refine((n): n is (typeof minuteOptions)[number] =>
      (minuteOptions as readonly number[]).includes(n),
    ),
  dialect: z.enum(["en-US", "en-GB"]),
  feedbackMode: z.enum(["end", "on_request", "immediate"]),
  consentDataProcessing: z.literal(true, {
    error: "Devam etmek için veri işleme onayı gerekli.",
  }),
  consentVoiceProcessing: z.boolean(),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;
export type OnboardingValues = z.output<typeof onboardingSchema>;

/** Reads the onboarding form's FormData into the schema's input shape. */
export function onboardingFromFormData(formData: FormData): OnboardingInput {
  return {
    displayName: String(formData.get("displayName") ?? ""),
    purpose: formData.get("purpose") as OnboardingInput["purpose"],
    goals: formData.getAll("goals") as OnboardingInput["goals"],
    interests: formData.getAll("interests").map(String),
    dailyMinutes: formData.get("dailyMinutes") as unknown as number,
    dialect: formData.get("dialect") as OnboardingInput["dialect"],
    feedbackMode: formData.get(
      "feedbackMode",
    ) as OnboardingInput["feedbackMode"],
    consentDataProcessing: formData.get("consentDataProcessing") === "on",
    consentVoiceProcessing: formData.get("consentVoiceProcessing") === "on",
  } as OnboardingInput;
}
