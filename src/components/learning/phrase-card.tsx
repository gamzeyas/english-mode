import { Clock, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function PhraseCard({
  item,
  due,
}: {
  item: LearningItem;
  due: boolean;
}) {
  const status = statusStyles[item.status];

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
          {due && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              <Clock aria-hidden /> Due
            </Badge>
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
        {item.status === "suggested" && (
          <p className="text-xs text-muted-foreground">
            Awaiting your approval before it joins reviews.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
