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
  {
    id: "catalog-salary",
    slug: "salary-negotiation",
    title: "Negotiate your job offer",
    category: "career",
    difficulty: "hard",
    persona: {
      key: "salary_negotiator",
      name: "Daniel",
      role: "Head of Design, Berlin scale-up",
      style: "Warm but budget-conscious. Trades on benefits before salary.",
    },
    summary:
      "You have an offer. Ask for a better package without risking the relationship.",
    goals: [
      "Thank them and show you're excited about the role",
      "Ask for a higher salary with one concrete reason",
      "Negotiate one non-salary item (remote days, start date or learning budget)",
    ],
    rubric: [
      {
        key: "clarity",
        label: "Clarity",
        description: "The ask is specific: a number or a concrete change.",
      },
      {
        key: "justification",
        label: "Justification",
        description: "Backs the ask with value, not need.",
      },
      {
        key: "politeness",
        label: "Polite firmness",
        description: "Holds a position while staying positive.",
      },
      {
        key: "language_patterns",
        label: "Language patterns",
        description:
          "Hedging and conditionals: “Would it be possible…”, “If we could…”.",
      },
    ],
    durationOptions: [5, 10],
  },
  {
    id: "catalog-recruiter-screen",
    slug: "recruiter-phone-screen",
    title: "Recruiter phone screen for a role abroad",
    category: "career",
    difficulty: "medium",
    persona: {
      key: "professional_interviewer",
      name: "Oliver",
      role: "Tech recruiter, London",
      style: "Brisk and practical. Checks visa, notice period and motivation.",
    },
    summary:
      "A 10-minute screening call: motivation, availability and relocation.",
    goals: [
      "Explain why you want to work abroad in two sentences",
      "Give your notice period and relocation plans clearly",
      "Ask about the next steps in the process",
    ],
    rubric: interviewRubric,
    durationOptions: [5, 10],
  },
  {
    id: "catalog-product-owner",
    slug: "defend-a-design-decision",
    title: "Defend a design decision",
    category: "client",
    difficulty: "medium",
    persona: {
      key: "product_owner",
      name: "Hannah",
      role: "Product owner, fintech app",
      style: "Analytical. Asks for data and trade-offs, not opinions.",
    },
    summary:
      "Explain why you chose a design direction and what you'd do if it fails.",
    goals: [
      "State the decision and the user problem it solves",
      "Support it with one piece of evidence",
      "Offer a fallback or a test plan",
    ],
    rubric: [
      {
        key: "clarity",
        label: "Clarity",
        description: "Decision, reason and trade-off are easy to follow.",
      },
      {
        key: "structured_examples",
        label: "Evidence",
        description: "A concrete data point, test or user quote.",
      },
      {
        key: "language_patterns",
        label: "Language patterns",
        description: "Cause and contrast: “because”, “so that”, “whereas”.",
      },
    ],
    durationOptions: [5, 10, 20],
  },
  {
    id: "catalog-meetup",
    slug: "ai-meetup-networking",
    title: "Networking at an AI meetup",
    category: "social",
    difficulty: "medium",
    persona: {
      key: "friendly_partner",
      name: "Sofia",
      role: "Product designer at a Berlin AI meetup",
      style: "Curious and talkative. Swaps tool tips and job leads.",
    },
    summary:
      "Introduce yourself, talk about AI tools you use and exchange contacts.",
    goals: [
      "Introduce what you do in one sentence",
      "Share one AI tool you use and why",
      "Suggest staying in touch (LinkedIn or coffee)",
    ],
    rubric: [
      {
        key: "naturalness",
        label: "Naturalness",
        description: "Sounds relaxed and genuine.",
      },
      {
        key: "turn_taking",
        label: "Turn taking",
        description: "Asks back and builds on the other person's answers.",
      },
      {
        key: "language_patterns",
        label: "Language patterns",
        description:
          "Small-talk phrases: “What brings you here?”, “I've been…”.",
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
