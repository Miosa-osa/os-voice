import { describe, expect, it } from "vitest";
import { parseDailyResponse } from "./daily-prompt";

const validJson = JSON.stringify({
  summary: "You spent the day heads-down on the insights feature.",
  mood: "Upbeat and energized",
  energy: "High, fast-paced",
  focus: ["insights dashboard", "vocab learning"],
  notable: "You called the achievements list 'oddly satisfying to build'.",
  howYouSpokeToday: "Short, energetic bursts with almost no fillers.",
  comparedToUsual: "More focused than your usual baseline.",
});

describe("parseDailyResponse", () => {
  it("should parse a valid JSON response into DailyProfileFields", () => {
    const result = parseDailyResponse(validJson);

    expect(result).toEqual({
      summary: "You spent the day heads-down on the insights feature.",
      mood: "Upbeat and energized",
      energy: "High, fast-paced",
      focus: ["insights dashboard", "vocab learning"],
      notable: "You called the achievements list 'oddly satisfying to build'.",
      howYouSpokeToday: "Short, energetic bursts with almost no fillers.",
      comparedToUsual: "More focused than your usual baseline.",
    });
  });

  it("should return null when summary is missing", () => {
    const p = JSON.parse(validJson) as Record<string, unknown>;
    delete p.summary;
    expect(parseDailyResponse(JSON.stringify(p))).toBeNull();
  });

  it("should return null when summary is blank", () => {
    const p = { ...JSON.parse(validJson), summary: "   " };
    expect(parseDailyResponse(JSON.stringify(p))).toBeNull();
  });

  it("should default missing optional fields to empty strings/arrays", () => {
    const result = parseDailyResponse(
      JSON.stringify({ summary: "Just a quiet day." }),
    );
    expect(result).toEqual({
      summary: "Just a quiet day.",
      mood: "",
      energy: "",
      focus: [],
      notable: "",
      howYouSpokeToday: "",
      comparedToUsual: "",
    });
  });

  it("should filter out non-string/blank entries from focus", () => {
    const p = { ...JSON.parse(validJson), focus: ["real", "", 5] };
    const result = parseDailyResponse(JSON.stringify(p));
    expect(result?.focus).toEqual(["real"]);
  });

  it("should extract JSON from a markdown code-fenced response", () => {
    const fenced = `\`\`\`json\n${validJson}\n\`\`\``;
    const result = parseDailyResponse(fenced);
    expect(result?.summary).toBe(
      "You spent the day heads-down on the insights feature.",
    );
  });

  it("should return null when no JSON object is present", () => {
    expect(parseDailyResponse("no json here")).toBeNull();
  });

  it("should return null on malformed JSON", () => {
    expect(parseDailyResponse("{ summary: unquoted }")).toBeNull();
  });
});
