import type { DebriefScope } from "@/lib/ai/analysis/schema";
import type { Json, Tables } from "@/types/database";
import type { RubricCriterion, Scenario } from "@/types/domain";

function asArray(value: Json): unknown[] {
  return Array.isArray(value) ? value : [];
}

function rubricOf(value: Json): RubricCriterion[] {
  return asArray(value).filter(
    (c): c is RubricCriterion =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as RubricCriterion).key === "string",
  );
}

function goalsOf(value: Json): string[] {
  return asArray(value).filter((g): g is string => typeof g === "string");
}

/** Maps a `scenarios` row (jsonb columns) onto the domain type. */
export function toScenario(row: Tables<"scenarios">): Scenario {
  const persona = (row.persona ?? {}) as Partial<Scenario["persona"]>;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category as Scenario["category"],
    difficulty: row.difficulty as Scenario["difficulty"],
    persona: {
      key: persona.key ?? "friendly_partner",
      name: persona.name ?? "Partner",
      role: persona.role ?? "",
      style: persona.style ?? "",
    },
    summary: row.summary,
    goals: goalsOf(row.goals),
    rubric: rubricOf(row.rubric),
    durationOptions: row.duration_options,
  };
}

/** What a scenario debrief may rate: the scenario's own criteria and goals. */
export function debriefScope(row: { rubric: Json; goals: Json }): DebriefScope {
  return {
    rubricKeys: rubricOf(row.rubric).map((c) => c.key),
    goals: goalsOf(row.goals),
  };
}
