import { describe, expect, it } from "vitest";
import { isNavItemActive, primaryNav, secondaryNav } from "@/lib/navigation";

const byLabel = (label: string) =>
  [...primaryNav, ...secondaryNav].find((item) => item.label === label)!;

describe("isNavItemActive", () => {
  it("matches the exact route", () => {
    expect(isNavItemActive(byLabel("Today"), "/dashboard")).toBe(true);
  });

  it("matches nested routes and extra prefixes", () => {
    expect(isNavItemActive(byLabel("Speak"), "/conversation/demo")).toBe(true);
    expect(isNavItemActive(byLabel("Pool"), "/review")).toBe(true);
    expect(
      isNavItemActive(byLabel("Simulate"), "/scenarios/festival-small-talk"),
    ).toBe(true);
  });

  it("does not match routes that only share a string prefix", () => {
    expect(isNavItemActive(byLabel("Progress"), "/progressive")).toBe(false);
  });

  it("handles a missing pathname", () => {
    expect(isNavItemActive(byLabel("Today"), null)).toBe(false);
  });

  it("keeps the mobile bar to the five PRD items", () => {
    expect(primaryNav.map((item) => item.label)).toEqual([
      "Today",
      "Speak",
      "Pool",
      "Simulate",
      "Progress",
    ]);
  });
});
