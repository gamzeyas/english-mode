import type { LearningItem } from "@/types/domain";

type LearningItemRow = {
  id: string;
  phrase: string;
  normalized_phrase: string;
  meaning_tr: string | null;
  example: string | null;
  category: string;
  status: string;
  source_context: string | null;
  due_at: string | null;
  last_reviewed_at: string | null;
  created_at: string;
};

export function toLearningItem(row: LearningItemRow): LearningItem {
  return {
    id: row.id,
    phrase: row.phrase,
    normalizedPhrase: row.normalized_phrase,
    meaningTr: row.meaning_tr,
    example: row.example,
    category: row.category,
    status: row.status as LearningItem["status"],
    sourceContext: row.source_context,
    dueAt: row.due_at,
    lastReviewedAt: row.last_reviewed_at,
    createdAt: row.created_at,
  };
}
