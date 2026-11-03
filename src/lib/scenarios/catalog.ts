/**
 * Scenario catalog source (PRD §5 F4, §6 personas). The app reads scenarios
 * from the `scenarios` table; this file only feeds the seed migration
 * (scripts/generate-scenario-seed.ts), so the two never drift apart.
 */
import type { RubricCriterion, Scenario } from "@/types/domain";

const interviewRubric: RubricCriterion[] = [
  {
    key: "clarity",
    label: "Clarity",
    description: "Easy to follow, one idea per answer.",
  },
  {
    key: "relevance",
    label: "Relevance",
    description: "Answers the question that was asked.",
  },
  {
    key: "structured_examples",
    label: "Structured examples",
    description: "Situation → action → result, with a concrete detail.",
  },
  {
    key: "language_patterns",
    label: "Language patterns",
    description: "Tense control and natural professional phrasing.",
  },
  {
    key: "turn_taking",
    label: "Turn taking",
    description: "Answers, then hands the turn back.",
  },
];

export const scenarioCatalog: Scenario[] = [
  {
    id: "catalog-recruiter",
    slug: "ai-transformation-interview",
    title: "AI transformation lead — first interview",
    category: "career",
    difficulty: "adaptive",
    persona: {
      key: "professional_interviewer",
      name: "Rachel",
      role: "Senior recruiter, Amsterdam",
      style: "Friendly but precise. Follows up on vague answers.",
    },
    summary:
      "Walk a recruiter through your experience leading AI adoption in a creative team.",
    goals: [
      "Introduce yourself in under a minute",
      "Describe one project with a measurable result",
      "Ask one thoughtful question about the role",
    ],
    rubric: interviewRubric,
    durationOptions: [5, 10, 20],
  },
  {
    id: "catalog-investor",
    slug: "founder-investor-pitch",
    title: "Pitch your startup to an angel investor",
    category: "founder",
    difficulty: "medium",
    persona: {
      key: "founder_investor",
      name: "Marcus",
      role: "Angel investor, London",
      style:
        "Curious and direct. Asks about market, pricing and differentiation.",
    },
    summary:
      "Explain your value proposition and what makes your product different.",
    goals: [
      "State the problem in one sentence",
      "Use “What makes us different is…”",
      "Handle one pricing follow-up",
    ],
    rubric: [
      {
        key: "clarity",
        label: "Clarity",
        description: "A listener can repeat your pitch.",
      },
      {
        key: "differentiation",
        label: "Differentiation",
        description: "A specific, believable difference.",
      },
      {
        key: "language_patterns",
        label: "Language patterns",
        description: "Confident, natural business phrasing.",
      },
    ],
    durationOptions: [5, 10],
  },
  {
    id: "catalog-client",
    slug: "client-project-briefing",
    title: "Client briefing with scope pushback",
    category: "client",
    difficulty: "hard",
    persona: {
      key: "client_stakeholder",
      name: "Priya",
      role: "Marketing director, brand client",
      style: "Busy and opinionated. Pushes for more scope on the same budget.",
    },
    summary: "Clarify deliverables and politely push back on extra scope.",
    goals: [
      "Summarize the brief back to the client",
      "Say no to extra scope without sounding rude",
      "Agree on a next step",
    ],
    rubric: [
      {
        key: "clarity",
        label: "Clarity",
        description: "Deliverables are unambiguous.",
      },
      {
        key: "politeness",
        label: "Polite firmness",
        description: "Pushback that keeps the relationship warm.",
      },
      {
        key: "turn_taking",
        label: "Turn taking",
        description: "Listens, then responds.",
      },
    ],
    durationOptions: [10, 20],
  },
  {
    id: "catalog-social",
    slug: "festival-small-talk",
    title: "Small talk at a techno festival",
    category: "social",
    difficulty: "easy",
    persona: {
      key: "friendly_partner",
      name: "Leo",
      role: "Fellow festival-goer",
      style: "Relaxed and chatty. Loves melodic techno.",
    },
    summary:
      "Chat about music, travel and favorite artists with someone you just met.",
    goals: [
      "Use “I'm into…”",
      "Ask two follow-up questions",
      "Suggest meeting again",
    ],
    rubric: [
      {
        key: "naturalness",
        label: "Naturalness",
        description: "Sounds casual, not scripted.",
      },
      {
        key: "turn_taking",
        label: "Turn taking",
        description: "Keeps the chat flowing.",
      },
    ],
    durationOptions: [5, 10],
  },
];

export const scenarioCategoryLabels: Record<Scenario["category"], string> = {
  career: "Career",
  founder: "Founder",
  client: "Client",
  social: "Social",
};
