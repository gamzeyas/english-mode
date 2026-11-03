"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { postJson } from "@/lib/api/client";
import { ASSESSMENT_TASKS, wordCount } from "@/lib/assessment/tasks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function AssessmentForm({ kind }: { kind: "baseline" | "matched" }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(ASSESSMENT_TASKS.map((task) => [task.key, ""])),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = ASSESSMENT_TASKS.every(
    (task) => wordCount(answers[task.key]) >= task.minWords,
  );

  async function submit() {
    setPending(true);
    setError(null);
    const result = await postJson<{ id: string }>("/api/assessments", {
      answers,
    });
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) void submit();
          }}
        >
          <p className="text-sm text-muted-foreground">
            {kind === "baseline"
              ? "Sözlük ya da çeviri kullanmadan, kendi cümlelerinle yaz. Bu bir sınav değil; başlangıç noktanı kaydeder."
              : "Aynı üç görev. Başlangıçtaki cevaplarına bakmadan yaz; sonra yan yana karşılaştırırsın."}
          </p>
          {ASSESSMENT_TASKS.map((task, index) => {
            const words = wordCount(answers[task.key]);
            return (
              <div key={task.key} className="space-y-2">
                <label
                  htmlFor={`task-${task.key}`}
                  className="block text-sm font-medium"
                >
                  {index + 1}. {task.prompt}
                </label>
                <p lang="tr" className="text-xs text-muted-foreground">
                  {task.hintTr}
                </p>
                <Textarea
                  id={`task-${task.key}`}
                  lang="en"
                  rows={5}
                  maxLength={1500}
                  value={answers[task.key]}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [task.key]: event.target.value,
                    }))
                  }
                  disabled={pending}
                />
                <p
                  className={
                    words >= task.minWords
                      ? "text-right text-xs text-success tabular-nums"
                      : "text-right text-xs text-muted-foreground tabular-nums"
                  }
                >
                  {words} words · min {task.minWords}
                </p>
              </div>
            );
          })}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end border-t pt-5">
            <Button
              type="submit"
              size="lg"
              className="h-12 px-6 text-base"
              disabled={pending || !ready}
            >
              {pending ? (
                <>
                  <Loader2 aria-hidden className="animate-spin" /> Analyzing…
                </>
              ) : (
                "Submit answers"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
