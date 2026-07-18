import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER, categorizeWord } from "./categorize";

describe("categorizeWord", () => {
  it("should categorize short all-caps runs as acronyms", () => {
    expect(categorizeWord("SDK")).toBe("acronym");
    expect(categorizeWord("NASA")).toBe("acronym");
    expect(categorizeWord("AI")).toBe("acronym");
  });

  it("should categorize an all-caps token with a digit as an acronym", () => {
    // GPT4 is fully [A-Z0-9] and matches the acronym shape before the
    // technical digit check is ever reached.
    expect(categorizeWord("GPT4")).toBe("acronym");
  });

  it("should categorize camelCase identifiers as technical", () => {
    expect(categorizeWord("myVar")).toBe("technical");
    expect(categorizeWord("getUserId")).toBe("technical");
  });

  it("should categorize tokens with separators as technical", () => {
    expect(categorizeWord("app.js")).toBe("technical");
    expect(categorizeWord("path/to/file")).toBe("technical");
  });

  it("should categorize tokens ending in a known technical suffix as technical", () => {
    expect(categorizeWord("backendapi")).toBe("technical");
  });

  it("should categorize a capitalized word with a lowercase tail as proper", () => {
    expect(categorizeWord("Rafael")).toBe("proper");
    expect(categorizeWord("London")).toBe("proper");
  });

  it("should categorize any token containing whitespace as a phrase", () => {
    expect(categorizeWord("machine learning")).toBe("phrase");
  });

  it("should categorize a phrase even if the words look technical", () => {
    expect(categorizeWord("Version Two")).toBe("phrase");
  });

  it("should fall back to word for plain lowercase tokens", () => {
    expect(categorizeWord("hello")).toBe("word");
  });

  it("should fall back to word for empty or blank input", () => {
    expect(categorizeWord("")).toBe("word");
    expect(categorizeWord("   ")).toBe("word");
  });

  it("should trim surrounding whitespace before categorizing", () => {
    expect(categorizeWord("  SDK  ")).toBe("acronym");
  });
});

describe("CATEGORY_ORDER", () => {
  it("should list categories in the expected display priority", () => {
    expect(CATEGORY_ORDER).toEqual([
      "proper",
      "technical",
      "acronym",
      "phrase",
      "word",
    ]);
  });
});
