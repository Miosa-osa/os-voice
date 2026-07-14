import dayjs from "dayjs";
import { Term, Transcription } from "@voquill/types";
import { LocalDictationEvent } from "../../repos/insights.repo";

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
  const start = dayjs().subtract(HEATMAP_DAYS - 1, "day");
  for (let i = 0; i < HEATMAP_DAYS; i++) {
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
    const source = term.sourceValue.trim().toLowerCase();
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

export const milestoneFor = (totalWords: number): number =>
  Math.floor(totalWords / MILESTONE_WORDS);

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
