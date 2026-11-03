import { describe, expect, it } from "vitest";
import { isSamePhrase, normalizePhrase } from "@/lib/text/normalize";

describe("normalizePhrase", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizePhrase("  I'd   Prefer TO ")).toBe("i'd prefer to");
  });

  it("unifies curly apostrophes and quotes", () => {
    expect(normalizePhrase("I’m into…")).toBe("i'm into");
    expect(normalizePhrase("“What makes us different is”")).toBe(
      "what makes us different is",
    );
  });

  it("strips surrounding punctuation but keeps inner punctuation", () => {
    expect(normalizePhrase("If I could..., I'd...")).toBe("if i could..., i'd");
    expect(normalizePhrase("(I worked at)!")).toBe("i worked at");
  });

  it("returns an empty string for punctuation-only input", () => {
    expect(normalizePhrase(" ... ")).toBe("");
  });
});

describe("isSamePhrase", () => {
  it("treats formatting variants as duplicates", () => {
    expect(isSamePhrase("I'm into...", "i’m INTO")).toBe(true);
  });

  it("keeps different phrases distinct", () => {
    expect(isSamePhrase("I'm into", "I'm interested in")).toBe(false);
  });

  it("never matches two empty phrases", () => {
    expect(isSamePhrase("...", "!!")).toBe(false);
  });
});
