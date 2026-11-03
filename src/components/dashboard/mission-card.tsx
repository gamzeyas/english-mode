"use client";

import { useState } from "react";
import Link from "next/link";
import { Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemoBadge } from "@/components/demo-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DailyMinutes, DailyMission } from "@/types/domain";

const MINUTE_OPTIONS: DailyMinutes[] = [5, 15, 25, 30];

/**
 * Scales the default mission (5 review + 15 conversation + 5 recap) to the
 * chosen time budget. A 5-minute day is a single task and still counts.
 */
export function planForMinutes(mission: DailyMission, minutes: DailyMinutes) {
  if (minutes === 5)
    return [{ label: "One focused 5-minute chat", minutes: 5 }];
  if (minutes === 15) {
    return [
      { label: mission.steps[0].label, minutes: 5 },
      { label: mission.steps[1].label, minutes: 10 },
    ];
  }
  if (minutes === 30) {
    return mission.steps.map((step, index) =>
      index === 1 ? { ...step, minutes: 20 } : step,
    );
  }
  return mission.steps;
}

export function MissionCard({
  mission,
  defaultMinutes,
  className,
}: {
  mission: DailyMission;
  defaultMinutes: DailyMinutes;
  className?: string;
}) {
  const [minutes, setMinutes] = useState<DailyMinutes>(defaultMinutes);
  const steps = planForMinutes(mission, minutes);

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-primary/15 blur-3xl"
      />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Sparkles aria-hidden className="size-4" />
          Today&apos;s mission
          <DemoBadge className="ml-auto" />
        </CardTitle>
        <CardDescription className="pt-1 text-lg font-semibold text-foreground sm:text-xl">
          {mission.title}
        </CardDescription>
        <p className="text-sm text-muted-foreground">{mission.description}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">
            How much time do you have?
          </legend>
          <div className="grid grid-cols-4 gap-2">
            {MINUTE_OPTIONS.map((option) => (
              <label
                key={option}
                className={cn(
                  "flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/60",
                  option === minutes
                    ? "border-primary bg-primary/15 text-primary"
                    : "hover:bg-secondary",
                )}
              >
                <input
                  type="radio"
                  name="mission-minutes"
                  value={option}
                  checked={option === minutes}
                  onChange={() => setMinutes(option)}
                  className="sr-only"
                />
                {option} min
              </label>
            ))}
          </div>
        </fieldset>

        <ol className="space-y-2">
          {steps.map((step, index) => (
            <li key={step.label} className="flex items-center gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold tabular-nums">
                {index + 1}
              </span>
              <span className="flex-1">{step.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {step.minutes} min
              </span>
            </li>
          ))}
        </ol>

        <Button
          asChild
          size="lg"
          className="h-12 w-full text-base sm:w-auto sm:px-6"
        >
          <Link href="/conversation/new">
            <Play aria-hidden /> Start today&apos;s mission
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
