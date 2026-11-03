import { RatingBadge } from "@/components/rating-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatLevelRange } from "@/lib/ai/analysis/assessment";
import type { AssessmentView } from "@/lib/assessment/service";
import { ASSESSMENT_CRITERIA, ASSESSMENT_TASKS } from "@/lib/assessment/tasks";
import { formatLocalDate } from "@/lib/learning/day";

function ratingOf(
  assessment: AssessmentView,
  taskKey: string,
  criterion: string,
) {
  const task = assessment.result.tasks.find((t) => t.task_key === taskKey);
  return task?.criteria.find((c) => c.key === criterion);
}

export function AssessmentSummary({
  assessment,
  timeZone,
}: {
  assessment: AssessmentView;
  timeZone: string;
}) {
  const { result } = assessment;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>
            {assessment.kind === "baseline" ? "Baseline" : "Matched task"} ·{" "}
            {formatLocalDate(assessment.createdAt, timeZone)}
          </h2>
        </CardTitle>
        <CardDescription>
          Approximate written level:{" "}
          <strong className="text-foreground">
            {formatLevelRange(result.approx_level)}
          </strong>{" "}
          (informal estimate from three typed answers — not an official CEFR
          result, says nothing about speaking or listening).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <p lang="tr" className="text-sm leading-relaxed">
          {result.summary_tr}
        </p>
        {result.focus_areas_tr.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium">Focus areas</h3>
            <ul lang="tr" className="list-disc space-y-1 pl-5 text-sm">
              {result.focus_areas_tr.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="space-y-4">
          {ASSESSMENT_TASKS.map((task, index) => (
            <div key={task.key} className="space-y-2 rounded-lg border p-3">
              <h3 className="text-sm font-medium">
                {index + 1}. {task.prompt}
              </h3>
              <ul className="space-y-2">
                {ASSESSMENT_CRITERIA.map((criterion) => {
                  const entry = ratingOf(assessment, task.key, criterion.key);
                  return (
                    <li key={criterion.key} className="space-y-0.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span>{criterion.label}</span>
                        <RatingBadge rating={entry?.rating ?? "not_observed"} />
                      </div>
                      {entry?.comment_tr && (
                        <p lang="tr" className="text-xs text-muted-foreground">
                          {entry.comment_tr}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        {result.confidence_notes.length > 0 && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {result.confidence_notes.map((note) => (
              <li key={note}>Note: {note}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Side-by-side, same tasks and rubric (PRD §11 "manual comparative review"). */
export function AssessmentComparison({
  baseline,
  latest,
  timeZone,
}: {
  baseline: AssessmentView;
  latest: AssessmentView;
  timeZone: string;
}) {
  const answerOf = (assessment: AssessmentView, key: string) =>
    assessment.answers.find((a) => a.taskKey === key)?.answer ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Compare: baseline vs. latest</h2>
        </CardTitle>
        <CardDescription>
          Aynı görevler ve aynı ölçütler. Puan farkı yerine cevaplarını yan yana
          okuyup kendin değerlendir; bantlar kaba ve gayriresmîdir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {ASSESSMENT_TASKS.map((task, index) => (
          <section key={task.key} className="space-y-3">
            <h3 className="text-sm font-medium">
              {index + 1}. {task.prompt}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {[baseline, latest].map((assessment) => (
                <div
                  key={assessment.id}
                  className="space-y-2 rounded-lg border p-3"
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {assessment.kind === "baseline" ? "Baseline" : "Matched"} ·{" "}
                    {formatLocalDate(assessment.createdAt, timeZone)}
                  </p>
                  <p lang="en" className="text-sm whitespace-pre-wrap">
                    {answerOf(assessment, task.key)}
                  </p>
                  <ul className="flex flex-wrap gap-1.5 pt-1">
                    {ASSESSMENT_CRITERIA.map((criterion) => (
                      <li
                        key={criterion.key}
                        className="flex items-center gap-1 text-xs"
                      >
                        <span className="text-muted-foreground">
                          {criterion.label}:
                        </span>
                        <RatingBadge
                          rating={
                            ratingOf(assessment, task.key, criterion.key)
                              ?.rating ?? "not_observed"
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
