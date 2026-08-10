import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { Transcription } from "@voquill/types";
import { LocalDictationEvent } from "../../repos/insights.repo";
import {
  booksComparison,
  categorizeApp,
  computeAchievements,
  computeCoachingTrend,
  computeLeaderboard,
  computeMomentum,
  computeRhythm,
  computeSessionStats,
  computeTranscriptionPerformance,
  computeTrends,
  computeUsage,
  computeWeekComparison,
  computeWordAnalysis,
  countWordChanges,
  learnTermsFromEdit,
  templatedCoaching,
  templatedProfile,
  AVG_NOVEL_WORDS,
  VoiceProfile,
  WordAnalysis,
} from "./compute";
import { CoachingSnapshot, StoredVoiceProfile } from "./profile.types";

let idSeq = 0;
const nextId = (prefix: string): string => `${prefix}-${idSeq++}`;

const buildTranscription = (
  overrides: Partial<Transcription> = {},
): Transcription => ({
  id: nextId("t"),
  createdAt: dayjs().toISOString(),
  createdByUserId: "user-1",
  transcript: "hello world",
  isDeleted: false,
  ...overrides,
});

const buildEvent = (
  overrides: Partial<LocalDictationEvent> = {},
): LocalDictationEvent => ({
  id: nextId("e"),
  timestamp: Date.now(),
  wordCount: 0,
  charCount: 0,
  appName: null,
  appTargetId: null,
  toneId: null,
  correctionCount: 0,
  transcriptionDurationMs: null,
  postprocessDurationMs: null,
  ...overrides,
});

const wordList = (n: number, prefix = "word"): string =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");

describe("countWordChanges", () => {
  it("should return 0 when texts are identical", () => {
    expect(countWordChanges("hello world", "hello world")).toBe(0);
  });

  it("should return 0 for identical text regardless of case", () => {
    expect(countWordChanges("Hello World", "hello world")).toBe(0);
  });

  it("should count a single word substitution as one change", () => {
    expect(countWordChanges("hello world", "hello there")).toBe(1);
  });

  it("should count multiple substitutions", () => {
    expect(countWordChanges("a b c", "a x y")).toBe(2);
  });

  it("should return 0 for two empty strings", () => {
    expect(countWordChanges("", "")).toBe(0);
  });

  it("should count added words", () => {
    // "world" and "there" both removed/added -> multiset diff of 2, ceil(2/2)=1
    // adding a brand new word with nothing removed increases diff by 1 (odd),
    // rounded up by the ceil.
    expect(countWordChanges("hello", "hello there")).toBe(1);
  });
});

describe("categorizeApp", () => {
  it("should return Other when appName is null", () => {
    expect(categorizeApp(null)).toBe("Other");
  });

  it("should return Other when appName is empty", () => {
    expect(categorizeApp("")).toBe("Other");
  });

  it("should categorize AI assistants as AI prompts", () => {
    expect(categorizeApp("ChatGPT")).toBe("AI prompts");
    expect(categorizeApp("Claude")).toBe("AI prompts");
  });

  it("should categorize coding tools as Coding", () => {
    expect(categorizeApp("Visual Studio Code")).toBe("Coding");
    expect(categorizeApp("Terminal")).toBe("Coding");
    // "Cursor" is an AI-powered editor but matches the coding pattern first.
    expect(categorizeApp("Cursor")).toBe("Coding");
  });

  it("should categorize writing/office apps as Writing", () => {
    expect(categorizeApp("Notion")).toBe("Writing");
    expect(categorizeApp("Slack")).toBe("Writing");
  });

  it("should return Other for unrecognized apps", () => {
    expect(categorizeApp("Spotify")).toBe("Other");
  });
});

describe("booksComparison", () => {
  it("should return 0 novels and 0% for zero words", () => {
    const result = booksComparison(0);
    expect(result.novels).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.phrase).toBe("0% of an average novel");
  });

  it("should describe less than a novel as a percentage", () => {
    const result = booksComparison(AVG_NOVEL_WORDS / 2);
    expect(result.percent).toBe(50);
    expect(result.phrase).toBe("50% of an average novel");
  });

  it("should describe a full novel as '1.0 average novels'", () => {
    const result = booksComparison(AVG_NOVEL_WORDS);
    expect(result.novels).toBe(1);
    expect(result.phrase).toBe("1.0 average novels");
  });

  it("should describe multiple novels", () => {
    const result = booksComparison(AVG_NOVEL_WORDS * 2);
    expect(result.phrase).toBe("2.0 average novels");
  });
});

describe("computeUsage", () => {
  it("should sum total words and words-this-month from active transcriptions only", () => {
    const thisMonth = buildTranscription({
      transcript: wordList(5),
      createdAt: dayjs().toISOString(),
      audio: { filePath: "a", durationMs: 150000 }, // 2.5 min
    });
    const otherMonth = buildTranscription({
      transcript: wordList(3),
      createdAt: dayjs().subtract(2, "month").toISOString(),
    });
    const deleted = buildTranscription({
      transcript: wordList(100),
      isDeleted: true,
    });
    const empty = buildTranscription({ transcript: "   " });

    const usage = computeUsage([], [thisMonth, otherMonth, deleted, empty]);

    expect(usage.totalWords).toBe(8);
    expect(usage.wordsThisMonth).toBe(5);
    expect(usage.totalDictations).toBe(2);
    // total words (8, across all active transcriptions) / 2.5 minutes of
    // audio (only "thisMonth" has an audio snapshot) = 3.2, rounded to 3.
    expect(usage.wpm).toBe(3);
  });

  it("should sum fixes from rawTranscript -> transcript diffs", () => {
    const withFix = buildTranscription({
      rawTranscript: "hello world",
      transcript: "hello there",
    });
    const withoutFix = buildTranscription({
      transcript: "no raw here",
    });

    const usage = computeUsage([], [withFix, withoutFix]);

    expect(usage.fixes).toBe(1);
  });

  it("should compute current and longest streaks from active transcription dates", () => {
    const recentRun = [0, 1, 2].map((i) =>
      buildTranscription({
        createdAt: dayjs().subtract(i, "day").toISOString(),
      }),
    );
    const olderRun = [10, 11, 12, 13, 14].map((i) =>
      buildTranscription({
        createdAt: dayjs().subtract(i, "day").toISOString(),
      }),
    );

    const usage = computeUsage([], [...recentRun, ...olderRun]);

    expect(usage.currentStreak).toBe(3);
    expect(usage.longestStreak).toBe(5);
  });

  it("should return zero streaks when there are no active transcriptions", () => {
    const usage = computeUsage([], []);
    expect(usage.currentStreak).toBe(0);
    expect(usage.longestStreak).toBe(0);
  });

  it("should build a category breakdown from events, sorted by words desc", () => {
    const events = [
      buildEvent({ appName: "ChatGPT", wordCount: 50 }),
      buildEvent({ appName: "Visual Studio Code", wordCount: 200 }),
      buildEvent({ appName: "Visual Studio Code", wordCount: 100 }),
    ];

    const usage = computeUsage(events, []);

    expect(usage.breakdown[0]).toEqual({
      category: "Coding",
      words: 300,
      count: 2,
    });
    expect(usage.breakdown[1]).toEqual({
      category: "AI prompts",
      words: 50,
      count: 1,
    });
  });
});

describe("learnTermsFromEdit", () => {
  it("should extract a clean single-word substitution flanked by matching context", () => {
    const result = learnTermsFromEdit(
      "please call bob today",
      "please call robert today",
      new Set(),
    );

    expect(result).toEqual([{ source: "bob", destination: "robert" }]);
  });

  it("should be a no-op when the edit is a multi-word rephrase", () => {
    const result = learnTermsFromEdit(
      "please call bob smith today",
      "please call robert jones today",
      new Set(),
    );

    expect(result).toEqual([]);
  });

  it("should dedupe repeated occurrences of the same correction", () => {
    const result = learnTermsFromEdit(
      "please call bob today and call bob tomorrow",
      "please call robert today and call robert tomorrow",
      new Set(),
    );

    expect(result).toEqual([{ source: "bob", destination: "robert" }]);
  });

  it("should skip corrections whose source is already known", () => {
    const result = learnTermsFromEdit(
      "please call bob today",
      "please call robert today",
      new Set(["bob"]),
    );

    expect(result).toEqual([]);
  });

  it("should respect the max option and preserve extraction order", () => {
    const result = learnTermsFromEdit(
      "one bob three ann five carl seven",
      "one robert three betty five dave seven",
      new Set(),
      2,
    );

    expect(result).toEqual([
      { source: "bob", destination: "robert" },
      { source: "ann", destination: "betty" },
    ]);
  });

  it("should skip single-character source/destination words", () => {
    const result = learnTermsFromEdit(
      "see a dog run",
      "see I dog run",
      new Set(),
    );
    expect(result).toEqual([]);
  });

  it("should return an empty array when either text has no words", () => {
    expect(learnTermsFromEdit("", "hello world", new Set())).toEqual([]);
    expect(learnTermsFromEdit("hello world", "", new Set())).toEqual([]);
  });
});

describe("computeWordAnalysis", () => {
  it("should compute filler rate, avg sentence length, vocabulary size, and question ratio", () => {
    const t1 = buildTranscription({
      transcript: "This is fine. This is great.",
    });
    const t2 = buildTranscription({
      transcript: "Um, this is amazing? Um, this is amazing?",
    });

    const analysis = computeWordAnalysis([t1, t2]);

    // 14 tokenized words total, 2 of which are "um".
    expect(analysis.fillerRate).toBe(14.3);
    // total words (14) / 4 sentences, rounded.
    expect(analysis.avgSentenceLength).toBe(4);
    // 2 questions across 4 sentences.
    expect(analysis.questionRatio).toBe(50);
    // Non-stopword words with length >= 3: fine, great, amazing.
    expect(analysis.vocabularySize).toBe(3);
  });

  it("should surface the most frequent repeated phrase", () => {
    const t = buildTranscription({
      transcript:
        "machine learning is powerful. machine learning is powerful. machine learning is fun.",
    });

    const analysis = computeWordAnalysis([t]);

    expect(analysis.topPhrases[0]).toEqual({
      phrase: "machine learning",
      count: 3,
    });
  });

  it("should return all-zero stats for no active transcriptions", () => {
    const analysis = computeWordAnalysis([]);
    expect(analysis).toEqual({
      vocabularySize: 0,
      fillerRate: 0,
      avgSentenceLength: 0,
      questionRatio: 0,
      topPhrases: [],
    });
  });

  it("should exclude deleted and empty transcriptions", () => {
    const deleted = buildTranscription({
      transcript: "um um um um um um um um",
      isDeleted: true,
    });
    const empty = buildTranscription({ transcript: "" });

    const analysis = computeWordAnalysis([deleted, empty]);

    expect(analysis).toEqual({
      vocabularySize: 0,
      fillerRate: 0,
      avgSentenceLength: 0,
      questionRatio: 0,
      topPhrases: [],
    });
  });
});

describe("computeAchievements", () => {
  it("should unlock word-count and single-dictation achievements once thresholds are crossed", () => {
    const words = wordList(1500, "alpha");
    const t = buildTranscription({ transcript: words });

    const achievements = computeAchievements([], [t]);
    const byKey = new Map(achievements.map((a) => [a.key, a]));

    const w1k = byKey.get("w1k")!;
    expect(w1k.unlocked).toBe(true);
    expect(w1k.progress).toBe(1); // clamped even though 1500/1000 > 1

    const w10k = byKey.get("w10k")!;
    expect(w10k.unlocked).toBe(false);
    expect(w10k.progress).toBeCloseTo(0.15);

    expect(byKey.get("marathon")!.unlocked).toBe(true);
    expect(byKey.get("ultramarathon")!.unlocked).toBe(true);
    expect(byKey.get("monsterday")!.unlocked).toBe(false);
    expect(byKey.get("monsterday")!.progress).toBeCloseTo(0.3);

    expect(byKey.get("wordCollector")!.unlocked).toBe(true);
    const wordsmith = byKey.get("wordsmith")!;
    expect(wordsmith.unlocked).toBe(false);
    expect(wordsmith.progress).toBeCloseTo(0.75);
  });

  it("should track streak progress toward the next streak achievement", () => {
    const t = buildTranscription({ transcript: "hello world" });
    const achievements = computeAchievements([], [t]);
    const byKey = new Map(achievements.map((a) => [a.key, a]));

    const s3 = byKey.get("s3")!;
    expect(s3.unlocked).toBe(false);
    expect(s3.progress).toBeCloseTo(1 / 3);
  });

  it("should unlock the polyglot achievement only with multiple scripts", () => {
    const monoScript = computeAchievements(
      [],
      [buildTranscription({ transcript: "hello world" })],
    );
    const multiScript = computeAchievements(
      [],
      [buildTranscription({ transcript: "hello привет" })],
    );

    const monoPolyglot = monoScript.find((a) => a.key === "polyglot")!;
    const multiPolyglot = multiScript.find((a) => a.key === "polyglot")!;

    expect(monoPolyglot.unlocked).toBe(false);
    expect(multiPolyglot.unlocked).toBe(true);
  });

  it("should return every achievement with a tier and emoji", () => {
    const achievements = computeAchievements([], []);
    expect(achievements.length).toBeGreaterThan(0);
    for (const a of achievements) {
      expect(a.tier).toBeDefined();
      expect(a.emoji).toBeDefined();
    }
  });
});

describe("computeLeaderboard", () => {
  it("should compute personal records and top apps", () => {
    const dayA = buildTranscription({
      transcript: wordList(20),
      createdAt: dayjs().subtract(3, "day").hour(10).toISOString(),
      audio: { filePath: "a", durationMs: 120000 }, // 2 min, 10 wpm
    });
    const dayB = buildTranscription({
      transcript: wordList(30),
      createdAt: dayjs().subtract(1, "day").hour(10).toISOString(),
      audio: { filePath: "b", durationMs: 60000 }, // 1 min, 30 wpm
    });
    const events = [
      buildEvent({ appName: "VSCode", wordCount: 100 }),
      buildEvent({ appName: "Notion", wordCount: 40 }),
      buildEvent({ appName: "VSCode", wordCount: 20 }),
    ];

    const leaderboard = computeLeaderboard(events, [dayA, dayB]);
    const byLabel = new Map(leaderboard.records.map((r) => [r.label, r]));

    expect(byLabel.get("Most words in a day")?.value).toBe("30");
    expect(byLabel.get("Best speaking pace")?.value).toBe("30 WPM");
    expect(byLabel.get("Longest streak")?.value).toBe("1 days");
    expect(byLabel.get("Longest single dictation")?.value).toBe("30 words");
    expect(byLabel.get("Longest recording")?.value).toBe("120s");

    expect(leaderboard.topApps).toEqual([
      { app: "VSCode", words: 120 },
      { app: "Notion", words: 40 },
    ]);
  });

  it("should omit day-based records when there is no active history", () => {
    const leaderboard = computeLeaderboard([], []);
    const labels = leaderboard.records.map((r) => r.label);
    expect(labels).not.toContain("Most words in a day");
    expect(labels).not.toContain("Best speaking pace");
    expect(leaderboard.topApps).toEqual([]);
  });
});

describe("computeMomentum", () => {
  it("should compute today's words/pace, streak, and week projection", () => {
    const today = buildTranscription({
      transcript: wordList(10),
      createdAt: dayjs().toISOString(),
      audio: { filePath: "a", durationMs: 60000 }, // 1 min => 10 wpm
    });
    const old = buildTranscription({
      transcript: wordList(5),
      createdAt: dayjs().subtract(10, "day").toISOString(),
      audio: { filePath: "b", durationMs: 60000 }, // 1 min => 5 wpm
    });

    const momentum = computeMomentum([], [today, old]);

    expect(momentum.wordsToday).toBe(10);
    expect(momentum.wpmToday).toBe(10);
    expect(momentum.currentStreak).toBe(1);
    // overall wpm = round(15 words / 2 min) = 8; (10-8)/8 = 25%
    expect(momentum.paceVsAvgPct).toBe(25);

    const weekStart = dayjs().startOf("week");
    const dayOfWeek = Math.max(1, dayjs().diff(weekStart, "day") + 1);
    const expectedProjection = Math.round((10 / dayOfWeek) * 7);
    expect(momentum.weekProjection).toBe(expectedProjection);
  });

  it("should return zeros when there is no activity", () => {
    const momentum = computeMomentum([], []);
    expect(momentum.wordsToday).toBe(0);
    expect(momentum.wpmToday).toBe(0);
    expect(momentum.currentStreak).toBe(0);
    expect(momentum.paceVsAvgPct).toBe(0);
  });
});

describe("computeTrends", () => {
  it("should bucket wpm/vocab/filler into weekly points and compute wpm delta", () => {
    const thisWeekStart = dayjs().startOf("week");
    const lastWeekStart = thisWeekStart.subtract(1, "week");

    const thisWeek = buildTranscription({
      transcript: "alpha beta gamma delta epsilon",
      createdAt: thisWeekStart.add(1, "day").hour(10).toISOString(),
      audio: { filePath: "a", durationMs: 60000 }, // 1 min => 5 wpm
    });
    const lastWeek = buildTranscription({
      transcript: "alpha beta",
      createdAt: lastWeekStart.add(1, "day").hour(10).toISOString(),
      audio: { filePath: "b", durationMs: 60000 }, // 1 min => 2 wpm
    });

    const trends = computeTrends([lastWeek, thisWeek]);

    expect(trends.wpmWeekly).toHaveLength(8);
    expect(trends.wpmWeekly[7].value).toBe(5);
    expect(trends.wpmWeekly[6].value).toBe(2);
    expect(trends.wpmDeltaPct).toBe(150);

    // vocab accumulates cumulatively across weeks.
    expect(trends.vocabGrowth[6].value).toBe(2); // alpha, beta
    expect(trends.vocabGrowth[7].value).toBe(5); // + gamma, delta, epsilon

    expect(trends.fillerWeekly[7].value).toBe(0);
  });

  it("should return zeroed 8-week series when there is no activity", () => {
    const trends = computeTrends([]);
    expect(trends.wpmWeekly).toHaveLength(8);
    expect(trends.wpmWeekly.every((p) => p.value === 0)).toBe(true);
    expect(trends.wpmDeltaPct).toBe(0);
  });
});

describe("computeRhythm", () => {
  it("should return null peaks and zero consistency for no activity", () => {
    const rhythm = computeRhythm([]);
    expect(rhythm.peakWeekdayLabel).toBeNull();
    expect(rhythm.peakHourLabel).toBeNull();
    expect(rhythm.chronotype).toBeNull();
    expect(rhythm.consistencyScore).toBe(0);
    expect(rhythm.weekdayBars).toHaveLength(7);
    expect(rhythm.hourBars).toHaveLength(24);
  });

  it("should identify the peak hour/weekday and classify the chronotype", () => {
    const morning = dayjs().hour(9).minute(0).second(0).millisecond(0);
    const t = buildTranscription({
      transcript: wordList(5),
      createdAt: morning.toISOString(),
    });

    const rhythm = computeRhythm([t]);

    expect(rhythm.hourBars[9]).toBe(5);
    expect(rhythm.weekdayBars[morning.day()]).toBe(5);
    expect(rhythm.peakHourLabel).toBe("9 AM");
    expect(rhythm.chronotype).toBe("morning");
  });

  it("should score spread-out, even activity more consistent than a single burst", () => {
    const spread = [0, 1, 2, 3, 4].map((i) =>
      buildTranscription({
        transcript: wordList(10),
        createdAt: dayjs().subtract(i, "day").hour(10).toISOString(),
      }),
    );
    const burst = [
      buildTranscription({
        transcript: wordList(50),
        createdAt: dayjs().subtract(4, "day").hour(10).toISOString(),
      }),
    ];

    const spreadRhythm = computeRhythm(spread);
    const burstRhythm = computeRhythm(burst);

    expect(spreadRhythm.consistencyScore).toBeGreaterThan(
      burstRhythm.consistencyScore,
    );
    expect(spreadRhythm.consistencyScore).toBe(100);
  });
});

describe("computeSessionStats", () => {
  it("should return all-zero stats when there are no active transcriptions", () => {
    const stats = computeSessionStats([]);
    expect(stats).toEqual({
      avgWordsPerSession: 0,
      medianWordsPerSession: 0,
      longestSessionWords: 0,
      longestSessionDate: null,
      sessionsPerActiveDay: 0,
      wordsPerSessionWeekly: [],
    });
  });

  it("should compute average/median/longest session and sessions-per-day", () => {
    const dayA = dayjs().subtract(10, "day");
    const dayB = dayjs().subtract(5, "day");
    const t1 = buildTranscription({
      transcript: wordList(10),
      createdAt: dayA.hour(9).toISOString(),
    });
    const t2 = buildTranscription({
      transcript: wordList(30),
      createdAt: dayA.hour(15).toISOString(),
    });
    const t3 = buildTranscription({
      transcript: wordList(20),
      createdAt: dayB.hour(9).toISOString(),
    });

    const stats = computeSessionStats([t1, t2, t3]);

    expect(stats.avgWordsPerSession).toBe(20); // (10+30+20)/3
    expect(stats.medianWordsPerSession).toBe(20); // sorted [10,20,30]
    expect(stats.longestSessionWords).toBe(30);
    expect(stats.longestSessionDate).toBe(dayA.format("YYYY-MM-DD"));
    expect(stats.sessionsPerActiveDay).toBe(1.5); // 3 sessions / 2 active days
    expect(stats.wordsPerSessionWeekly).toHaveLength(8);
  });
});

describe("computeWeekComparison", () => {
  it("should compare this week to last week across words, wpm, and active days", () => {
    const thisWeekStart = dayjs().startOf("week");
    const lastWeekStart = thisWeekStart.subtract(1, "week");

    const tw1 = buildTranscription({
      transcript: wordList(10),
      createdAt: thisWeekStart.add(1, "day").hour(10).toISOString(),
      audio: { filePath: "a", durationMs: 60000 },
    });
    const tw2 = buildTranscription({
      transcript: wordList(5),
      createdAt: thisWeekStart.add(2, "day").hour(10).toISOString(),
      audio: { filePath: "b", durationMs: 30000 },
    });
    const lw1 = buildTranscription({
      transcript: wordList(20),
      createdAt: lastWeekStart.add(1, "day").hour(10).toISOString(),
      audio: { filePath: "c", durationMs: 60000 },
    });

    const comparison = computeWeekComparison([tw1, tw2, lw1]);

    expect(comparison.wordsThisWeek).toBe(15);
    expect(comparison.wordsLastWeek).toBe(20);
    expect(comparison.wordsDeltaPct).toBe(-25);
    expect(comparison.wpmThisWeek).toBe(10); // 15 words / 1.5 min
    expect(comparison.wpmLastWeek).toBe(20); // 20 words / 1 min
    expect(comparison.wpmDeltaPct).toBe(-50);
    expect(comparison.activeDaysThisWeek).toBe(2);
    expect(comparison.activeDaysLastWeek).toBe(1);
    expect(comparison.activeDaysDelta).toBe(1);
    expect(comparison.personalBestWeekWords).toBe(20);
    expect(comparison.paceVsBestWeekPct).toBe(75);
  });

  it("should return null deltas when there is no prior week to compare", () => {
    const t = buildTranscription({
      transcript: wordList(10),
      createdAt: dayjs().startOf("week").add(1, "day").toISOString(),
    });

    const comparison = computeWeekComparison([t]);

    expect(comparison.wordsDeltaPct).toBeNull();
    expect(comparison.wpmDeltaPct).toBeNull();
    expect(comparison.paceVsBestWeekPct).toBe(100);
  });
});

describe("computeCoachingTrend", () => {
  const baseProfile = {
    name: "",
    identity: "",
    traits: [],
    topics: [],
    style: "",
    quirks: [],
    generated: false,
  };

  const buildStored = (
    createdAt: number,
    stats?: CoachingSnapshot,
  ): StoredVoiceProfile => ({
    milestone: 1,
    createdAt,
    totalWords: 0,
    profile: baseProfile,
    catchphrase: null,
    mostUsedWord: null,
    stats,
  });

  it("should return null when fewer than two generations have recorded stats", () => {
    const history = [
      buildStored(1000, {
        fillerRate: 5,
        avgSentenceLength: 15,
        vocabularySize: 100,
        questionRatio: 10,
        wpm: 100,
      }),
      buildStored(2000), // no stats
    ];

    expect(computeCoachingTrend(history)).toBeNull();
  });

  it("should compute grounded deltas and a summary between the first and last generation", () => {
    const t1 = Date.now() - 2 * 86400000;
    const t2 = Date.now() - 1 * 86400000;
    const history = [
      buildStored(t1, {
        fillerRate: 10,
        avgSentenceLength: 30,
        vocabularySize: 100,
        questionRatio: 40,
        wpm: 100,
      }),
      buildStored(t2, {
        fillerRate: 5,
        avgSentenceLength: 15,
        vocabularySize: 150,
        questionRatio: 10,
        wpm: 120,
      }),
    ];

    const trend = computeCoachingTrend(history);

    expect(trend).not.toBeNull();
    expect(trend?.fillerRateDeltaPct).toBe(-50);
    expect(trend?.avgSentenceLengthDeltaPct).toBe(-50);
    expect(trend?.vocabularySizeDeltaPct).toBe(50);
    expect(trend?.questionRatioDeltaPct).toBe(-75);
    expect(trend?.wpmDeltaPct).toBe(20);

    const directions = trend?.summary.map((s) => s.direction) ?? [];
    expect(directions.every((d) => d === "positive")).toBe(true);
    expect(trend?.summary.length).toBe(4);
    expect(trend?.fillerPoints).toHaveLength(2);
  });
});

describe("templatedCoaching", () => {
  const words = (overrides: Partial<WordAnalysis>): WordAnalysis => ({
    vocabularySize: 300,
    fillerRate: 2,
    avgSentenceLength: 14,
    questionRatio: 10,
    topPhrases: [],
    ...overrides,
  });

  it("should note strengths for a low filler rate and balanced sentences", () => {
    const coaching = templatedCoaching(words({}));
    expect(coaching).toBeDefined();
    expect(coaching!.strengths.some((s) => s.includes("Low filler rate"))).toBe(
      true,
    );
    expect(
      coaching!.strengths.some((s) => s.includes("Well-balanced sentences")),
    ).toBe(true);
  });

  it("should flag growth areas for high filler rate and long sentences", () => {
    const coaching = templatedCoaching(
      words({ fillerRate: 10, avgSentenceLength: 30 }),
    );
    expect(coaching).toBeDefined();
    expect(coaching!.growthAreas.some((g) => g.includes("Filler words"))).toBe(
      true,
    );
    expect(
      coaching!.growthAreas.some((g) => g.includes("Sentences run long")),
    ).toBe(true);
    expect(coaching!.suggestions.length).toBeGreaterThan(0);
  });

  it("should fall back to a generic suggestion when nothing needs improvement", () => {
    const coaching = templatedCoaching(words({}));
    expect(coaching).toBeDefined();
    expect(coaching!.suggestions).toEqual([
      "Keep going — re-run this after more dictation for a sharper read on your speaking.",
    ]);
  });
});

describe("templatedProfile", () => {
  it("should build a grounded, non-generated fallback profile from measured stats", () => {
    const baseProfile: VoiceProfile = {
      name: "The Swift Builder",
      description: "You dictate mostly around 9 AM.",
      catchphrase: null,
      mostUsedWord: "code",
      mostCorrectedWord: null,
      peakHourLabel: "9 AM",
      peakWeekday: "Monday",
      topApp: "VSCode",
      milestone: 1,
    };
    const words: WordAnalysis = {
      vocabularySize: 700,
      fillerRate: 1,
      avgSentenceLength: 12,
      questionRatio: 25,
      topPhrases: [{ phrase: "machine learning", count: 3 }],
    };
    const transcriptions = [
      buildTranscription({
        transcript: "database database database migration migration",
      }),
      buildTranscription({ transcript: "database schema migration plan" }),
    ];

    const profile = templatedProfile(baseProfile, transcriptions, words);

    expect(profile.generated).toBe(false);
    expect(profile.name).toBe(baseProfile.name);
    expect(profile.identity).toBe(baseProfile.description);
    expect(profile.quirks).toContain("Rarely uses filler words");
    expect(profile.quirks).toContain("Frames things as questions");
    expect(profile.quirks).toContain('Repeats "machine learning"');
    expect(profile.personality).toContain("Articulate");
    expect(profile.personality).toContain("Inquisitive");
    expect(profile.coaching?.strengths.length).toBeGreaterThan(0);
    expect(profile.topics).toContain("Database");
  });
});

describe("computeTranscriptionPerformance", () => {
  it("returns a zeroed-out result when there is no timed data", () => {
    const result = computeTranscriptionPerformance(
      [buildTranscription()],
      [buildEvent()],
    );

    expect(result.sampleSize).toBe(0);
    expect(result.realtimeFactor).toBe(0);
    expect(result.wordsPerSecond).toBe(0);
    expect(result.avgTranscribeMs).toBe(0);
    expect(result.fastestTranscribeMs).toBe(0);
    expect(result.avgPostprocessMs).toBeNull();
    expect(result.activeDevice).toBeNull();
    expect(result.activeModel).toBeNull();
    expect(result.speedTrend).toEqual([]);
  });

  it("ignores rows missing audio duration or transcription duration", () => {
    const transcriptions = [
      buildTranscription({
        audio: { filePath: "a", durationMs: 10000 },
        transcriptionDurationMs: null,
      }),
      buildTranscription({
        audio: undefined,
        transcriptionDurationMs: 2000,
      }),
      buildTranscription({
        audio: { filePath: "b", durationMs: 10000 },
        transcriptionDurationMs: 2000,
        inferenceDevice: "gpu:0",
        modelSize: "large-v3-turbo",
      }),
    ];

    const result = computeTranscriptionPerformance(transcriptions, []);

    expect(result.sampleSize).toBe(1);
    expect(result.realtimeFactor).toBe(5);
    expect(result.avgTranscribeMs).toBe(2000);
    expect(result.fastestTranscribeMs).toBe(2000);
    expect(result.activeDevice).toBe("GPU");
    expect(result.activeModel).toBe("large-v3-turbo");
  });

  it("averages realtime factor and picks the fastest run", () => {
    const transcriptions = [
      buildTranscription({
        createdAt: dayjs().subtract(2, "day").toISOString(),
        audio: { filePath: "a", durationMs: 10000 }, // 10s audio
        transcriptionDurationMs: 2000, // 5x real-time
        inferenceDevice: "cpu",
        modelSize: "small",
      }),
      buildTranscription({
        createdAt: dayjs().subtract(1, "day").toISOString(),
        audio: { filePath: "b", durationMs: 10000 }, // 10s audio
        transcriptionDurationMs: 1000, // 10x real-time, fastest
        inferenceDevice: "cpu",
        modelSize: "small",
      }),
    ];

    const result = computeTranscriptionPerformance(transcriptions, []);

    expect(result.sampleSize).toBe(2);
    expect(result.realtimeFactor).toBe(7.5);
    expect(result.avgTranscribeMs).toBe(1500);
    expect(result.fastestTranscribeMs).toBe(1000);
    expect(result.activeDevice).toBe("CPU");
    expect(result.activeModel).toBe("small");
    expect(result.speedTrend.length).toBe(2);
  });

  it("derives words-per-second and post-processing time from events, ignoring untimed ones", () => {
    const events = [
      buildEvent({ wordCount: 20, transcriptionDurationMs: 2000 }), // 10 wps
      buildEvent({ wordCount: 30, transcriptionDurationMs: 3000 }), // 10 wps
      buildEvent({ wordCount: 10, transcriptionDurationMs: null }), // ignored
      buildEvent({ postprocessDurationMs: 500 }),
      buildEvent({ postprocessDurationMs: 1500 }),
    ];
    const transcriptions = [
      buildTranscription({
        audio: { filePath: "a", durationMs: 10000 },
        transcriptionDurationMs: 5000,
      }),
    ];

    const result = computeTranscriptionPerformance(transcriptions, events);

    expect(result.wordsPerSecond).toBe(10);
    expect(result.avgPostprocessMs).toBe(1000);
  });
});
