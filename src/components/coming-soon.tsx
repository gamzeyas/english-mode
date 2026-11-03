import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Honest empty state for screens whose feature lands in a later milestone. */
export function ComingSoon({
  icon: Icon,
  milestone,
  title,
  description,
  bullets,
}: {
  icon: LucideIcon;
  milestone: string;
  title: string;
  description: string;
  bullets?: string[];
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-start gap-4 py-8 sm:flex-row sm:gap-6">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Icon aria-hidden className="size-6" />
        </span>
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Planned · {milestone}
          </p>
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            {description}
          </p>
          {bullets && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
