import { describe, expect, it } from "vitest";
import { parseProfileResponse } from "./profile-prompt";

const validJson = JSON.stringify({
  name: "The Late-Night Builder",
  identity: "You communicate like a builder who thinks out loud.",
  traits: ["direct", "curious"],
  topics: ["infrastructure", "product"],
  style: "Terse but warm",
  quirks: ["repeats 'basically'"],
  howYouThink: "You reason from first principles.",
  whatYouCareAbout: ["shipping fast", "clarity"],
  expertise: ["distributed systems"],
  howYouSpeak: "Short, punchy sentences with few fillers.",
  ubiquitousLanguage: ["ship it", "source of truth"],
  portrait: "You are someone who moves fast and thinks in systems.",
  personality: ["driven", "playful"],
  motivations: ["building things that last"],
  communicationSuperpower: "Clarity under pressure.",
  blindSpots: ["can skip context others need"],
  howOthersExperienceYou: "People find you decisive and easy to follow.",
  mindsetPatterns: ["circles back to the same core themes"],
  recentActivity: "Lately you've been shipping the insights feature.",
  tone: "assertive",
  whatsChanged: "You're asking fewer questions than before.",
  coaching: {
    strengths: ["low filler rate"],
    growthAreas: ["sentences run long"],
    suggestions: ["pause between points"],
  },
});

describe("parseProfileResponse", () => {
  it("should parse a valid JSON response into an AiVoiceProfile", () => {
    const result = parseProfileResponse(validJson);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("The Late-Night Builder");
    expect(result?.identity).toBe(
      "You communicate like a builder who thinks out loud.",
    );
    expect(result?.traits).toEqual(["direct", "curious"]);
    expect(result?.topics).toEqual(["infrastructure", "product"]);
    expect(result?.style).toBe("Terse but warm");
    expect(result?.quirks).toEqual(["repeats 'basically'"]);
    expect(result?.portrait).toBe(
      "You are someone who moves fast and thinks in systems.",
    );
    expect(result?.personality).toEqual(["driven", "playful"]);
    expect(result?.motivations).toEqual(["building things that last"]);
    expect(result?.communicationSuperpower).toBe("Clarity under pressure.");
    expect(result?.blindSpots).toEqual(["can skip context others need"]);
    expect(result?.howOthersExperienceYou).toBe(
      "People find you decisive and easy to follow.",
    );
    expect(result?.mindsetPatterns).toEqual([
      "circles back to the same core themes",
    ]);
    expect(result?.generated).toBe(true);
    expect(result?.coaching).toEqual({
      strengths: ["low filler rate"],
      growthAreas: ["sentences run long"],
      suggestions: ["pause between points"],
    });
  });

  it("should return null when name is missing", () => {
    const p = JSON.parse(validJson) as Record<string, unknown>;
    delete p.name;
    expect(parseProfileResponse(JSON.stringify(p))).toBeNull();
  });

  it("should return null when identity is missing", () => {
    const p = JSON.parse(validJson) as Record<string, unknown>;
    delete p.identity;
    expect(parseProfileResponse(JSON.stringify(p))).toBeNull();
  });

  it("should coerce array fields and drop empty entries", () => {
    const p = {
      name: "Name",
      identity: "Identity",
      traits: ["a", "", "b", 3],
    };
    const result = parseProfileResponse(JSON.stringify(p));
    expect(result?.traits).toEqual(["a", "b", "3"]);
  });

  it("should default array fields to an empty array when absent or not an array", () => {
    const p = { name: "Name", identity: "Identity", topics: "not an array" };
    const result = parseProfileResponse(JSON.stringify(p));
    expect(result?.topics).toEqual([]);
    expect(result?.traits).toEqual([]);
  });

  it("should extract JSON from a markdown code-fenced response", () => {
    const fenced = `Here is the profile:\n\`\`\`json\n${validJson}\n\`\`\``;
    const result = parseProfileResponse(fenced);
    expect(result?.name).toBe("The Late-Night Builder");
  });

  it("should return null when no JSON object is present", () => {
    expect(parseProfileResponse("not json at all")).toBeNull();
  });

  it("should return null on malformed JSON", () => {
    expect(parseProfileResponse("{ name: 'unquoted keys' }")).toBeNull();
  });

  it("should leave optional string fields undefined when absent", () => {
    const p = { name: "Name", identity: "Identity" };
    const result = parseProfileResponse(JSON.stringify(p));
    expect(result?.howYouThink).toBeUndefined();
    expect(result?.portrait).toBeUndefined();
    expect(result?.communicationSuperpower).toBeUndefined();
    expect(result?.howOthersExperienceYou).toBeUndefined();
    expect(result?.tone).toBeUndefined();
    expect(result?.whatsChanged).toBeUndefined();
  });

  it("should treat blank optional strings as undefined", () => {
    const p = { name: "Name", identity: "Identity", tone: "   " };
    const result = parseProfileResponse(JSON.stringify(p));
    expect(result?.tone).toBeUndefined();
  });

  it("should omit coaching when all coaching arrays are empty", () => {
    const p = {
      name: "Name",
      identity: "Identity",
      coaching: { strengths: [], growthAreas: [], suggestions: [] },
    };
    const result = parseProfileResponse(JSON.stringify(p));
    expect(result?.coaching).toBeUndefined();
  });

  it("should include coaching when at least one array has entries", () => {
    const p = {
      name: "Name",
      identity: "Identity",
      coaching: { strengths: ["clarity"], growthAreas: [], suggestions: [] },
    };
    const result = parseProfileResponse(JSON.stringify(p));
    expect(result?.coaching).toEqual({
      strengths: ["clarity"],
      growthAreas: [],
      suggestions: [],
    });
  });

  it("should leave coaching undefined when the field is absent", () => {
    const p = { name: "Name", identity: "Identity" };
    const result = parseProfileResponse(JSON.stringify(p));
    expect(result?.coaching).toBeUndefined();
  });
});
