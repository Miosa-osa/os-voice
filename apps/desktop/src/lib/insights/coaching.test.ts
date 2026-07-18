import { describe, expect, it } from "vitest";
import { WordAnalysis } from "./compute";
import {
  computeCoachingDrills,
  computeCommunicationScore,
  computeFocusThisWeek,
} from "./coaching";

const words = (overrides: Partial<WordAnalysis> = {}): WordAnalysis => ({
  vocabularySize: 800,
  fillerRate: 0,
  avgSentenceLength: 14,
  questionRatio: 15,
  topPhrases: [],
  ...overrides,
});

describe("computeCommunicationScore", () => {
  it("should score a strong communicator at 100 with grade A and no drag", () => {
    const score = computeCommunicationScore(words());

    expect(score.score).toBe(100);
    expect(score.grade).toBe("A");
    expect(score.drag).toBeNull();
    expect(score.lift).not.toBeNull();
    expect(score.dimensions).toHaveLength(4);
  });

  it("should score a weak communicator low with grade F and a concrete drag", () => {
    const score = computeCommunicationScore(
      words({
        fillerRate: 10,
        avgSentenceLength: 30,
        vocabularySize: 50,
        questionRatio: 50,
      }),
    );

    expect(score.score).toBe(20); // 0 + 13 + 2 + 5
    expect(score.grade).toBe("F");
    expect(score.drag).toContain("fillers are diluting your points");
    expect(score.lift).toContain("Sentences run long");
  });

  it("should keep the score within 0-100 bounds", () => {
    const low = computeCommunicationScore(
      words({
        fillerRate: 100,
        avgSentenceLength: 1,
        vocabularySize: 0,
        questionRatio: 100,
      }),
    );
    const high = computeCommunicationScore(words({ vocabularySize: 5000 }));

    expect(low.score).toBeGreaterThanOrEqual(0);
    expect(high.score).toBeLessThanOrEqual(100);
  });

  it("should map score bands to the correct letter grade", () => {
    // avgSentenceLength=0 forces the sentence dimension to 0 points, and a
    // very high filler rate zeroes that dimension too, landing well under 45.
    const d = computeCommunicationScore(
      words({
        fillerRate: 20,
        avgSentenceLength: 0,
        vocabularySize: 0,
        questionRatio: 0,
      }),
    );
    expect(d.grade).toBe("F");

    const a = computeCommunicationScore(words());
    expect(a.grade).toBe("A");
  });
});

describe("computeFocusThisWeek", () => {
  it("should return null when there isn't enough signal yet", () => {
    const focus = computeFocusThisWeek(
      words({ avgSentenceLength: 0, vocabularySize: 0 }),
      computeCommunicationScore(
        words({ avgSentenceLength: 0, vocabularySize: 0 }),
      ),
    );
    expect(focus).toBeNull();
  });

  it("should suggest keeping momentum when every dimension already scores well", () => {
    const w = words();
    const focus = computeFocusThisWeek(w, computeCommunicationScore(w));
    expect(focus?.title).toBe("Keep the momentum");
  });

  it("should target filler words when that dimension is weakest", () => {
    const w = words({ fillerRate: 10 });
    const focus = computeFocusThisWeek(w, computeCommunicationScore(w));
    expect(focus?.area).toBe("filler");
    expect(focus?.title).toBe("Cut filler words");
    expect(focus?.detail).toContain("~10 filler words per 100");
    expect(focus?.detail).toContain("under 5");
  });

  it("should suggest tightening sentences when they run long", () => {
    const w = words({ avgSentenceLength: 30 });
    const focus = computeFocusThisWeek(w, computeCommunicationScore(w));
    expect(focus?.area).toBe("sentenceLength");
    expect(focus?.title).toBe("Tighten your sentences");
  });

  it("should suggest adding connective flow when sentences run short", () => {
    const w = words({ avgSentenceLength: 4 });
    const focus = computeFocusThisWeek(w, computeCommunicationScore(w));
    expect(focus?.area).toBe("sentenceLength");
    expect(focus?.title).toBe("Add connective flow");
  });

  it("should suggest widening vocabulary when that dimension is weakest", () => {
    const w = words({ vocabularySize: 50 });
    const focus = computeFocusThisWeek(w, computeCommunicationScore(w));
    expect(focus?.area).toBe("vocabulary");
    expect(focus?.title).toBe("Widen your word choice");
  });

  it("should suggest stating things directly when question ratio is high", () => {
    const w = words({ questionRatio: 60 });
    const focus = computeFocusThisWeek(w, computeCommunicationScore(w));
    expect(focus?.area).toBe("questionRatio");
    expect(focus?.title).toBe("State it, don't ask it");
    expect(focus?.detail).toContain("60% of your sentences");
  });
});

describe("computeCoachingDrills", () => {
  it("should return no drills when all stats are healthy", () => {
    const drills = computeCoachingDrills(words());
    expect(drills).toEqual([]);
  });

  it("should drill filler words when the rate is high", () => {
    const drills = computeCoachingDrills(words({ fillerRate: 10 }));
    expect(drills.map((d) => d.area)).toContain("Filler words");
  });

  it("should drill sentence length when sentences run long", () => {
    const drills = computeCoachingDrills(words({ avgSentenceLength: 30 }));
    expect(drills.map((d) => d.area)).toContain("Sentence length");
  });

  it("should drill sentence flow when sentences run short (mutually exclusive)", () => {
    const drills = computeCoachingDrills(words({ avgSentenceLength: 4 }));
    const areas = drills.map((d) => d.area);
    expect(areas).toContain("Sentence flow");
    expect(areas).not.toContain("Sentence length");
  });

  it("should drill vocabulary range when vocabulary is narrow", () => {
    const drills = computeCoachingDrills(words({ vocabularySize: 50 }));
    expect(drills.map((d) => d.area)).toContain("Vocabulary range");
  });

  it("should drill directness when question ratio is high", () => {
    const drills = computeCoachingDrills(words({ questionRatio: 40 }));
    expect(drills.map((d) => d.area)).toContain("Directness");
  });

  it("should return a drill for every weak dimension at once", () => {
    const drills = computeCoachingDrills(
      words({
        fillerRate: 10,
        avgSentenceLength: 30,
        vocabularySize: 50,
        questionRatio: 40,
      }),
    );
    expect(drills.map((d) => d.area).sort()).toEqual(
      [
        "Directness",
        "Filler words",
        "Sentence length",
        "Vocabulary range",
      ].sort(),
    );
  });
});
