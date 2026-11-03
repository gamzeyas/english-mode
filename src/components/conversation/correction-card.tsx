import { ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Correction } from "@/types/domain";

const categoryLabels: Record<Correction["category"], string> = {
  grammar: "Grammar",
  word_choice: "Word choice",
  naturalness: "Naturalness",
  clarity: "Clarity",
};

export function CorrectionCard({ correction }: { correction: Correction }) {
  return (
    <article className="space-y-3 rounded-xl border bg-background/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{categoryLabels[correction.category]}</Badge>
        {correction.severity && (
          <span className="text-xs text-muted-foreground">
            Priority: {correction.severity}
          </span>
        )}
      </div>
      <div className="space-y-1.5 text-sm">
        <p className="text-muted-foreground line-through decoration-destructive/60">
          <span className="sr-only">You said: </span>
          {correction.original}
        </p>
        <ArrowDown aria-hidden className="size-4 text-muted-foreground" />
        <p className="font-medium text-success">
          <span className="sr-only">Better: </span>
          {correction.improved}
        </p>
      </div>
      <p lang="tr" className="text-sm text-muted-foreground">
        {correction.reasonTr}
      </p>
    </article>
  );
}
