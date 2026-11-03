import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Inline marker for any value that is sample content rather than learner data. */
export function DemoBadge({
  className,
  label = "Demo",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-primary/40 font-mono text-[0.65rem] tracking-wide text-primary uppercase",
        className,
      )}
    >
      {label}
    </Badge>
  );
}
