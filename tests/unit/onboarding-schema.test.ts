import { describe, expect, it } from "vitest";
import {
  onboardingFromFormData,
  onboardingSchema,
} from "@/lib/onboarding/schema";

function form(overrides: Record<string, string | string[] | null> = {}) {
  const fields: Record<string, string | string[] | null> = {
    displayName: "  Gamze  ",
    purpose: "career",
    goals: ["Spoken fluency", "Pronunciation"],
    interests: ["Melodic techno", "Travel", "Travel"],
    dailyMinutes: "15",
    dialect: "en-GB",
    feedbackMode: "end",
    consentDataProcessing: "on",
    consentVoiceProcessing: null,
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === null) continue;
    for (const item of Array.isArray(value) ? value : [value])
      data.append(key, item);
  }
  return onboardingFromFormData(data);
}

describe("onboardingSchema", () => {
  it("parses a valid submission", () => {
    const result = onboardingSchema.parse(form());
    expect(result).toMatchObject({
      displayName: "Gamze",
      purpose: "career",
      dailyMinutes: 15,
      dialect: "en-GB",
      consentDataProcessing: true,
      consentVoiceProcessing: false,
    });
  });

  it("deduplicates interests", () => {
    expect(onboardingSchema.parse(form()).interests).toEqual([
      "Melodic techno",
      "Travel",
    ]);
  });

  it("stores an empty name as null", () => {
    expect(
      onboardingSchema.parse(form({ displayName: "   " })).displayName,
    ).toBeNull();
  });

  it("requires data-processing consent", () => {
    expect(
      onboardingSchema.safeParse(form({ consentDataProcessing: null })).success,
    ).toBe(false);
  });

  it.each([
    ["dailyMinutes", "20"],
    ["dialect", "en-AU"],
    ["purpose", "other"],
    ["feedbackMode", "always"],
    ["goals", ["Become fluent overnight"]],
  ])("rejects an invalid %s", (field, value) => {
    expect(onboardingSchema.safeParse(form({ [field]: value })).success).toBe(
      false,
    );
  });

  it("limits interests to five", () => {
    const interests = ["a", "b", "c", "d", "e", "f"];
    expect(onboardingSchema.safeParse(form({ interests })).success).toBe(false);
  });
});
