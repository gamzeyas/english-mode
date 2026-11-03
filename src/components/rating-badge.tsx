import { cn } from "@/lib/utils";
import type { RubricRating } from "@/lib/ai/analysis/schema";

const labels: Record<RubricRating, string> = {
  not_observed: "Not observed",
  developing: "Developing",
  solid: "Solid",
  strong: "Strong",
};

const styles: Record<RubricRating, string> = {
  not_observed: "border-dashed text-muted-foreground",
  developing: "border-primary/40 bg-primary/10 text-primary",
  solid: "border-chart-4/40 bg-chart-4/10 text-chart-4",
  strong: "border-success/40 bg-success/10 text-success",
};

/** Informal rubric band (never a numeric score). */
export function RatingBadge({ rating }: { rating: RubricRating }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        styles[rating],
      )}
    >
      {labels[rating]}
    </span>
  );
}
