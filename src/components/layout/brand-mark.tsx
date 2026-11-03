import { cn } from "@/lib/utils";

export function BrandMark({
  showName = true,
  className,
}: {
  showName?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
      >
        EM
      </span>
      {showName ? (
        <span className="font-heading text-base font-semibold tracking-tight">
          English Mode
        </span>
      ) : (
        <span className="sr-only">English Mode</span>
      )}
    </span>
  );
}
