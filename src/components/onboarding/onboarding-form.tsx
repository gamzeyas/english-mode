"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveOnboarding, type OnboardingState } from "@/lib/onboarding/actions";
import {
  feedbackOptions,
  goalOptions,
  interestSuggestions,
  minuteOptions,
  purposeOptions,
} from "@/lib/onboarding/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const MAX_INTERESTS = 5;

export type OnboardingDefaults = {
  displayName: string;
  purpose: "career" | "casual" | "travel";
  goals: string[];
  interests: string[];
  dailyMinutes: number;
  dialect: "en-US" | "en-GB";
  feedbackMode: "end" | "on_request" | "immediate";
  consentDataProcessing: boolean;
  consentVoiceProcessing: boolean;
};

export function OnboardingForm({
  defaults,
  isEditing,
}: {
  defaults: OnboardingDefaults;
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    OnboardingState,
    FormData
  >(saveOnboarding, { error: null });
  useEffect(() => {
    if (state.done) window.location.replace("/dashboard");
  }, [state.done]);
  const [interests, setInterests] = useState<string[]>(defaults.interests);
  const [customInterest, setCustomInterest] = useState("");

  const suggestions = [
    ...new Set([...interestSuggestions, ...defaults.interests]),
  ];
  const atLimit = interests.length >= MAX_INTERESTS;

  function toggleInterest(value: string) {
    setInterests((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : current.length < MAX_INTERESTS
          ? [...current, value]
          : current,
    );
  }

  function addCustomInterest() {
    const value = customInterest.trim().slice(0, 40);
    if (!value || atLimit || interests.includes(value)) return;
    setInterests((current) => [...current, value]);
    setCustomInterest("");
  }

  return (
    <form action={formAction} className="space-y-6">
      <Section title="What should we call you?" optional>
        <Input
          name="displayName"
          defaultValue={defaults.displayName}
          maxLength={80}
          autoComplete="given-name"
          placeholder="Your first name"
          className="h-11"
          aria-label="Display name"
        />
      </Section>

      <Section title="Main purpose">
        <div className="grid gap-2 sm:grid-cols-3">
          {purposeOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              type="radio"
              name="purpose"
              value={option.value}
              defaultChecked={defaults.purpose === option.value}
              label={option.label}
              hint={option.hint}
            />
          ))}
        </div>
      </Section>

      <Section title="Goals" description="Birden fazla seçebilirsin.">
        <div className="flex flex-wrap gap-2">
          {goalOptions.map((goal) => (
            <Chip
              key={goal}
              name="goals"
              value={goal}
              defaultChecked={defaults.goals.includes(goal)}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Interests"
        description={`Konuşmalar bunlar etrafında şekillenir. 3–${MAX_INTERESTS} tane öneriyoruz (${interests.length}/${MAX_INTERESTS}).`}
      >
        <div className="flex flex-wrap gap-2">
          {suggestions.map((interest) => {
            const selected = interests.includes(interest);
            return (
              <button
                key={interest}
                type="button"
                aria-pressed={selected}
                disabled={!selected && atLimit}
                onClick={() => toggleInterest(interest)}
                className={chipClass(selected)}
              >
                {selected && <Check aria-hidden className="size-3.5" />}
                {interest}
              </button>
            );
          })}
          {interests
            .filter((interest) => !suggestions.includes(interest))
            .map((interest) => (
              <button
                key={interest}
                type="button"
                aria-pressed
                onClick={() => toggleInterest(interest)}
                className={chipClass(true)}
              >
                {interest}
                <X aria-hidden className="size-3.5" />
                <span className="sr-only">Remove</span>
              </button>
            ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={customInterest}
            onChange={(event) => setCustomInterest(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomInterest();
              }
            }}
            maxLength={40}
            disabled={atLimit}
            placeholder="Add your own"
            aria-label="Add a custom interest"
            className="h-11"
          />
          <Button
            type="button"
            variant="secondary"
            className="h-11"
            onClick={addCustomInterest}
            disabled={atLimit || !customInterest.trim()}
          >
            <Plus aria-hidden /> Add
          </Button>
        </div>
        {interests.map((interest) => (
          <input
            key={interest}
            type="hidden"
            name="interests"
            value={interest}
          />
        ))}
      </Section>

      <Section title="Daily time" description="5 dakikalık bir gün de sayılır.">
        <div className="grid grid-cols-4 gap-2">
          {minuteOptions.map((minutes) => (
            <ChoiceCard
              key={minutes}
              type="radio"
              name="dailyMinutes"
              value={String(minutes)}
              defaultChecked={defaults.dailyMinutes === minutes}
              label={`${minutes} min`}
              compact
            />
          ))}
        </div>
      </Section>

      <Section title="Accent to practice">
        <div className="grid grid-cols-2 gap-2">
          <ChoiceCard
            type="radio"
            name="dialect"
            value="en-US"
            defaultChecked={defaults.dialect === "en-US"}
            label="American (en-US)"
            compact
          />
          <ChoiceCard
            type="radio"
            name="dialect"
            value="en-GB"
            defaultChecked={defaults.dialect === "en-GB"}
            label="British (en-GB)"
            compact
          />
        </div>
      </Section>

      <Section title="When should I correct you?">
        <div className="grid gap-2 sm:grid-cols-3">
          {feedbackOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              type="radio"
              name="feedbackMode"
              value={option.value}
              defaultChecked={defaults.feedbackMode === option.value}
              label={option.label}
              hint={"hint" in option ? option.hint : undefined}
            />
          ))}
        </div>
      </Section>

      <Section title="Privacy & consent">
        <ConsentRow
          name="consentDataProcessing"
          defaultChecked={defaults.consentDataProcessing}
          required
          title="Store my learning data"
          description="Konuşma metinlerin, tercihlerin ve öğrenme kartların hesabında saklanır; koçluk için yapay zekâ sağlayıcısına (Anthropic, Claude) gönderilir. İstediğin zaman dışa aktarabilir veya silebilirsin."
        />
        <ConsentRow
          name="consentVoiceProcessing"
          defaultChecked={defaults.consentVoiceProcessing}
          title="Process my voice recordings (optional)"
          description="Ses kayıtların yazıya çevrilmek (ve ileride telaffuz analizi) için Microsoft Azure Speech'e gönderilir. Ham ses saklanmaz; yalnızca süre bilgisi kaydedilir. Onay vermezsen yazıyla devam edersin."
        />
      </Section>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
        {isEditing && (
          <Button asChild variant="ghost" className="h-12">
            <Link href="/settings">Cancel</Link>
          </Button>
        )}
        <Button
          type="submit"
          disabled={pending || state.done}
          className="h-12 px-6 text-base"
        >
          {pending
            ? "Saving…"
            : isEditing
              ? "Save preferences"
              : "Start learning"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  optional,
  children,
}: {
  title: string;
  description?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent>
        <fieldset className="space-y-3">
          <legend className="mb-3 space-y-1">
            <span className="block font-heading text-base font-semibold">
              {title}
              {optional && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  optional
                </span>
              )}
            </span>
            {description && (
              <span className="block text-sm text-muted-foreground">
                {description}
              </span>
            )}
          </legend>
          {children}
        </fieldset>
      </CardContent>
    </Card>
  );
}

function chipClass(selected: boolean) {
  return cn(
    "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-40",
    selected
      ? "border-primary bg-primary/15 text-primary"
      : "hover:bg-secondary",
  );
}

function Chip({
  name,
  value,
  defaultChecked,
}: {
  name: string;
  value: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium transition-colors hover:bg-secondary has-checked:border-primary has-checked:bg-primary/15 has-checked:text-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/60">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      {value}
    </label>
  );
}

function ChoiceCard({
  type,
  name,
  value,
  defaultChecked,
  label,
  hint,
  compact,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  defaultChecked: boolean;
  label: string;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col justify-center rounded-lg border px-3 py-2 transition-colors hover:bg-secondary has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-3 has-focus-visible:ring-ring/60",
        compact ? "min-h-11 items-center text-center" : "min-h-14",
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={type === "radio"}
        className="sr-only"
      />
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function ConsentRow({
  name,
  defaultChecked,
  required,
  title,
  description,
}: {
  name: string;
  defaultChecked: boolean;
  required?: boolean;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border p-3 has-focus-visible:ring-3 has-focus-visible:ring-ring/60">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        required={required}
        className="mt-0.5 size-5 shrink-0 accent-primary"
      />
      <span className="space-y-1">
        <span className="block text-sm font-medium">
          {title}
          {required && <span className="ml-1 text-primary">*</span>}
        </span>
        <span lang="tr" className="block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}
