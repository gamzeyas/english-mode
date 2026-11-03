"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { postJson } from "@/lib/api/client";
import { ChoiceGroup, type ChoiceOption } from "@/components/choice-group";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Difficulty = "easy" | "medium" | "hard" | "adaptive";

const difficulties: ChoiceOption<Difficulty>[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "adaptive", label: "Adaptive" },
];

export function StartRoleplay({
  slug,
  durationOptions,
  defaultDifficulty,
  assignmentId,
}: {
  slug: string;
  durationOptions: number[];
  defaultDifficulty: Difficulty;
  assignmentId: string | null;
}) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(String(durationOptions[0] ?? 10));
  const [difficulty, setDifficulty] = useState<Difficulty>(defaultDifficulty);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    const result = await postJson<{ sessionId: string }>("/api/sessions", {
      mode: "text",
      scenarioId: slug,
      durationGoalMinutes: Number(minutes),
      difficulty,
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
      <CardContent className="space-y-5">
        <ChoiceGroup
          legend="Session length"
          name="roleplay-minutes"
          options={durationOptions.map((m) => ({
            value: String(m),
            label: `${m} min`,
          }))}
          value={minutes}
          onChange={setMinutes}
        />
        <ChoiceGroup
          legend="Difficulty"
          name="roleplay-difficulty"
          options={difficulties}
          value={difficulty}
          onChange={setDifficulty}
        />
        {assignmentId && (
          <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            Bu canlandırma bugünkü görevini tamamlar.
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
            disabled={pending}
            size="lg"
            className="h-12 px-6 text-base"
          >
            {pending ? (
              <>
                <Loader2 aria-hidden className="animate-spin" /> Starting…
              </>
            ) : (
              <>
                <Play aria-hidden /> Start roleplay
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
