import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv, publicEnvSchema } from "@/lib/env";

describe("environment validation", () => {
  it("accepts an empty environment in Milestone 0", () => {
    expect(parseServerEnv({})).toEqual({});
  });

  it("treats empty strings as unset", () => {
    expect(
      parseServerEnv({ OPENAI_API_KEY: "", NEXT_PUBLIC_SUPABASE_URL: "" }),
    ).toEqual({});
  });

  it("rejects a malformed Supabase URL", () => {
    expect(() =>
      parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("never exposes server secrets through the public schema", () => {
    const parsed = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "secret",
      OPENAI_API_KEY: "secret",
    });
    expect(parsed).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    });
    for (const key of Object.keys(publicEnvSchema.shape)) {
      expect(key.startsWith("NEXT_PUBLIC_")).toBe(true);
    }
  });
});
