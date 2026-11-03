import type { LearningItem } from "@/types/domain";

export type PoolFilter =
  "all" | "new" | "learning" | "due" | "mastered" | "archived";

export const poolFilters: { value: PoolFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "due", label: "Due" },
  { value: "new", label: "New" },
  { value: "learning", label: "Learning" },
  { value: "mastered", label: "Mastered" },
  { value: "archived", label: "Archived" },
];

const ACTIVE_STATUSES = new Set(["new", "learning", "review", "mastered"]);

/** An item is due when it is in an active study state and its due date has passed. */
export function isDue(item: LearningItem, now: Date): boolean {
  if (!ACTIVE_STATUSES.has(item.status) || item.dueAt === null) return false;
  return new Date(item.dueAt).getTime() <= now.getTime();
}

export function filterPool(
  items: LearningItem[],
  filter: PoolFilter,
  now: Date,
): LearningItem[] {
  switch (filter) {
    case "all":
      return items.filter((item) => item.status !== "archived");
    case "due":
      return items.filter((item) => isDue(item, now));
    case "new":
      // Suggested candidates still await learner approval; show them with new items.
      return items.filter(
        (item) => item.status === "new" || item.status === "suggested",
      );
    case "learning":
      return items.filter(
        (item) => item.status === "learning" || item.status === "review",
      );
    case "mastered":
      return items.filter((item) => item.status === "mastered");
    case "archived":
      return items.filter((item) => item.status === "archived");
  }
}
