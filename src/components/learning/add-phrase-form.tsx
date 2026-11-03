"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { postJson } from "@/lib/api/client";
import { toLearningItem } from "@/lib/learning/map";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { LearningItem } from "@/types/domain";

export function AddPhraseForm({
  onAdded,
}: {
  onAdded: (item: LearningItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    const result = await postJson<{
      item: Parameters<typeof toLearningItem>[0];
    }>("/api/learning-items", {
      phrase: String(data.get("phrase") ?? ""),
      meaningTr: String(data.get("meaningTr") ?? "") || null,
      example: String(data.get("example") ?? "") || null,
    });
    setBusy(false);
    if (result.ok) {
      onAdded(toLearningItem(result.data.item));
      form.reset();
      setOpen(false);
    } else setError(result.error);
  }

  if (!open) {
    return (
      <Button variant="outline" className="h-11" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Add phrase
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent>
        <form
          onSubmit={submit}
          className="grid gap-3 sm:grid-cols-3 sm:items-end"
        >
          <div className="space-y-1">
            <label htmlFor="new-phrase" className="text-xs font-medium">
              Phrase *
            </label>
            <Input
              id="new-phrase"
              name="phrase"
              required
              maxLength={300}
              className="h-11"
              placeholder="I'd rather…"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="new-meaning" className="text-xs font-medium">
              Meaning (Turkish)
            </label>
            <Input
              id="new-meaning"
              name="meaningTr"
              maxLength={300}
              className="h-11"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="new-example" className="text-xs font-medium">
              Example
            </label>
            <Input
              id="new-example"
              name="example"
              maxLength={500}
              className="h-11"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive sm:col-span-3">
              {error}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" className="h-11" disabled={busy}>
              {busy ? "Saving…" : "Save phrase"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
