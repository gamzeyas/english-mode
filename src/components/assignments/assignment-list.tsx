"use client";

import type { AssignmentView } from "@/lib/assignments/service";
import { AssignmentCard } from "@/components/assignments/assignment-card";
import { useServerState } from "@/lib/use-server-state";

/** A list whose cards can disappear (rescheduled) or be replaced (swapped). */
export function AssignmentList({
  assignments,
  empty,
}: {
  assignments: AssignmentView[];
  empty: string;
}) {
  const [items, setItems] = useServerState(assignments);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {items.map((assignment) => (
        <li key={assignment.id}>
          <AssignmentCard
            assignment={assignment}
            onReplace={(previousId, next) =>
              setItems((current) =>
                current.flatMap((item) =>
                  item.id === previousId ? (next ? [next] : []) : [item],
                ),
              )
            }
          />
        </li>
      ))}
    </ul>
  );
}
