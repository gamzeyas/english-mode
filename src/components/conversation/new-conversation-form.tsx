"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

const conversationTypes: ChoiceOption<"free" | "scenario">[] = [
  { value: "free", label: "Free chat", hint: "Talk about your interests" },
  { value: "scenario", label: "Scenario", hint: "Roleplay with a goal" },
];

const durations: ChoiceOption<"5" | "15" | "25" | "30">[] = [
  { value: "5", label: "5 min" },
  { value: "15", label: "15 min" },
  { value: "25", label: "25 min" },
  { value: "30", label: "30 min" },
];

const feedbackLabels: Record<string, string> = {
  end: "at the end of the session",
  on_request: "only when you ask",
  immediate: "after each answer",
};

export function NewConversationForm({
  scenarios,
  defaultMinutes,
  feedbackMode,
  initialScenario,
}: {
  scenarios: { slug: string; title: string }[];
  defaultMinutes: number;
  feedbackMode: string;
  initialScenario: string | null;
}) {
  const router = useRouter();
  const [type, setType] = useState<"free" | "scenario">(
    initialScenario ? "scenario" : "free",
  );
  const [duration, setDuration] = useState(
    String(defaultMinutes) as "5" | "15" | "25" | "30",
  );
  const [scenario, setScenario] = useState(
    initialScenario ?? scenarios[0]?.slug ?? "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    const result = await postJson<{ sessionId: string }>("/api/sessions", {
      mode: "text",
      scenarioId: type === "scenario" ? scenario : null,
      durationGoalMinutes: Number(duration),
    });
    if (result.ok) {
      router.push(`/conversation/${result.data.sessionId}`);
    } else {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-6">
        <ChoiceGroup
          legend="Conversation type"
          name="type"
          options={conversationTypes}
          value={type}
          onChange={setType}
        />

        {type === "scenario" && (
          <div className="space-y-2">
            <label htmlFor="scenario" className="text-sm font-medium">
              Scenario
            </label>
            <select
              id="scenario"
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
              className="h-11 w-full rounded-lg border bg-input/30 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
            >
              {scenarios.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <ChoiceGroup
          legend="Duration"
          name="duration"
          options={durations}
          value={duration}
          onChange={setDuration}
        />

        <p className="text-sm text-muted-foreground">
          Corrections come{" "}
          <strong>{feedbackLabels[feedbackMode] ?? feedbackLabels.end}</strong>.{" "}
          <Link
            href="/onboarding"
            className="text-primary underline-offset-4 hover:underline"
          >
            Change
          </Link>
        </p>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end border-t pt-5">
          <Button
            onClick={start}
            disabled={pending || (type === "scenario" && !scenario)}
            size="lg"
            className="h-12 px-6 text-base"
          >
            {pending ? (
              <>
                <Loader2 aria-hidden className="animate-spin" /> Starting…
              </>
            ) : (
              <>
                Start conversation <ArrowRight aria-hidden />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: ReactNode;
  name: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div
        className={cn(
          "grid gap-2",
          options.length === 4 ? "grid-cols-4" : "sm:grid-cols-2",
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex min-h-12 cursor-pointer flex-col justify-center rounded-lg border px-3 py-2 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/60",
              options.length === 4 && "items-center text-center",
              option.value === value
                ? "border-primary bg-primary/10"
                : "hover:bg-secondary",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span
              className={cn(
                "text-sm font-medium",
                option.value === value && "text-primary",
              )}
            >
              {option.label}
            </span>
            {option.hint && (
              <span className="text-xs text-muted-foreground">
                {option.hint}
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
