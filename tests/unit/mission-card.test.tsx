import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  MissionCard,
  planForMinutes,
} from "@/components/dashboard/mission-card";
import { demoMission } from "@/lib/demo/data";

describe("planForMinutes", () => {
  it.each([5, 15, 25, 30] as const)("fills exactly %i minutes", (minutes) => {
    const total = planForMinutes(demoMission, minutes).reduce(
      (sum, step) => sum + step.minutes,
      0,
    );
    expect(total).toBe(minutes);
  });
});

describe("MissionCard", () => {
  it("labels itself as demo content", () => {
    render(<MissionCard mission={demoMission} defaultMinutes={25} />);
    expect(screen.getByText("Demo")).toBeInTheDocument();
  });

  it("updates the plan when the learner picks a shorter session", async () => {
    render(<MissionCard mission={demoMission} defaultMinutes={25} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);

    await userEvent.click(screen.getByLabelText("5 min"));

    expect(screen.getByLabelText("5 min")).toBeChecked();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("One focused 5-minute chat")).toBeInTheDocument();
  });
});
