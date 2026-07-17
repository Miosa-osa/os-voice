import dayjs from "dayjs";
import { Term, Transcription } from "@voquill/types";
import { LocalDictationEvent } from "../../repos/insights.repo";
import { AiVoiceProfile } from "./profile.types";

export type UsageCategory = "AI prompts" | "Coding" | "Writing" | "Other";
export type HeatmapCell = { date: string; words: number; level: number };
export type AppBreakdown = {
  category: UsageCategory;
  words: number;
  count: number;
};

export type UsageStats = {
  wordsThisMonth: number;
  totalWords: number;
  wpm: number;
  fixes: number;
  totalDictations: number;
  heatmap: HeatmapCell[];
  currentStreak: number;
  longestStreak: number;
  breakdown: AppBreakdown[];
};

export type BooksComparison = {
  novels: number;
  percent: number;
  phrase: string;
};

export type VoiceProfile = {
  name: string;
  description: string;
  catchphrase: string | null;
  mostUsedWord: string | null;
  mostCorrectedWord: string | null;
  peakHourLabel: string | null;
  peakWeekday: string | null;
  topApp: string | null;
  milestone: number;
};

export type PersonalRecord = { label: string; value: string; detail?: string };
export type LeaderboardData = {
  records: PersonalRecord[];
  topApps: { app: string; words: number }[];
};

export const AVG_NOVEL_WORDS = 90000;
export const MILESTONE_WORDS = 10000;
const HEATMAP_DAYS = 371;

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "so",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "it",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "me",
  "my",
  "your",
  "our",
  "their",
  "his",
  "her",
  "its",
  "as",
  "if",
  "then",
  "than",
  "there",
  "here",
  "just",
  "like",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "can",
  "could",
  "should",
  "not",
  "no",
  "yes",
  "up",
  "out",
  "about",
  "into",
  "over",
  "from",
  "by",
  "im",
  "okay",
  "ok",
  "um",
  "uh",
  "gonna",
  "wanna",
  "kind",
  "really",
  "very",
  "get",
  "got",
  "want",
  "need",
]);

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const countWords = (text: string): number => tokenize(text).length;

const transcriptWords = (t: Transcription): number => countWords(t.transcript);

const audioMs = (t: Transcription): number => t.audio?.durationMs ?? 0;

export const countWordChanges = (a: string, b: string): number => {
  const counts = new Map<string, number>();
  for (const w of tokenize(a)) counts.set(w, (counts.get(w) ?? 0) + 1);
  for (const w of tokenize(b)) counts.set(w, (counts.get(w) ?? 0) - 1);
  let diff = 0;
  for (const v of counts.values()) diff += Math.abs(v);
  return Math.ceil(diff / 2);
};

const activeTranscriptions = (
  transcriptions: Transcription[],
): Transcription[] =>
  transcriptions.filter((t) => !t.isDeleted && t.transcript.trim().length > 0);

export const categorizeApp = (appName: string | null): UsageCategory => {
  const n = (appName ?? "").toLowerCase();
  if (!n) return "Other";
  if (
    /(chatgpt|chat gpt|gpt|claude|copilot|gemini|perplexity|\bai\b|assistant)/.test(
      n,
    )
  ) {
    return "AI prompts";
  }
  if (
    /(code|vscode|vs code|cursor|intellij|pycharm|webstorm|xcode|vim|neovim|terminal|iterm|sublime|zed)/.test(
      n,
    )
  ) {
    return "Coding";
  }
  if (
    /(word|docs|doc|pages|notion|obsidian|gmail|mail|slack|discord|notes|browser|chrome|firefox|safari|edge)/.test(
      n,
    )
  ) {
    return "Writing";
  }
  return "Other";
};

const buildHeatmap = (transcriptions: Transcription[]): HeatmapCell[] => {
  const byDay = new Map<string, number>();
  for (const t of transcriptions) {
    const key = dayjs(t.createdAt).format("YYYY-MM-DD");
    byDay.set(key, (byDay.get(key) ?? 0) + transcriptWords(t));
  }
  const max = Math.max(1, ...Array.from(byDay.values()));
  const cells: HeatmapCell[] = [];
  // Back the window up to the Sunday on/before it so the flat cell array chunks
  // into Sun→Sat weeks and the weekday row labels (Mon/Wed/Fri) line up.
  const rawStart = dayjs().subtract(HEATMAP_DAYS - 1, "day");
  const start = rawStart.subtract(rawStart.day(), "day");
  const totalDays = HEATMAP_DAYS + rawStart.day();
  for (let i = 0; i < totalDays; i++) {
    const day = start.add(i, "day");
    const key = day.format("YYYY-MM-DD");
    const words = byDay.get(key) ?? 0;
    const level = words === 0 ? 0 : Math.min(4, Math.ceil((words / max) * 4));
    cells.push({ date: key, words, level });
  }
  return cells;
};

const computeStreaks = (
  transcriptions: Transcription[],
): { current: number; longest: number } => {
  const days = new Set(
    transcriptions.map((t) => dayjs(t.createdAt).format("YYYY-MM-DD")),
  );
  if (days.size === 0) return { current: 0, longest: 0 };

  let longest = 0;
  let run = 0;
  const sorted = Array.from(days).sort();
  let prev: dayjs.Dayjs | null = null;
  for (const key of sorted) {
    const d = dayjs(key);
    if (prev && d.diff(prev, "day") === 1) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = d;
  }

  let current = 0;
  let cursor = dayjs();
  if (!days.has(cursor.format("YYYY-MM-DD"))) {
    cursor = cursor.subtract(1, "day");
  }
  while (days.has(cursor.format("YYYY-MM-DD"))) {
    current += 1;
    cursor = cursor.subtract(1, "day");
  }

  return { current, longest };
};

export const booksComparison = (totalWords: number): BooksComparison => {
  const novels = totalWords / AVG_NOVEL_WORDS;
  const percent = Math.round(novels * 100);
  const phrase =
    novels >= 1
      ? `${novels.toFixed(1)} average novels`
      : `${percent}% of an average novel`;
  return { novels, percent, phrase };
};

export const computeUsage = (
  events: LocalDictationEvent[],
  transcriptions: Transcription[],
): UsageStats => {
  const active = activeTranscriptions(transcriptions);
  const thisMonth = dayjs().format("YYYY-MM");

  let totalWords = 0;
  let wordsThisMonth = 0;
  let totalAudioMs = 0;
  let fixes = 0;
  for (const t of active) {
    const words = transcriptWords(t);
    totalWords += words;
    totalAudioMs += audioMs(t);
    if (dayjs(t.createdAt).format("YYYY-MM") === thisMonth) {
      wordsThisMonth += words;
    }
    if (t.rawTranscript) {
      fixes += countWordChanges(t.rawTranscript, t.transcript);
    }
  }

  const audioMinutes = totalAudioMs / 60000;
  const wpm = audioMinutes > 0 ? Math.round(totalWords / audioMinutes) : 0;

  const breakdownMap = new Map<
    UsageCategory,
    { words: number; count: number }
  >();
  for (const e of events) {
    const category = categorizeApp(e.appName);
    const entry = breakdownMap.get(category) ?? { words: 0, count: 0 };
    entry.words += e.wordCount;
    entry.count += 1;
    breakdownMap.set(category, entry);
  }
  const breakdown: AppBreakdown[] = Array.from(breakdownMap.entries())
    .map(([category, v]) => ({ category, words: v.words, count: v.count }))
    .sort((a, b) => b.words - a.words);

  const streaks = computeStreaks(active);

  return {
    wordsThisMonth,
    totalWords,
    wpm,
    fixes,
    totalDictations: active.length,
    heatmap: buildHeatmap(active),
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    breakdown,
  };
};

const topEntry = <K>(map: Map<K, number>): K | null => {
  let best: K | null = null;
  let bestCount = 0;
  for (const [key, count] of map.entries()) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
};

const mostUsedWord = (allText: string): string | null => {
  const counts = new Map<string, number>();
  for (const w of tokenize(allText)) {
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return topEntry(counts);
};

const topCatchphrase = (allText: string): string | null => {
  const words = tokenize(allText);
  const counts = new Map<string, number>();
  for (let size = 4; size >= 2; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const gram = words.slice(i, i + size);
      if (STOPWORDS.has(gram[0]) || STOPWORDS.has(gram[size - 1])) continue;
      const key = gram.join(" ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestScore = 0;
  for (const [phrase, count] of counts.entries()) {
    if (count < 2) continue;
    const score = count * phrase.split(" ").length;
    if (score > bestScore) {
      best = phrase;
      bestScore = score;
    }
  }
  return best;
};

const mostCorrectedWord = (allText: string, terms: Term[]): string | null => {
  const lower = ` ${tokenize(allText).join(" ")} `;
  let best: string | null = null;
  let bestCount = 0;
  for (const term of terms) {
    // Normalize the source through the same tokenizer as the text, so hyphenated
    // terms (e.g. "well-known" → "well known") can still be matched.
    const source = tokenize(term.sourceValue).join(" ");
    if (!source) continue;
    const matches = lower.split(` ${source} `).length - 1;
    if (matches > bestCount) {
      best = term.sourceValue;
      bestCount = matches;
    }
  }
  return best;
};

const hourLabel = (hour: number): string => {
  const period = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${period}`;
};

const peakHour = (transcriptions: Transcription[]): number | null => {
  const counts = new Map<number, number>();
  for (const t of transcriptions) {
    const h = dayjs(t.createdAt).hour();
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  return topEntry(counts);
};

const peakWeekday = (transcriptions: Transcription[]): string | null => {
  const counts = new Map<number, number>();
  for (const t of transcriptions) {
    const d = dayjs(t.createdAt).day();
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const day = topEntry(counts);
  return day === null ? null : WEEKDAYS[day];
};

const ADJECTIVES = [
  "Swift",
  "Nocturnal",
  "Precise",
  "Prolific",
  "Rapid",
  "Thoughtful",
  "Relentless",
  "Fluent",
  "Sharp",
  "Boundless",
  "Tireless",
  "Vivid",
];

const NOUNS_BY_CATEGORY: Record<UsageCategory, string[]> = {
  "AI prompts": ["Orchestrator", "Conjurer", "Prompter", "Whisperer"],
  Coding: ["Architect", "Engineer", "Builder", "Compiler"],
  Writing: ["Wordsmith", "Author", "Scribe", "Narrator"],
  Other: ["Voice", "Speaker", "Communicator", "Dictator"],
};

const seededPick = <T>(arr: T[], seed: number): T =>
  arr[Math.abs(seed) % arr.length];

const generateName = (
  milestone: number,
  topCategory: UsageCategory,
  hour: number | null,
): string => {
  const adjective =
    hour !== null && (hour >= 22 || hour < 5)
      ? "Nocturnal"
      : seededPick(ADJECTIVES, milestone * 7 + 3);
  const noun = seededPick(NOUNS_BY_CATEGORY[topCategory], milestone * 13 + 1);
  return `The ${adjective} ${noun}`;
};

export const computeVoiceProfile = (
  events: LocalDictationEvent[],
  transcriptions: Transcription[],
  terms: Term[],
  milestone: number,
): VoiceProfile => {
  const active = activeTranscriptions(transcriptions);
  const allText = active.map((t) => t.transcript).join(" \n ");

  const appCounts = new Map<string, number>();
  for (const e of events) {
    if (e.appName)
      appCounts.set(e.appName, (appCounts.get(e.appName) ?? 0) + 1);
  }
  const topApp = topEntry(appCounts);

  const categoryCounts = new Map<UsageCategory, number>();
  for (const e of events) {
    const c = categorizeApp(e.appName);
    categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
  }
  const topCategory = topEntry(categoryCounts) ?? "Other";

  const hour = peakHour(active);
  const weekday = peakWeekday(active);
  const catchphrase = topCatchphrase(allText);
  const mostUsed = mostUsedWord(allText);
  const corrected = mostCorrectedWord(allText, terms);

  const name = generateName(milestone, topCategory, hour);

  const bits: string[] = [];
  if (hour !== null) bits.push(`you dictate most around ${hourLabel(hour)}`);
  if (weekday) bits.push(`${weekday}s are your busiest day`);
  if (topApp) bits.push(`mostly in ${topApp}`);
  if (mostUsed) bits.push(`your signature word is "${mostUsed}"`);
  const description = bits.length
    ? `Here's what we've identified from you: ${bits.join(", ")}.`
    : "Keep dictating and we'll build your voice profile as we learn how you speak.";

  return {
    name,
    description,
    catchphrase,
    mostUsedWord: mostUsed,
    mostCorrectedWord: corrected,
    peakHourLabel: hour === null ? null : hourLabel(hour),
    peakWeekday: weekday,
    topApp,
    milestone,
  };
};

export const MILESTONE_SCHEDULE = [
  2000, 5000, 10000, 25000, 50000, 100000, 250000,
];
export const PROFILE_UNLOCK_WORDS = 2000;
export const SIGNATURE_UNLOCK_WORDS = 5000;
export const WORD_ANALYSIS_UNLOCK_WORDS = 10000;

// How many milestone thresholds the user has crossed (0 before 2k).
export const milestoneFor = (totalWords: number): number =>
  MILESTONE_SCHEDULE.filter((m) => totalWords >= m).length;

export const nextMilestoneWords = (totalWords: number): number | null =>
  MILESTONE_SCHEDULE.find((m) => m > totalWords) ?? null;

// Extract clean single-word corrections from an edit (old -> new) so the
// dictionary can auto-learn. Only clean 1:1 word substitutions are captured.
export const learnTermsFromEdit = (
  oldText: string,
  newText: string,
  existingSources: Set<string>,
  max = 5,
): { source: string; destination: string }[] => {
  const wordRe = /[A-Za-z][A-Za-z'’-]*/g;
  const a = oldText.match(wordRe) ?? [];
  const b = newText.match(wordRe) ?? [];
  if (a.length === 0 || b.length === 0) return [];

  // Longest common subsequence of the two word arrays (case-insensitive), so we
  // only learn genuine single-word corrections — not garbage from rephrases that
  // happen to keep the same word count.
  const eq = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = eq(a[i], b[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const anchors: [number, number][] = [];
  let ai = 0;
  let bj = 0;
  while (ai < n && bj < m) {
    if (eq(a[ai], b[bj])) {
      anchors.push([ai, bj]);
      ai += 1;
      bj += 1;
    } else if (dp[ai + 1][bj] >= dp[ai][bj + 1]) {
      ai += 1;
    } else {
      bj += 1;
    }
  }

  // A clean substitution is exactly one differing word on each side, flanked by
  // matching anchor words on both sides (unchanged context).
  const out: { source: string; destination: string }[] = [];
  const seen = new Set<string>();
  for (let k = 0; k + 1 < anchors.length && out.length < max; k += 1) {
    const [pi, pj] = anchors[k];
    const [ni, nj] = anchors[k + 1];
    if (ni - pi !== 2 || nj - pj !== 2) continue;
    const source = a[pi + 1];
    const destination = b[pj + 1];
    const key = source.toLowerCase();
    if (source.length < 2 || destination.length < 2) continue;
    if (key === destination.toLowerCase()) continue;
    if (existingSources.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ source, destination });
  }
  return out;
};

export const computeLeaderboard = (
  events: LocalDictationEvent[],
  transcriptions: Transcription[],
): LeaderboardData => {
  const active = activeTranscriptions(transcriptions);
  const records: PersonalRecord[] = [];

  const wordsByDay = new Map<string, number>();
  const audioByDay = new Map<string, number>();
  for (const t of active) {
    const key = dayjs(t.createdAt).format("YYYY-MM-DD");
    wordsByDay.set(key, (wordsByDay.get(key) ?? 0) + transcriptWords(t));
    audioByDay.set(key, (audioByDay.get(key) ?? 0) + audioMs(t));
  }

  let bestWordsDay = { day: "", words: 0 };
  for (const [day, words] of wordsByDay.entries()) {
    if (words > bestWordsDay.words) bestWordsDay = { day, words };
  }

  let bestWpmDay = { day: "", wpm: 0 };
  for (const [day, words] of wordsByDay.entries()) {
    const minutes = (audioByDay.get(day) ?? 0) / 60000;
    if (minutes > 0.1) {
      const wpm = Math.round(words / minutes);
      if (wpm > bestWpmDay.wpm) bestWpmDay = { day, wpm };
    }
  }

  const streaks = computeStreaks(active);

  let longestDictation = 0;
  let biggestDictation = 0;
  for (const t of active) {
    longestDictation = Math.max(longestDictation, audioMs(t));
    biggestDictation = Math.max(biggestDictation, transcriptWords(t));
  }

  if (bestWordsDay.words > 0) {
    records.push({
      label: "Most words in a day",
      value: bestWordsDay.words.toLocaleString(),
      detail: dayjs(bestWordsDay.day).format("MMM D, YYYY"),
    });
  }
  if (bestWpmDay.wpm > 0) {
    records.push({
      label: "Best speaking pace",
      value: `${bestWpmDay.wpm} WPM`,
      detail: dayjs(bestWpmDay.day).format("MMM D, YYYY"),
    });
  }
  if (streaks.longest > 0) {
    records.push({
      label: "Longest streak",
      value: `${streaks.longest} days`,
    });
  }
  if (biggestDictation > 0) {
    records.push({
      label: "Longest single dictation",
      value: `${biggestDictation.toLocaleString()} words`,
    });
  }
  if (longestDictation > 0) {
    records.push({
      label: "Longest recording",
      value: `${Math.round(longestDictation / 1000)}s`,
    });
  }

  const wordsByApp = new Map<string, number>();
  for (const e of events) {
    if (!e.appName) continue;
    wordsByApp.set(e.appName, (wordsByApp.get(e.appName) ?? 0) + e.wordCount);
  }
  const topApps = Array.from(wordsByApp.entries())
    .map(([app, words]) => ({ app, words }))
    .sort((a, b) => b.words - a.words)
    .slice(0, 5);

  return { records, topApps };
};

export const templatedProfile = (base: VoiceProfile): AiVoiceProfile => ({
  name: base.name,
  identity: base.description,
  traits: [],
  topics: [],
  style: "",
  quirks: [],
  generated: false,
});

export const sampleTranscripts = (
  transcriptions: Transcription[],
  limit = 40,
): string[] =>
  activeTranscriptions(transcriptions)
    .slice()
    .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
    .slice(0, limit)
    .map((t) => t.transcript.trim())
    .filter(Boolean);

const FILLERS = new Set([
  "um",
  "uh",
  "like",
  "basically",
  "literally",
  "actually",
  "honestly",
  "just",
  "really",
  "kinda",
  "sorta",
  "yeah",
]);

export type WordAnalysis = {
  vocabularySize: number;
  fillerRate: number;
  avgSentenceLength: number;
  questionRatio: number;
  topPhrases: { phrase: string; count: number }[];
};

export const computeWordAnalysis = (
  transcriptions: Transcription[],
): WordAnalysis => {
  const active = activeTranscriptions(transcriptions);
  const allText = active.map((t) => t.transcript).join(" \n ");
  const words = tokenize(allText);
  const total = Math.max(1, words.length);
  const vocab = new Set(
    words.filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );
  let fillers = 0;
  for (const w of words) if (FILLERS.has(w)) fillers += 1;

  const sentences = allText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const questions = active.reduce(
    (n, t) => n + (t.transcript.match(/\?/g)?.length ?? 0),
    0,
  );

  const counts = new Map<string, number>();
  for (let size = 3; size >= 2; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const gram = words.slice(i, i + size);
      if (STOPWORDS.has(gram[0]) || STOPWORDS.has(gram[size - 1])) continue;
      const key = gram.join(" ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const topPhrases = Array.from(counts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 6)
    .map(([phrase, count]) => ({ phrase, count }));

  return {
    vocabularySize: vocab.size,
    fillerRate: Math.round((fillers / total) * 1000) / 10,
    avgSentenceLength: sentences.length
      ? Math.round(total / sentences.length)
      : 0,
    questionRatio: sentences.length
      ? Math.round((questions / sentences.length) * 100)
      : 0,
    topPhrases,
  };
};

export type UsageExtras = {
  hourHistogram: number[];
  perApp: { app: string; words: number; count: number; avgLength: number }[];
  bestDay: { day: string; words: number } | null;
  dailyTrend: { date: string; words: number }[];
};

export const computeUsageExtras = (
  events: LocalDictationEvent[],
  transcriptions: Transcription[],
): UsageExtras => {
  const active = activeTranscriptions(transcriptions);
  const hourHistogram: number[] = Array.from({ length: 24 }, () => 0);
  const byDay = new Map<string, number>();
  for (const t of active) {
    hourHistogram[dayjs(t.createdAt).hour()] += transcriptWords(t);
    const k = dayjs(t.createdAt).format("YYYY-MM-DD");
    byDay.set(k, (byDay.get(k) ?? 0) + transcriptWords(t));
  }

  const perAppMap = new Map<string, { words: number; count: number }>();
  for (const e of events) {
    if (!e.appName) continue;
    const x = perAppMap.get(e.appName) ?? { words: 0, count: 0 };
    x.words += e.wordCount;
    x.count += 1;
    perAppMap.set(e.appName, x);
  }
  const perApp = Array.from(perAppMap.entries())
    .map(([app, v]) => ({
      app,
      words: v.words,
      count: v.count,
      avgLength: v.count ? Math.round(v.words / v.count) : 0,
    }))
    .sort((a, b) => b.words - a.words)
    .slice(0, 6);

  let bestDay: { day: string; words: number } | null = null;
  for (const [day, words] of byDay.entries()) {
    if (!bestDay || words > bestDay.words) bestDay = { day, words };
  }

  const dailyTrend: { date: string; words: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = dayjs().subtract(i, "day").format("YYYY-MM-DD");
    dailyTrend.push({ date: d, words: byDay.get(d) ?? 0 });
  }

  return { hourHistogram, perApp, bestDay, dailyTrend };
};

export type Achievement = {
  key: string;
  label: string;
  description: string;
  unlocked: boolean;
  progress: number;
};

export const computeAchievements = (
  events: LocalDictationEvent[],
  transcriptions: Transcription[],
): Achievement[] => {
  const usage = computeUsage(events, transcriptions);
  const active = activeTranscriptions(transcriptions);
  const byDay = new Map<string, number>();
  for (const t of active) {
    const k = dayjs(t.createdAt).format("YYYY-MM-DD");
    byDay.set(k, (byDay.get(k) ?? 0) + transcriptWords(t));
  }
  const mostInDay = Math.max(0, ...Array.from(byDay.values()));

  const goal = (
    key: string,
    label: string,
    description: string,
    value: number,
    target: number,
  ): Achievement => ({
    key,
    label,
    description,
    unlocked: value >= target,
    progress: Math.max(0, Math.min(1, value / target)),
  });

  return [
    goal("w1k", "First 1,000", "Dictate 1,000 words", usage.totalWords, 1000),
    goal(
      "w10k",
      "First 10k",
      "Reach your first 10,000-word milestone",
      usage.totalWords,
      10000,
    ),
    goal(
      "w50k",
      "Half a novel",
      "Dictate 50,000 words",
      usage.totalWords,
      50000,
    ),
    goal(
      "novel",
      "Novelist",
      "Dictate a full novel (90,000 words)",
      usage.totalWords,
      AVG_NOVEL_WORDS,
    ),
    goal(
      "s7",
      "Week streak",
      "Dictate 7 days in a row",
      usage.longestStreak,
      7,
    ),
    goal("s30", "Monthly habit", "30-day streak", usage.longestStreak, 30),
    goal("bigday", "Big day", "1,000 words in a single day", mostInDay, 1000),
  ];
};

export type Momentum = {
  wordsToday: number;
  wpmToday: number;
  currentStreak: number;
  paceVsAvgPct: number;
  weekProjection: number;
};

export const computeMomentum = (
  events: LocalDictationEvent[],
  transcriptions: Transcription[],
): Momentum => {
  const active = activeTranscriptions(transcriptions);
  const today = dayjs().format("YYYY-MM-DD");
  const weekStart = dayjs().startOf("week");
  let wordsToday = 0;
  let audioToday = 0;
  let wordsThisWeek = 0;
  for (const t of active) {
    const d = dayjs(t.createdAt);
    const w = transcriptWords(t);
    if (d.format("YYYY-MM-DD") === today) {
      wordsToday += w;
      audioToday += audioMs(t);
    }
    if (!d.isBefore(weekStart)) wordsThisWeek += w;
  }
  const usage = computeUsage(events, transcriptions);
  const minsToday = audioToday / 60000;
  const wpmToday = minsToday > 0 ? Math.round(wordsToday / minsToday) : 0;
  const paceVsAvgPct =
    usage.wpm > 0 && wpmToday > 0
      ? Math.round(((wpmToday - usage.wpm) / usage.wpm) * 100)
      : 0;
  const dayOfWeek = Math.max(1, dayjs().diff(weekStart, "day") + 1);
  const weekProjection = Math.round((wordsThisWeek / dayOfWeek) * 7);
  return {
    wordsToday,
    wpmToday,
    currentStreak: usage.currentStreak,
    paceVsAvgPct,
    weekProjection,
  };
};

export type TrendPoint = { label: string; value: number };
export type Trends = {
  wpmWeekly: TrendPoint[];
  vocabGrowth: TrendPoint[];
  fillerWeekly: TrendPoint[];
  wpmDeltaPct: number;
};

export const computeTrends = (transcriptions: Transcription[]): Trends => {
  const active = activeTranscriptions(transcriptions);
  const WEEKS = 8;
  const now = dayjs();
  const wpmWeekly: TrendPoint[] = [];
  const fillerWeekly: TrendPoint[] = [];
  const vocabGrowth: TrendPoint[] = [];
  const vocab = new Set<string>();

  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = now.subtract(i, "week").startOf("week");
    const end = start.add(1, "week");
    let words = 0;
    let ms = 0;
    let fillers = 0;
    let tokens = 0;
    for (const t of active) {
      const d = dayjs(t.createdAt);
      if (d.isBefore(start) || !d.isBefore(end)) continue;
      const ws = tokenize(t.transcript);
      words += ws.length;
      ms += audioMs(t);
      tokens += ws.length;
      for (const w of ws) {
        if (FILLERS.has(w)) fillers += 1;
        if (w.length >= 3 && !STOPWORDS.has(w)) vocab.add(w);
      }
    }
    const mins = ms / 60000;
    const label = start.format("MMM D");
    wpmWeekly.push({ label, value: mins > 0 ? Math.round(words / mins) : 0 });
    fillerWeekly.push({
      label,
      value: tokens > 0 ? Math.round((fillers / tokens) * 1000) / 10 : 0,
    });
    vocabGrowth.push({ label, value: vocab.size });
  }

  const last = wpmWeekly[wpmWeekly.length - 1]?.value ?? 0;
  const prev = wpmWeekly[wpmWeekly.length - 2]?.value ?? 0;
  const wpmDeltaPct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
  return { wpmWeekly, vocabGrowth, fillerWeekly, wpmDeltaPct };
};

export type Predictions = {
  nextMilestone: number | null;
  daysToNextMilestone: number | null;
  projectedMonthWords: number;
  dailyRate: number;
};

export const computePredictions = (
  events: LocalDictationEvent[],
  transcriptions: Transcription[],
): Predictions => {
  const active = activeTranscriptions(transcriptions);
  const usage = computeUsage(events, transcriptions);
  const byDay = new Map<string, number>();
  for (const t of active) {
    const k = dayjs(t.createdAt).format("YYYY-MM-DD");
    byDay.set(k, (byDay.get(k) ?? 0) + transcriptWords(t));
  }
  let recent = 0;
  for (let i = 0; i < 14; i++) {
    const k = dayjs().subtract(i, "day").format("YYYY-MM-DD");
    recent += byDay.get(k) ?? 0;
  }
  const dailyRate = Math.round(recent / 14);
  const next = nextMilestoneWords(usage.totalWords);
  const daysToNextMilestone =
    next !== null && dailyRate > 0
      ? Math.ceil((next - usage.totalWords) / dailyRate)
      : null;
  const dayOfMonth = dayjs().date();
  const daysInMonth = dayjs().daysInMonth();
  const projectedMonthWords =
    dayOfMonth > 0
      ? Math.round((usage.wordsThisMonth / dayOfMonth) * daysInMonth)
      : usage.wordsThisMonth;
  return {
    nextMilestone: next,
    daysToNextMilestone,
    projectedMonthWords,
    dailyRate,
  };
};

export type CloudWord = { word: string; count: number };

export const computeWordCloud = (
  transcriptions: Transcription[],
  max = 40,
): CloudWord[] => {
  const counts = new Map<string, number>();
  for (const t of activeTranscriptions(transcriptions)) {
    for (const w of tokenize(t.transcript)) {
      if (w.length < 3 || STOPWORDS.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
};

const STREAK_TARGETS = [7, 30, 100, 365];

export type StreakNudge = {
  streak: number;
  remaining: number;
  target: number;
} | null;

const streakNudge = (streak: number): StreakNudge => {
  if (streak <= 0) return null;
  const target = STREAK_TARGETS.find((t) => streak < t);
  if (!target) return null;
  return { streak, remaining: target - streak, target };
};

export type DailyActivitySummary = {
  currentStreak: number;
  longestStreak: number;
  activeDaysThisYear: number;
  activeDaysTotal: number;
  mostActiveDay: { date: string; words: number } | null;
  yearWords: number;
  nudge: StreakNudge;
};

export const computeDailyActivitySummary = (
  transcriptions: Transcription[],
): DailyActivitySummary => {
  const active = activeTranscriptions(transcriptions);
  const byDay = new Map<string, number>();
  for (const t of active) {
    const key = dayjs(t.createdAt).format("YYYY-MM-DD");
    byDay.set(key, (byDay.get(key) ?? 0) + transcriptWords(t));
  }

  const year = dayjs().year();
  let activeDaysThisYear = 0;
  let yearWords = 0;
  let mostActiveDay: { date: string; words: number } | null = null;
  for (const [key, words] of byDay.entries()) {
    if (words <= 0) continue;
    if (dayjs(key).year() === year) {
      activeDaysThisYear += 1;
      yearWords += words;
    }
    if (!mostActiveDay || words > mostActiveDay.words) {
      mostActiveDay = { date: key, words };
    }
  }

  const streaks = computeStreaks(active);
  return {
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    activeDaysThisYear,
    activeDaysTotal: byDay.size,
    mostActiveDay,
    yearWords,
    nudge: streakNudge(streaks.current),
  };
};

export type DayDetail = {
  date: string;
  words: number;
  wpm: number;
  minutes: number;
  dictations: number;
  topApp: string | null;
};

export const computeDayDetail = (
  events: LocalDictationEvent[],
  transcriptions: Transcription[],
  dateKey: string,
): DayDetail => {
  const onDay = activeTranscriptions(transcriptions).filter(
    (t) => dayjs(t.createdAt).format("YYYY-MM-DD") === dateKey,
  );
  let words = 0;
  let ms = 0;
  for (const t of onDay) {
    words += transcriptWords(t);
    ms += audioMs(t);
  }
  const minutes = ms / 60000;
  const wpm = minutes > 0 ? Math.round(words / minutes) : 0;

  const appWords = new Map<string, number>();
  for (const e of events) {
    if (!e.appName) continue;
    if (dayjs(e.timestamp).format("YYYY-MM-DD") !== dateKey) continue;
    appWords.set(e.appName, (appWords.get(e.appName) ?? 0) + e.wordCount);
  }

  return {
    date: dateKey,
    words,
    wpm,
    minutes: Math.round(minutes),
    dictations: onDay.length,
    topApp: topEntry(appWords),
  };
};
