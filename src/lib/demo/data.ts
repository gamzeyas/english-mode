/**
 * DEMO DATA. The daily mission is still a fixed template until adaptive
 * planning (Milestone 4/8); it is always rendered with a visible demo label.
 */
import type { DailyMission } from "@/types/domain";

export const demoMission: DailyMission = {
  title: "Talk about the work you're proud of",
  description:
    "A short recruiter-style chat about a recent AI transformation project, then a quick recap.",
  steps: [
    { label: "Review 3 due phrases", minutes: 5 },
    { label: "Focused conversation", minutes: 15 },
    { label: "Recap & save expressions", minutes: 5 },
  ],
};
