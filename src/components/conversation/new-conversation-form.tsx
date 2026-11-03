"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { postJson } from "@/lib/api/client";
import { SESSION_MINUTES, type SessionMinutes } from "@/lib/sessions/durations";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, type ChoiceOption } from "@/components/choice-group";
import { Card, CardContent } from "@/components/ui/card";

const conversationTypes: ChoiceOption<"free" | "scenario">[] = [
  { value: "free", label: "Free chat", hint: "Talk about your interests" },
  { value: "scenario", label: "Scenario", hint: "Roleplay with a goal" },
];

type Minutes = `${SessionMinutes}`;

const durations: ChoiceOption<Minutes>[] = SESSION_MINUTES.map((m) => ({
  value: `${m}` as Minutes,
  label: `${m} min`,
}));

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
  assignmentId,
}: {
  scenarios: { slug: string; title: string }[];
  defaultMinutes: number;
  feedbackMode: string;
  initialScenario: string | null;
  /** Set when this conversation fulfils an assignment. */
  assignmentId: string | null;
}) {
  const router = useRouter();
  const [type, setType] = useState<"free" | "scenario">(
    initialScenario ? "scenario" : "free",
  );
  const [duration, setDuration] = useState(String(defaultMinutes) as Minutes);
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
      assignmentId,
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

        {assignmentId && (
          <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            Bu konuşma bugünkü görevini tamamlar (en az bir cevap yazman
            yeterli).
          </p>
        )}

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
