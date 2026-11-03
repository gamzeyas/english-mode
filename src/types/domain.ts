/**
 * Domain types aligned with the PRD §8 relational model.
 * Field names are camelCase versions of the planned Postgres columns so the
 * Milestone 1 DB layer can map rows 1:1.
 */

export type Dialect = "en-US" | "en-GB";
export type DailyMinutes = 5 | 15 | 25 | 30;
export type FeedbackMode = "end" | "on_request" | "immediate";

export type LearningItemStatus =
  "suggested" | "new" | "learning" | "review" | "mastered" | "archived";

export type LearningItem = {
  id: string;
  phrase: string;
  normalizedPhrase: string;
  meaningTr: string | null;
  example: string | null;
  category: string;
  status: LearningItemStatus;
  /** Where the learner originally produced/needed this phrase. */
  sourceContext: string | null;
  dueAt: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
};

export type PersonaKey =
  | "friendly_partner"
  | "professional_interviewer"
  | "founder_investor"
  | "client_stakeholder"
  | "pronunciation_coach";

export type ScenarioCategory = "career" | "founder" | "client" | "social";

export type RubricCriterion = {
  key: string;
  label: string;
  description: string;
};

export type Scenario = {
  id: string;
  slug: string;
  title: string;
  category: ScenarioCategory;
  difficulty: "easy" | "medium" | "hard" | "adaptive";
  persona: {
    key: PersonaKey;
    name: string;
    role: string;
    style: string;
  };
  summary: string;
  goals: string[];
  rubric: RubricCriterion[];
  durationOptions: number[];
};

export type SessionMode =
  "text" | "recorded_audio" | "realtime_voice" | "writing" | "review";

export type SessionStatus = "active" | "completed" | "interrupted" | "failed";

export type MessageRole = "user" | "assistant" | "system_summary";

export type Message = {
  id: string;
  role: MessageRole;
  modality: "text" | "speech_transcript";
  content: string;
  sequenceNumber: number;
  createdAt: string;
};

export type CorrectionCategory =
  "grammar" | "word_choice" | "naturalness" | "clarity";

export type Correction = {
  original: string;
  improved: string;
  reasonTr: string;
  category: CorrectionCategory;
  severity: "low" | "medium" | "high";
};

export type DailyMission = {
  title: string;
  description: string;
  steps: { label: string; minutes: number }[];
};
