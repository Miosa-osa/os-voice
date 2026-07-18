import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { UsageStats } from "./compute";
import { AiVoiceProfile, DailyProfile } from "./profile.types";
import { buildDailyReport, buildProfileReport } from "./report";

const usage: UsageStats = {
  wordsThisMonth: 1000,
  totalWords: 12345,
  wpm: 120,
  fixes: 10,
  totalDictations: 42,
  heatmap: [],
  currentStreak: 5,
  longestStreak: 12,
  breakdown: [],
};

const fullProfile: AiVoiceProfile = {
  name: "The Late-Night Builder",
  identity: "You communicate like a builder who thinks out loud.",
  traits: ["direct"],
  topics: ["infrastructure"],
  style: "Terse but warm",
  quirks: ["repeats 'basically'"],
  howYouThink: "You reason from first principles.",
  whatYouCareAbout: ["shipping fast"],
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
  coaching: {
    strengths: ["low filler rate"],
    growthAreas: ["sentences run long"],
    suggestions: ["pause between points"],
  },
  generated: true,
};

const minimalProfile: AiVoiceProfile = {
  name: "",
  identity: "",
  traits: [],
  topics: [],
  style: "",
  quirks: [],
  generated: false,
};

const dailyProfile: DailyProfile = {
  date: "2026-03-15",
  createdAt: Date.now(),
  wordsToday: 842,
  dictationsToday: 6,
  summary: "You spent the day heads-down on the insights feature.",
  mood: "Upbeat and energized",
  energy: "High, fast-paced",
  focus: ["insights dashboard", "vocab learning"],
  notable: "You called the achievements list 'oddly satisfying to build'.",
  howYouSpokeToday: "Short, energetic bursts with almost no fillers.",
  comparedToUsual: "More focused than your usual baseline.",
  generated: true,
};

describe("buildProfileReport", () => {
  it("should render every populated section as markdown", () => {
    const report = buildProfileReport({ profile: fullProfile, usage });

    expect(report).toContain("# The Late-Night Builder");
    expect(report).toContain(fullProfile.identity);
    expect(report).toContain("## Portrait");
    expect(report).toContain(fullProfile.portrait);
    expect(report).toContain("## Key stats");
    expect(report).toContain("**Total words dictated:** 12,345");
    expect(report).toContain("**Speaking pace:** 120 words/min");
    expect(report).toContain("**Current streak:** 5 days");
    expect(report).toContain("## Personality");
    expect(report).toContain("- driven");
    expect(report).toContain("## What drives you");
    expect(report).toContain("## How your mind moves");
    expect(report).toContain("## How you think");
    expect(report).toContain("## Your expertise");
    expect(report).toContain("## What you care about");
    expect(report).toContain("## Your ubiquitous language");
    expect(report).toContain("ship it, source of truth");
    expect(report).toContain("## How you speak");
    expect(report).toContain("## Your communication superpower");
    expect(report).toContain("## How you come across");
    expect(report).toContain("## Blind spots");
    expect(report).toContain("## Coaching");
    expect(report).toContain("**What you do well**");
    expect(report).toContain("**Where to grow**");
    expect(report).toContain("**Try this next**");
  });

  it("should use singular day/dictation wording for a value of 1", () => {
    const report = buildProfileReport({
      profile: minimalProfile,
      usage: { ...usage, currentStreak: 1, longestStreak: 1 },
    });
    expect(report).toContain("**Current streak:** 1 day");
    expect(report).toContain("**Longest streak:** 1 day");
  });

  it("should omit optional sections entirely when the profile has no data", () => {
    const report = buildProfileReport({ profile: minimalProfile, usage });

    expect(report).not.toContain("## Portrait");
    expect(report).not.toContain("## Personality");
    expect(report).not.toContain("## What drives you");
    expect(report).not.toContain("## How your mind moves");
    expect(report).not.toContain("## How you think");
    expect(report).not.toContain("## Your expertise");
    expect(report).not.toContain("## What you care about");
    expect(report).not.toContain("## Your ubiquitous language");
    expect(report).not.toContain("## How you speak");
    expect(report).not.toContain("## Your communication superpower");
    expect(report).not.toContain("## How you come across");
    expect(report).not.toContain("## Blind spots");
    expect(report).not.toContain("## Coaching");
    // Key stats always renders.
    expect(report).toContain("## Key stats");
  });

  it("should prefer the explicit coaching override over profile.coaching", () => {
    const override = {
      strengths: ["override strength"],
      growthAreas: [],
      suggestions: [],
    };
    const report = buildProfileReport({
      profile: fullProfile,
      usage,
      coaching: override,
    });
    expect(report).toContain("override strength");
    expect(report).not.toContain("low filler rate");
  });

  it("should append a daily snapshot section when a daily profile is provided", () => {
    const report = buildProfileReport({
      profile: minimalProfile,
      usage,
      daily: dailyProfile,
    });

    expect(report).toContain(`## Daily snapshot: ${dailyProfile.date}`);
    expect(report).toContain(dailyProfile.summary);
    expect(report).toContain("**Mood:** Upbeat and energized");
    expect(report).toContain("**Focused on today:**");
    expect(report).toContain("- insights dashboard");
    expect(report).toContain("**Notable moment:**");
    expect(report).toContain("**How you spoke today:**");
    expect(report).toContain("**Compared to usual:**");
  });

  it("should not append a daily section when daily is null", () => {
    const report = buildProfileReport({
      profile: minimalProfile,
      usage,
      daily: null,
    });
    expect(report).not.toContain("Daily snapshot");
  });
});

describe("buildDailyReport", () => {
  it("should render a standalone daily snapshot report", () => {
    const report = buildDailyReport(dailyProfile);

    expect(report).toContain(
      `# Daily snapshot: ${dayjs(dailyProfile.date).format("MMMM D, YYYY")}`,
    );
    expect(report).toContain(dailyProfile.summary);
    expect(report).toContain("**Mood:** Upbeat and energized");
    expect(report).toContain("**Energy:** High, fast-paced");
    expect(report).toContain("- insights dashboard");
    expect(report).toContain("- vocab learning");
  });

  it("should prefix the title with the profile name when provided", () => {
    const report = buildDailyReport(dailyProfile, {
      profileName: "The Late-Night Builder",
    });
    expect(report).toContain("# The Late-Night Builder — Daily snapshot:");
  });

  it("should still render sections with a singular dictation count", () => {
    const report = buildDailyReport({ ...dailyProfile, dictationsToday: 1 });
    expect(report).toContain("across 1 dictation");
    expect(report).not.toContain("1 dictations");
  });
});
