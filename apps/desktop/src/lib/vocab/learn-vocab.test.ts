import { describe, expect, it } from "vitest";
import { learnVocabulary, learnVocabularyDetailed } from "./learn-vocab";

describe("learnVocabularyDetailed", () => {
  it("should detect a proper noun that recurs mid-sentence and at sentence-start", () => {
    const result = learnVocabularyDetailed([
      "I saw Rafael today. Rafael called me back.",
    ]);

    const words = result.map((r) => r.word);
    expect(words).toContain("Rafael");
    const entry = result.find((r) => r.word === "Rafael");
    expect(entry?.count).toBe(2);
    expect(entry?.example).toBeTruthy();
  });

  it("should not treat a capitalized word seen only once as a proper noun", () => {
    const result = learnVocabularyDetailed(["I saw Rafael today."]);
    expect(result.map((r) => r.word)).not.toContain("Rafael");
  });

  it("should detect short all-caps acronyms even on a single mention", () => {
    const result = learnVocabularyDetailed(["We use the SDK for this."]);
    expect(result.map((r) => r.word)).toContain("SDK");
  });

  it("should reject a bigram containing a spelled-out number word", () => {
    const result = learnVocabularyDetailed([
      "Fifteen Ages was mentioned. Fifteen Ages came up again.",
    ]);
    expect(result.map((r) => r.word)).not.toContain("Fifteen Ages");
  });

  it("should reject a bigram that's mostly ordinary filler words", () => {
    const result = learnVocabularyDetailed([
      "We shipped Version Ten today. Version Two ships next month.",
    ]);
    const words = result.map((r) => r.word);
    expect(words).not.toContain("Version Ten");
    expect(words).not.toContain("Version Two");
    // The recurring unigram "Version" still qualifies on its own.
    expect(words).toContain("Version");
  });

  it("should respect the excluded set (case-insensitively)", () => {
    const result = learnVocabularyDetailed(
      ["I saw Rafael today. Rafael called me back."],
      { excluded: new Set(["rafael"]) },
    );
    expect(result.map((r) => r.word)).not.toContain("Rafael");
  });

  it("should require at least two mentions for an ordinary capitalized word", () => {
    const oneMention = learnVocabularyDetailed([
      "The system uses Kubernetes for orchestration.",
    ]);
    // "Kubernetes" reads as a proper noun (mid-sentence capitalized), but a
    // single mention doesn't meet the recurrence threshold for ordinary
    // proper nouns (weight 2, needs count >= 2).
    expect(oneMention.map((r) => r.word)).not.toContain("Kubernetes");

    const twoMentions = learnVocabularyDetailed([
      "The system uses Kubernetes for orchestration. Kubernetes scales well.",
    ]);
    expect(twoMentions.map((r) => r.word)).toContain("Kubernetes");
  });

  it("should respect the max option", () => {
    const transcripts = ["We use the SDK, the API, and the CLI every day."];
    const result = learnVocabularyDetailed(transcripts, { max: 1 });
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it("should return an empty array for empty/blank transcripts", () => {
    expect(learnVocabularyDetailed([])).toEqual([]);
    expect(learnVocabularyDetailed(["", "   "])).toEqual([]);
  });

  it("should always exclude the built-in product terms", () => {
    const result = learnVocabularyDetailed([
      "OS Voice is great. OS Voice helps me write.",
    ]);
    expect(result.map((r) => r.word)).not.toContain("OS");
    expect(result.map((r) => r.word)).not.toContain("Voice");
  });
});

describe("learnVocabulary", () => {
  it("should return only the word strings from learnVocabularyDetailed", () => {
    const detailed = learnVocabularyDetailed([
      "We use the SDK for this. We use the SDK for that too.",
    ]);
    const words = learnVocabulary([
      "We use the SDK for this. We use the SDK for that too.",
    ]);
    expect(words).toEqual(detailed.map((d) => d.word));
  });
});
