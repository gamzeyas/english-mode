"use client";

import { useState, type FormEvent } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  Clock,
  Pencil,
  Quote,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteJson, patchJson } from "@/lib/api/client";
import { formatInterval } from "@/lib/srs/grades";
import { toLearningItem } from "@/lib/learning/map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { LearningItem, LearningItemStatus } from "@/types/domain";

const statusStyles: Record<
  LearningItemStatus,
  { label: string; className: string }
> = {
  suggested: {
    label: "Suggested",
    className: "border-dashed text-muted-foreground",
  },
  new: { label: "New", className: "bg-chart-4/15 text-chart-4" },
  learning: { label: "Learning", className: "bg-chart-2/15 text-chart-2" },
  review: { label: "Review", className: "bg-chart-2/15 text-chart-2" },
  mastered: { label: "Mastered", className: "bg-success/15 text-success" },
  archived: { label: "Archived", className: "text-muted-foreground" },
};

type Row = Parameters<typeof toLearningItem>[0];

export function PhraseCard({
  item,
  due,
  now,
  onChange,
  onRemove,
}: {
  item: LearningItem;
  due: boolean;
  now: string;
  onChange: (item: LearningItem) => void;
  onRemove: (id: string) => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = statusStyles[item.status];

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const result = await patchJson<{ item: Row }>(
      `/api/learning-items/${item.id}`,
      body,
    );
    setBusy(false);
    if (result.ok) {
      onChange(toLearningItem(result.data.item));
      setMode("view");
    } else setError(result.error);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await deleteJson(`/api/learning-items/${item.id}`);
    setBusy(false);
    if (result.ok) onRemove(item.id);
    else setError(result.error);
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void patch({
      phrase: String(data.get("phrase") ?? ""),
      meaningTr: String(data.get("meaningTr") ?? "") || null,
      example: String(data.get("example") ?? "") || null,
    });
  }

  if (mode === "edit") {
    return (
      <Card className="h-full">
        <CardContent>
          <form onSubmit={saveEdit} className="space-y-3">
            <Field
              label="Phrase"
              name="phrase"
              defaultValue={item.phrase}
              required
              maxLength={300}
            />
            <Field
              label="Meaning (Turkish)"
              name="meaningTr"
              defaultValue={item.meaningTr ?? ""}
              maxLength={300}
            />
            <Field
              label="Example"
              name="example"
              defaultValue={item.example ?? ""}
              maxLength={500}
            />
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" className="h-10 flex-1" disabled={busy}>
                <Check aria-hidden /> {busy ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-10"
                onClick={() => setMode("view")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "h-full",
        item.status === "suggested" && "border border-dashed ring-0",
      )}
    >
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("border-transparent", status.className)}
          >
            {status.label}
          </Badge>
          {due ? (
            <Badge variant="outline" className="border-primary/40 text-primary">
              <Clock aria-hidden /> Due
            </Badge>
          ) : (
            item.dueAt &&
            item.status !== "suggested" &&
            item.status !== "archived" && (
              <span className="text-xs text-muted-foreground">
                Next in {formatInterval(now, item.dueAt)}
              </span>
            )
          )}
        </div>
        <CardTitle className="font-heading text-lg font-semibold">
          {item.phrase}
        </CardTitle>
        {item.meaningTr && (
          <p lang="tr" className="text-sm text-muted-foreground">
            {item.meaningTr}
          </p>
        )}
      </CardHeader>
      <CardContent className="mt-auto space-y-3 text-sm">
        {item.example && <p className="italic">“{item.example}”</p>}
        {item.sourceContext && (
          <p className="flex gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            <Quote aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>{item.sourceContext}</span>
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        {mode === "confirm-delete" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs">
              Delete this phrase and its review history?
            </span>
            <Button
              variant="destructive"
              className="h-9"
              onClick={remove}
              disabled={busy}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              className="h-9"
              onClick={() => setMode("view")}
            >
              Cancel
            </Button>
          </div>
        ) : item.status === "suggested" ? (
          <div className="flex gap-2">
            <Button
              className="h-10 flex-1"
              onClick={() => patch({ action: "approve" })}
              disabled={busy}
            >
              <Check aria-hidden /> Save to pool
            </Button>
            <Button
              variant="outline"
              className="h-10"
              onClick={remove}
              disabled={busy}
              aria-label={`Reject ${item.phrase}`}
            >
              <X aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {item.status === "archived" ? (
              <Button
                variant="ghost"
                className="h-9"
                onClick={() => patch({ action: "restore" })}
                disabled={busy}
              >
                <ArchiveRestore aria-hidden /> Restore
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="h-9"
                  onClick={() => setMode("edit")}
                >
                  <Pencil aria-hidden /> Edit
                </Button>
                <Button
                  variant="ghost"
                  className="h-9"
                  onClick={() => patch({ action: "archive" })}
                  disabled={busy}
                >
                  <Archive aria-hidden /> Archive
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              className="h-9 text-muted-foreground"
              onClick={() => setMode("confirm-delete")}
              aria-label={`Delete ${item.phrase}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  maxLength,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  maxLength: number;
}) {
  const id = `${name}-${label}`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        className="h-10"
      />
    </div>
  );
}
