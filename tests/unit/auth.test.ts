import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/next-path";
import { isEmailAllowed, parseAllowedEmails } from "@/lib/env";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/learning-pool?status=due")).toBe(
      "/learning-pool?status=due",
    );
  });

  it.each([
    undefined,
    null,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "dashboard",
    "/login",
  ])("falls back to the dashboard for %s", (value) => {
    expect(safeNextPath(value)).toBe("/dashboard");
  });
});

describe("email allowlist", () => {
  const allowed = parseAllowedEmails(" Me@Example.com, other@example.com ,,");

  it("parses, trims and lowercases entries", () => {
    expect([...allowed]).toEqual(["me@example.com", "other@example.com"]);
  });

  it("matches case-insensitively", () => {
    expect(isEmailAllowed("ME@example.COM", allowed)).toBe(true);
  });

  it("rejects unknown and missing emails", () => {
    expect(isEmailAllowed("stranger@example.com", allowed)).toBe(false);
    expect(isEmailAllowed(undefined, allowed)).toBe(false);
  });

  it("fails closed when nothing is configured", () => {
    expect(
      isEmailAllowed("me@example.com", parseAllowedEmails(undefined)),
    ).toBe(false);
  });
});
