import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shown on screens whose content is still sample data rather than the
 * learner's real data or AI output (PRD §16: never stub features as real).
 */
export function DemoBanner({
  milestone,
  className,
}: {
  /** When the screen switches to real data, e.g. "Milestone 3". */
  milestone: string;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-xs text-foreground/90 sm:items-center sm:text-sm",
        className,
      )}
    >
      <FlaskConical
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-primary sm:mt-0"
      />
      <p>
        <strong className="font-semibold">Demo içerik.</strong> Bu ekrandaki
        veriler örnektir; {milestone}&apos;te gerçek verine bağlanacak.
      </p>
    </div>
  );
}
