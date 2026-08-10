import dayjs from "dayjs";
import { Term, Transcription } from "@voquill/types";
import { LocalDictationEvent } from "../../repos/insights.repo";
import {
  AiVoiceProfile,
  CoachingSnapshot,
  StoredVoiceProfile,
} from "./profile.types";

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

const capitalizeWord = (w: string): string =>
  w.length ? w.charAt(0).toUpperCase() + w.slice(1) : w;

// A frequency pass over the transcripts (minus stopwords) that also tracks
// how many distinct dictations each word appeared in, so we can distinguish
// "said once a lot in one rant" from "comes up across many sessions".
const domainWordCounts = (
  transcriptions: Transcription[],
): Map<string, { count: number; docs: Set<string> }> => {
  const counts = new Map<string, { count: number; docs: Set<string> }>();
  for (const t of activeTranscriptions(transcriptions)) {
    for (const w of tokenize(t.transcript)) {
      if (w.length < 4 || STOPWORDS.has(w)) continue;
      const entry = counts.get(w) ?? { count: 0, docs: new Set<string>() };
      entry.count += 1;
      entry.docs.add(t.id);
      counts.set(w, entry);
    }
  }
  return counts;
};

// Compute-backed fallback for "topics": the top recurring domain words,
// purely from word frequency — no LLM required.
export const deriveTopics = (
  transcriptions: Transcription[],
  limit = 6,
): string[] => {
  const counts = domainWordCounts(transcriptions);
  return Array.from(counts.entries())
    .filter(([, v]) => v.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([word]) => capitalizeWord(word));
};

// The most frequent distinctive terms, verbatim and lowercase (as they were
// spoken), for the "ubiquitous language" chip row.
export const deriveUbiquitousLanguage = (
  transcriptions: Transcription[],
  limit = 10,
): string[] => {
  const counts = domainWordCounts(transcriptions);
  return Array.from(counts.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([word]) => word);
};

// Terms that recur across multiple distinct dictations (not just repeated in
// one rant) are a better signal for "what you care about" than raw frequency.
export const deriveWhatYouCareAbout = (
  transcriptions: Transcription[],
  limit = 6,
): string[] => {
  const counts = domainWordCounts(transcriptions);
  return Array.from(counts.entries())
    .filter(([, v]) => v.docs.size >= 2)
    .sort((a, b) => b[1].docs.size - a[1].docs.size || b[1].count - a[1].count)
    .slice(0, limit)
    .map(([word]) => capitalizeWord(word));
};

// Compute-backed fallback for "quirks": short, chip-friendly habits derived
// directly from the measured stats, so this section is never empty offline.
export const deriveQuirks = (words: WordAnalysis): string[] => {
  const quirks: string[] = [];
  if (words.fillerRate >= 6) {
    quirks.push("Frequent filler words");
  } else if (words.fillerRate <= 1.5) {
    quirks.push("Rarely uses filler words");
  }
  if (words.avgSentenceLength > 24) {
    quirks.push("Long, flowing sentences");
  } else if (words.avgSentenceLength > 0 && words.avgSentenceLength < 6) {
    quirks.push("Short, punchy sentences");
  }
  if (words.questionRatio >= 25) {
    quirks.push("Frames things as questions");
  }
  if (words.vocabularySize >= 800) {
    quirks.push("Wide-ranging vocabulary");
  }
  if (words.topPhrases.length > 0) {
    quirks.push(`Repeats "${words.topPhrases[0].phrase}"`);
  }
  return quirks.slice(0, 4);
};

// A data-derived "how you speak" sentence — real linguistic analysis from the
// measured stats, so this section isn't empty when the LLM is unavailable.
export const deriveHowYouSpeak = (
  words: WordAnalysis,
  profile: VoiceProfile,
): string => {
  const pace = profile.peakHourLabel
    ? ` most often around ${profile.peakHourLabel}`
    : "";
  const fillerBit =
    words.fillerRate >= 6
      ? `with a fair number of filler words (~${words.fillerRate} per 100)`
      : words.fillerRate <= 1.5
        ? `with very few filler words (~${words.fillerRate} per 100)`
        : `with a moderate amount of filler words (~${words.fillerRate} per 100)`;
  const lengthBit =
    words.avgSentenceLength > 20
      ? `in long, layered sentences (~${words.avgSentenceLength} words)`
      : words.avgSentenceLength > 0 && words.avgSentenceLength < 6
        ? `in short, direct bursts (~${words.avgSentenceLength} words)`
        : `in clear, well-paced sentences (~${words.avgSentenceLength} words)`;
  const questionBit =
    words.questionRatio >= 25
      ? `, and you ask a lot of questions (${words.questionRatio}% of sentences)`
      : "";
  return `You speak${pace} ${lengthBit}, ${fillerBit}${questionBit}.`;
};

// A 2-3 sentence, data-grounded "portrait" — no invented biography, just a
// read of the measured pace/clarity/questioning signals plus the topics the
// person actually keeps returning to.
export const derivePortrait = (
  words: WordAnalysis,
  topics: string[],
): string => {
  const paceDescriptor =
    words.avgSentenceLength > 22
      ? "expansive"
      : words.avgSentenceLength > 0 && words.avgSentenceLength < 8
        ? "direct"
        : "measured";
  const topicsBit =
    topics.length > 0
      ? ` who keeps returning to ${topics.slice(0, 3).join(", ")}`
      : "";
  const fillerBit =
    words.fillerRate <= 2
      ? "You speak with unusual clarity, rarely reaching for filler words."
      : words.fillerRate >= 6
        ? "You speak loosely and conversationally, thinking out loud as you go."
        : "You speak in a steady, natural rhythm.";
  const questionBit =
    words.questionRatio >= 20
      ? " You ask a lot of questions along the way — curiosity shows up in how you talk, not just what you say."
      : "";
  return `You're a ${paceDescriptor} communicator${topicsBit}. ${fillerBit}${questionBit}`;
};

// Personality traits derived only from measurable speech signals — no
// fabricated psychology, just what the numbers actually support.
export const derivePersonality = (words: WordAnalysis): string[] => {
  const traits: string[] = [];
  if (words.fillerRate <= 2) traits.push("Articulate");
  if (words.questionRatio >= 20) traits.push("Inquisitive");
  if (words.avgSentenceLength > 22) {
    traits.push("Expansive");
  } else if (words.avgSentenceLength > 0 && words.avgSentenceLength < 8) {
    traits.push("Direct");
  }
  if (words.vocabularySize >= 600) traits.push("Wide-ranging thinker");
  if (traits.length === 0 && words.avgSentenceLength > 0) {
    traits.push("Steady and consistent");
  }
  return traits.slice(0, 4);
};

// Modest, topic-grounded motivations — what someone talks about repeatedly is
// the best offline signal we have for what drives them.
export const deriveMotivations = (topics: string[]): string[] =>
  topics
    .slice(0, 3)
    .map((topic) => `Building and moving things forward on ${topic}`);

// Picks the single strongest measured stat and phrases it as the person's
// standout communication trait.
export const deriveCommunicationSuperpower = (
  words: WordAnalysis,
): string | undefined => {
  const candidates: { score: number; text: string }[] = [];
  if (words.fillerRate <= 2) {
    candidates.push({
      score: (3 - words.fillerRate) * 10,
      text: `Clarity — you speak with almost no filler words (~${words.fillerRate} per 100), so your point lands clean.`,
    });
  }
  if (words.avgSentenceLength >= 6 && words.avgSentenceLength <= 20) {
    candidates.push({
      score: 15,
      text: `Pacing — your sentences (~${words.avgSentenceLength} words) are easy to follow without losing depth.`,
    });
  }
  if (words.vocabularySize >= 500) {
    candidates.push({
      score: words.vocabularySize / 50,
      text: `Range — a vocabulary of ${words.vocabularySize.toLocaleString()} distinct words gives you precise language for nuance.`,
    });
  }
  if (words.questionRatio >= 20) {
    candidates.push({
      score: words.questionRatio,
      text: `Curiosity — ${words.questionRatio}% of what you say is framed as a question, drawing others into the conversation.`,
    });
  }
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].text;
};

// Kind, honest read of weak stats — every line is anchored to a real number,
// never a vague personality judgment.
export const deriveBlindSpots = (words: WordAnalysis): string[] => {
  const spots: string[] = [];
  if (words.fillerRate >= 6) {
    spots.push(
      `Filler words creep in fairly often (~${words.fillerRate} per 100) — they can dilute a strong point.`,
    );
  }
  if (words.avgSentenceLength > 26) {
    spots.push(
      `Sentences can run long (~${words.avgSentenceLength} words), which sometimes buries the headline.`,
    );
  }
  if (words.questionRatio >= 35) {
    spots.push(
      `A lot of your phrasing comes out as questions (${words.questionRatio}%) — it can read as less certain than you actually are.`,
    );
  }
  if (words.vocabularySize > 0 && words.vocabularySize < 150) {
    spots.push(
      "Vocabulary is still narrow in the sample so far — it may read as repetitive until there's more data.",
    );
  }
  return spots.slice(0, 3);
};

// A short, grounded read on how the measured pace/clarity likely comes
// across to a listener. Returns undefined when there's no real signal yet.
export const deriveHowOthersExperienceYou = (
  words: WordAnalysis,
): string | undefined => {
  if (words.avgSentenceLength === 0) return undefined;
  const tone =
    words.fillerRate <= 2
      ? "composed and deliberate"
      : words.fillerRate >= 6
        ? "casual and unfiltered"
        : "relaxed but clear";
  const pacing =
    words.avgSentenceLength > 22
      ? "with a lot of context and detail"
      : words.avgSentenceLength < 8
        ? "in short, punchy bursts"
        : "at an easy, conversational pace";
  return `People likely experience you as ${tone}, speaking ${pacing}.`;
};

// Recurring cognitive/thinking patterns, inferred from question-asking,
// sentence structure, and topic persistence. Returns an empty list rather
// than inventing patterns when there's no real signal.
export const deriveMindsetPatterns = (
  words: WordAnalysis,
  topics: string[],
): string[] => {
  const patterns: string[] = [];
  if (words.questionRatio >= 20) {
    patterns.push(
      "You think out loud by questioning — testing ideas as you speak them.",
    );
  }
  if (words.avgSentenceLength > 22) {
    patterns.push(
      "You build ideas layer by layer instead of stating the conclusion upfront.",
    );
  }
  if (topics.length >= 3) {
    patterns.push(
      `You circle back to a consistent set of themes — ${topics.slice(0, 3).join(", ")} — across sessions.`,
    );
  }
  return patterns.slice(0, 3);
};

// Compute-backed fallback profile: derives real topics, quirks, and a
// "how you speak" read purely from the measured data, so the deep sections of
// the profile aren't empty when the LLM is unavailable or liteMode is on.
export const templatedProfile = (
  base: VoiceProfile,
  transcriptions: Transcription[],
  words?: WordAnalysis,
): AiVoiceProfile => {
  const analysis = words ?? computeWordAnalysis(transcriptions);
  const topics = deriveTopics(transcriptions);
  const personality = derivePersonality(analysis);
  const motivations = deriveMotivations(topics);
  const blindSpots = deriveBlindSpots(analysis);
  const mindsetPatterns = deriveMindsetPatterns(analysis, topics);
  return {
    name: base.name,
    identity: base.description,
    traits: [],
    topics,
    style: "",
    quirks: deriveQuirks(analysis),
    howYouSpeak: deriveHowYouSpeak(analysis, base),
    whatYouCareAbout: deriveWhatYouCareAbout(transcriptions),
    ubiquitousLanguage: deriveUbiquitousLanguage(transcriptions),
    portrait: derivePortrait(analysis, topics),
    personality: personality.length > 0 ? personality : undefined,
    motivations: motivations.length > 0 ? motivations : undefined,
    communicationSuperpower: deriveCommunicationSuperpower(analysis),
    blindSpots: blindSpots.length > 0 ? blindSpots : undefined,
    howOthersExperienceYou: deriveHowOthersExperienceYou(analysis),
    mindsetPatterns: mindsetPatterns.length > 0 ? mindsetPatterns : undefined,
    coaching: templatedCoaching(analysis),
    generated: false,
  };
};

// A grounded, offline coaching fallback derived purely from the measured stats,
// so the Coaching card still says something honest and specific when the LLM is
// unavailable. Every line is anchored to a real number.
export const templatedCoaching = (
  words: WordAnalysis,
): AiVoiceProfile["coaching"] => {
  const strengths: string[] = [];
  const growthAreas: string[] = [];
  const suggestions: string[] = [];

  if (words.fillerRate <= 3) {
    strengths.push(
      `Low filler rate — about ${words.fillerRate} filler words per 100, so you sound deliberate.`,
    );
  } else if (words.fillerRate >= 6) {
    growthAreas.push(
      `Filler words are frequent (~${words.fillerRate} per 100). Trimming "um", "like" and "basically" would sharpen you up.`,
    );
    suggestions.push(
      "Pause silently instead of filling gaps — a beat of quiet reads as confidence.",
    );
  }

  if (words.avgSentenceLength >= 6 && words.avgSentenceLength <= 20) {
    strengths.push(
      `Well-balanced sentences (~${words.avgSentenceLength} words) that are easy to follow.`,
    );
  } else if (words.avgSentenceLength > 24) {
    growthAreas.push(
      `Sentences run long (~${words.avgSentenceLength} words on average), which can bury your point.`,
    );
    suggestions.push(
      "Break long thoughts into two shorter sentences — say the point, then the reason.",
    );
  } else if (words.avgSentenceLength > 0 && words.avgSentenceLength < 6) {
    growthAreas.push(
      `Sentences are very short (~${words.avgSentenceLength} words) — adding a little connective tissue can help them flow.`,
    );
  }

  if (words.vocabularySize >= 400) {
    strengths.push(
      `Rich vocabulary — ${words.vocabularySize} distinct words across your dictations.`,
    );
  }

  if (words.questionRatio >= 30) {
    growthAreas.push(
      `A lot of what you say is phrased as questions (${words.questionRatio}%). Stating things directly can land with more authority.`,
    );
  }

  if (suggestions.length === 0) {
    suggestions.push(
      "Keep going — re-run this after more dictation for a sharper read on your speaking.",
    );
  }

  return { strengths, growthAreas, suggestions };
};

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

export type RecentDictationsSummary = {
  count: number;
  words: WordAnalysis;
};

// An aggregate "review across your recent dictations" — computed entirely
// from local stats over the last N transcripts, no LLM call needed. Used to
// complement the one-shot per-transcript review with a rolling read.
export const computeRecentDictationsSummary = (
  transcriptions: Transcription[],
  n = 20,
): RecentDictationsSummary | null => {
  const recent = activeTranscriptions(transcriptions)
    .slice()
    .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
    .slice(0, n);
  if (recent.length === 0) return null;
  return { count: recent.length, words: computeWordAnalysis(recent) };
};

// A trend item: a grounded, numbers-backed observation plus whether it's
// good news ("positive") or worth attention ("negative").
export type CoachingTrendItem = {
  text: string;
  direction: "positive" | "negative";
};

export type CoachingTrend = {
  fillerRateDeltaPct: number | null;
  avgSentenceLengthDeltaPct: number | null;
  vocabularySizeDeltaPct: number | null;
  questionRatioDeltaPct: number | null;
  wpmDeltaPct: number | null;
  fillerPoints: TrendPoint[];
  summary: CoachingTrendItem[];
};

// Turns the persisted per-generation stat snapshots (see StoredVoiceProfile)
// into a "did I improve?" trend: real deltas grounded in the measured numbers,
// not vibes. Requires at least two generations with recorded stats.
export const computeCoachingTrend = (
  history: StoredVoiceProfile[],
): CoachingTrend | null => {
  const withStats = history
    .filter(
      (h): h is StoredVoiceProfile & { stats: CoachingSnapshot } => !!h.stats,
    )
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt);
  if (withStats.length < 2) return null;

  const first = withStats[0].stats;
  const last = withStats[withStats.length - 1].stats;

  const pctDelta = (a: number, b: number): number | null =>
    a === 0 ? null : Math.round(((b - a) / a) * 1000) / 10;

  const fillerRateDeltaPct = pctDelta(first.fillerRate, last.fillerRate);
  const avgSentenceLengthDeltaPct = pctDelta(
    first.avgSentenceLength,
    last.avgSentenceLength,
  );
  const vocabularySizeDeltaPct = pctDelta(
    first.vocabularySize,
    last.vocabularySize,
  );
  const questionRatioDeltaPct = pctDelta(
    first.questionRatio,
    last.questionRatio,
  );
  const wpmDeltaPct = pctDelta(first.wpm, last.wpm);

  const summary: CoachingTrendItem[] = [];
  if (fillerRateDeltaPct !== null) {
    if (fillerRateDeltaPct <= -10) {
      summary.push({
        text: `Filler words down ${Math.abs(fillerRateDeltaPct)}% since your first profile.`,
        direction: "positive",
      });
    } else if (fillerRateDeltaPct >= 10) {
      summary.push({
        text: `Filler words up ${fillerRateDeltaPct}% since your first profile — worth reining back in.`,
        direction: "negative",
      });
    }
  }
  if (avgSentenceLengthDeltaPct !== null) {
    const wasExtreme =
      first.avgSentenceLength > 24 ||
      (first.avgSentenceLength > 0 && first.avgSentenceLength < 6);
    const isBalanced =
      last.avgSentenceLength >= 6 && last.avgSentenceLength <= 20;
    if (wasExtreme && isBalanced) {
      summary.push({
        text: "Your sentences are getting clearer and more balanced.",
        direction: "positive",
      });
    } else if (avgSentenceLengthDeltaPct >= 30 && last.avgSentenceLength > 24) {
      summary.push({
        text: `Sentences are running ${avgSentenceLengthDeltaPct}% longer than when you started.`,
        direction: "negative",
      });
    }
  }
  if (vocabularySizeDeltaPct !== null && vocabularySizeDeltaPct >= 10) {
    summary.push({
      text: `Vocabulary is up ${vocabularySizeDeltaPct}% — you're drawing on more words.`,
      direction: "positive",
    });
  }
  if (
    questionRatioDeltaPct !== null &&
    last.questionRatio >= 30 &&
    questionRatioDeltaPct >= 20
  ) {
    summary.push({
      text: `You're phrasing more as questions (${last.questionRatio}% of sentences) — stating things directly can land with more authority.`,
      direction: "negative",
    });
  }
  if (wpmDeltaPct !== null && wpmDeltaPct >= 10 && last.wpm > 0) {
    summary.push({
      text: `Speaking pace is up ${wpmDeltaPct}% since your first profile.`,
      direction: "positive",
    });
  }

  const fillerPoints: TrendPoint[] = withStats.map((h) => ({
    label: dayjs(h.createdAt).format("MMM D"),
    value: h.stats.fillerRate,
  }));

  return {
    fillerRateDeltaPct,
    avgSentenceLengthDeltaPct,
    vocabularySizeDeltaPct,
    questionRatioDeltaPct,
    wpmDeltaPct,
    fillerPoints,
    summary,
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

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

export type Achievement = {
  key: string;
  label: string;
  description: string;
  unlocked: boolean;
  progress: number;
  // Optional for backward compatibility with any consumer that doesn't set
  // them; render code should default to "bronze" / a generic trophy emoji.
  tier?: AchievementTier;
  emoji?: string;
};

// Cheap script-range detection (not real language ID) used only as a fun
// "Polyglot" signal — presence of non-Latin scripts alongside Latin text.
const SCRIPT_PATTERNS: RegExp[] = [
  /[Ѐ-ӿ]/, // Cyrillic
  /[一-鿿぀-ヿ가-힯]/, // CJK / Kana / Hangul
  /[؀-ۿ]/, // Arabic
  /[ऀ-ॿ]/, // Devanagari
  /[Ͱ-Ͽ]/, // Greek
  /[֐-׿]/, // Hebrew
];

const countScripts = (text: string): number =>
  1 + SCRIPT_PATTERNS.filter((re) => re.test(text)).length;

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

  let nightWords = 0;
  let earlyWords = 0;
  let weekendWords = 0;
  let marathon = 0;
  let allText = "";
  for (const t of active) {
    const d = dayjs(t.createdAt);
    const h = d.hour();
    const w = transcriptWords(t);
    if (h < 5) nightWords += w;
    if (h >= 5 && h < 8) earlyWords += w;
    if (d.day() === 0 || d.day() === 6) weekendWords += w;
    if (w > marathon) marathon = w;
    allText += ` ${t.transcript}`;
  }
  const activeDays = byDay.size;
  const vocab = computeWordAnalysis(transcriptions).vocabularySize;
  const scripts = countScripts(allText);

  const goal = (
    key: string,
    label: string,
    description: string,
    value: number,
    target: number,
    tier: AchievementTier = "bronze",
    emoji = "🏆",
  ): Achievement => ({
    key,
    label,
    description,
    unlocked: value >= target,
    progress: Math.max(0, Math.min(1, value / target)),
    tier,
    emoji,
  });

  return [
    goal(
      "w1k",
      "First 1,000",
      "Dictate 1,000 words",
      usage.totalWords,
      1000,
      "bronze",
      "🌱",
    ),
    goal(
      "w10k",
      "First 10k",
      "Reach your first 10,000-word milestone",
      usage.totalWords,
      10000,
      "bronze",
      "📈",
    ),
    goal(
      "w25k",
      "25k club",
      "Dictate 25,000 words",
      usage.totalWords,
      25000,
      "silver",
      "🚀",
    ),
    goal(
      "w50k",
      "Half a novel",
      "Dictate 50,000 words",
      usage.totalWords,
      50000,
      "silver",
      "📗",
    ),
    goal(
      "novel",
      "Novelist",
      "Dictate a full novel (90,000 words)",
      usage.totalWords,
      AVG_NOVEL_WORDS,
      "gold",
      "📚",
    ),
    goal(
      "w100k",
      "Six figures",
      "Dictate 100,000 words",
      usage.totalWords,
      100000,
      "gold",
      "💯",
    ),
    goal(
      "w250k",
      "Quarter million",
      "Dictate 250,000 words",
      usage.totalWords,
      250000,
      "platinum",
      "💎",
    ),
    goal(
      "s3",
      "Getting started",
      "Dictate 3 days in a row",
      usage.longestStreak,
      3,
      "bronze",
      "🔥",
    ),
    goal(
      "s7",
      "Week streak",
      "Dictate 7 days in a row",
      usage.longestStreak,
      7,
      "bronze",
      "🔥",
    ),
    goal(
      "s30",
      "Monthly habit",
      "30-day streak",
      usage.longestStreak,
      30,
      "silver",
      "🗓️",
    ),
    goal(
      "s100",
      "Century",
      "100-day streak",
      usage.longestStreak,
      100,
      "gold",
      "🏆",
    ),
    goal(
      "s365",
      "Unstoppable",
      "365-day streak",
      usage.longestStreak,
      365,
      "platinum",
      "👑",
    ),
    goal(
      "bigday",
      "Big day",
      "1,000 words in a single day",
      mostInDay,
      1000,
      "bronze",
      "☀️",
    ),
    goal(
      "monsterday",
      "Monster day",
      "5,000 words in a single day",
      mostInDay,
      5000,
      "gold",
      "🌋",
    ),
    goal(
      "night",
      "Night owl",
      "Dictate 500 words after midnight",
      nightWords,
      500,
      "bronze",
      "🦉",
    ),
    goal(
      "early",
      "Early bird",
      "Dictate 500 words before 8am",
      earlyWords,
      500,
      "bronze",
      "🐦",
    ),
    goal(
      "weekend",
      "Weekend warrior",
      "Dictate 2,000 words on weekends",
      weekendWords,
      2000,
      "bronze",
      "🎉",
    ),
    goal(
      "marathon",
      "Marathon",
      "300 words in a single dictation",
      marathon,
      300,
      "bronze",
      "🏃",
    ),
    goal(
      "ultramarathon",
      "Ultramarathon",
      "1,000 words in a single dictation",
      marathon,
      1000,
      "silver",
      "🏔️",
    ),
    goal(
      "regular",
      "Regular",
      "Dictate on 30 different days",
      activeDays,
      30,
      "silver",
      "📅",
    ),
    goal(
      "centuryDays",
      "Century of days",
      "Dictate on 100 different days",
      activeDays,
      100,
      "gold",
      "🗓️",
    ),
    goal(
      "fullYear",
      "Full year",
      "Dictate on 365 different days",
      activeDays,
      365,
      "platinum",
      "🎊",
    ),
    goal(
      "wordCollector",
      "Word collector",
      "Use 500 distinct words",
      vocab,
      500,
      "bronze",
      "🧩",
    ),
    goal(
      "wordsmith",
      "Wordsmith",
      "Use 2,000 distinct words",
      vocab,
      2000,
      "silver",
      "📖",
    ),
    goal(
      "logophile",
      "Logophile",
      "Use 5,000 distinct words",
      vocab,
      5000,
      "gold",
      "🎓",
    ),
    goal(
      "speedster",
      "Speed demon",
      "Average 160+ words per minute",
      usage.wpm,
      160,
      "silver",
      "⚡",
    ),
    goal(
      "monthlyGrind",
      "Monthly grind",
      "Dictate 5,000 words this month",
      usage.wordsThisMonth,
      5000,
      "silver",
      "📆",
    ),
    goal(
      "polyglot",
      "Polyglot",
      "Dictate in more than one script or language",
      scripts,
      2,
      "gold",
      "🌍",
    ),
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

// ---------------------------------------------------------------------------
// Deeper "Your usage" analysis: rhythm/consistency, session shape, week over
// week momentum, editing efficiency, and richer milestone projections. These
// are additive read-only views over events/transcriptions and don't change
// any of the stats consumed by the coaching/profile side of insights.
// ---------------------------------------------------------------------------

export type Chronotype = "morning" | "afternoon" | "evening" | "night";

export type Rhythm = {
  /** Words dictated per weekday, index 0 = Sunday .. 6 = Saturday. */
  weekdayBars: number[];
  /** Words dictated per hour of day, index 0-23. */
  hourBars: number[];
  peakWeekdayLabel: string | null;
  peakHourLabel: string | null;
  chronotype: Chronotype | null;
  /** 0-100: how evenly spread out (vs. bursty) your dictation habit is. */
  consistencyScore: number;
};

export const computeRhythm = (transcriptions: Transcription[]): Rhythm => {
  const active = activeTranscriptions(transcriptions);
  const weekdayBars = Array.from({ length: 7 }, () => 0);
  const hourBars = Array.from({ length: 24 }, () => 0);
  const byDay = new Map<string, number>();

  for (const t of active) {
    const d = dayjs(t.createdAt);
    const words = transcriptWords(t);
    weekdayBars[d.day()] += words;
    hourBars[d.hour()] += words;
    const key = d.format("YYYY-MM-DD");
    byDay.set(key, (byDay.get(key) ?? 0) + words);
  }

  const hasActivity = active.length > 0;
  const peakWeekdayIdx = weekdayBars.reduce(
    (best, v, i) => (v > weekdayBars[best] ? i : best),
    0,
  );
  const peakHourIdx = hourBars.reduce(
    (best, v, i) => (v > hourBars[best] ? i : best),
    0,
  );
  const peakWeekdayLabel = hasActivity ? WEEKDAYS[peakWeekdayIdx] : null;
  const peakHourLabel = hasActivity ? hourLabel(peakHourIdx) : null;

  let chronotype: Chronotype | null = null;
  if (hasActivity) {
    if (peakHourIdx >= 5 && peakHourIdx < 12) chronotype = "morning";
    else if (peakHourIdx >= 12 && peakHourIdx < 17) chronotype = "afternoon";
    else if (peakHourIdx >= 17 && peakHourIdx < 22) chronotype = "evening";
    else chronotype = "night";
  }

  // Consistency blends two signals over a rolling window (capped to how long
  // the user has actually been dictating): how many days they show up
  // (spread) and how even their daily output is when they do (evenness).
  const WINDOW_DAYS = 60;
  let firstDay: dayjs.Dayjs | null = null;
  for (const t of active) {
    const d = dayjs(t.createdAt);
    if (!firstDay || d.isBefore(firstDay)) firstDay = d;
  }
  const cutoff = dayjs()
    .subtract(WINDOW_DAYS - 1, "day")
    .startOf("day");
  const windowStart =
    firstDay && firstDay.isAfter(cutoff) ? firstDay.startOf("day") : cutoff;
  const windowDays = Math.max(1, dayjs().diff(windowStart, "day") + 1);

  const dailyCounts: number[] = [];
  for (let i = 0; i < windowDays; i++) {
    const key = windowStart.add(i, "day").format("YYYY-MM-DD");
    dailyCounts.push(byDay.get(key) ?? 0);
  }
  const activeDaysInWindow = dailyCounts.filter((v) => v > 0).length;
  const spread = activeDaysInWindow / windowDays;

  const activeCounts = dailyCounts.filter((v) => v > 0);
  let evenness = 0;
  if (activeCounts.length > 0) {
    const mean = activeCounts.reduce((a, b) => a + b, 0) / activeCounts.length;
    const variance =
      activeCounts.reduce((a, b) => a + (b - mean) ** 2, 0) /
      activeCounts.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    evenness = Math.max(0, 1 - Math.min(1, cv));
  }
  const consistencyScore = hasActivity
    ? Math.round(((spread + evenness) / 2) * 100)
    : 0;

  return {
    weekdayBars,
    hourBars,
    peakWeekdayLabel,
    peakHourLabel,
    chronotype,
    consistencyScore,
  };
};

export type SessionStats = {
  avgWordsPerSession: number;
  medianWordsPerSession: number;
  longestSessionWords: number;
  longestSessionDate: string | null;
  sessionsPerActiveDay: number;
  wordsPerSessionWeekly: TrendPoint[];
};

export const computeSessionStats = (
  transcriptions: Transcription[],
): SessionStats => {
  const active = activeTranscriptions(transcriptions);
  if (active.length === 0) {
    return {
      avgWordsPerSession: 0,
      medianWordsPerSession: 0,
      longestSessionWords: 0,
      longestSessionDate: null,
      sessionsPerActiveDay: 0,
      wordsPerSessionWeekly: [],
    };
  }

  const wordCounts = active.map(transcriptWords);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  const avgWordsPerSession = Math.round(totalWords / active.length);

  const sorted = [...wordCounts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianWordsPerSession =
    sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];

  let longestSessionWords = 0;
  let longestSessionDate: string | null = null;
  const activeDays = new Set<string>();
  for (const t of active) {
    const words = transcriptWords(t);
    activeDays.add(dayjs(t.createdAt).format("YYYY-MM-DD"));
    if (words > longestSessionWords) {
      longestSessionWords = words;
      longestSessionDate = dayjs(t.createdAt).format("YYYY-MM-DD");
    }
  }
  const sessionsPerActiveDay =
    activeDays.size > 0
      ? Math.round((active.length / activeDays.size) * 10) / 10
      : 0;

  const WEEKS = 8;
  const now = dayjs();
  const wordsPerSessionWeekly: TrendPoint[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = now.subtract(i, "week").startOf("week");
    const end = start.add(1, "week");
    let words = 0;
    let count = 0;
    for (const t of active) {
      const d = dayjs(t.createdAt);
      if (d.isBefore(start) || !d.isBefore(end)) continue;
      words += transcriptWords(t);
      count += 1;
    }
    wordsPerSessionWeekly.push({
      label: start.format("MMM D"),
      value: count > 0 ? Math.round(words / count) : 0,
    });
  }

  return {
    avgWordsPerSession,
    medianWordsPerSession,
    longestSessionWords,
    longestSessionDate,
    sessionsPerActiveDay,
    wordsPerSessionWeekly,
  };
};

export type WeekComparison = {
  wordsThisWeek: number;
  wordsLastWeek: number;
  /** null when there's no prior week to compare against. */
  wordsDeltaPct: number | null;
  wpmThisWeek: number;
  wpmLastWeek: number;
  wpmDeltaPct: number | null;
  activeDaysThisWeek: number;
  activeDaysLastWeek: number;
  activeDaysDelta: number;
  personalBestWeekWords: number;
  /** This week's words as a % of your all-time best week. */
  paceVsBestWeekPct: number | null;
};

export const computeWeekComparison = (
  transcriptions: Transcription[],
): WeekComparison => {
  const active = activeTranscriptions(transcriptions);
  const thisWeekStart = dayjs().startOf("week");
  const lastWeekStart = thisWeekStart.subtract(1, "week");

  let wordsThisWeek = 0;
  let msThisWeek = 0;
  let wordsLastWeek = 0;
  let msLastWeek = 0;
  const daysThisWeek = new Set<string>();
  const daysLastWeek = new Set<string>();
  const weekTotals = new Map<string, number>();

  for (const t of active) {
    const d = dayjs(t.createdAt);
    const words = transcriptWords(t);
    const weekKey = d.startOf("week").format("YYYY-MM-DD");
    weekTotals.set(weekKey, (weekTotals.get(weekKey) ?? 0) + words);

    if (!d.isBefore(thisWeekStart)) {
      wordsThisWeek += words;
      msThisWeek += audioMs(t);
      daysThisWeek.add(d.format("YYYY-MM-DD"));
    } else if (!d.isBefore(lastWeekStart)) {
      wordsLastWeek += words;
      msLastWeek += audioMs(t);
      daysLastWeek.add(d.format("YYYY-MM-DD"));
    }
  }

  const minsThisWeek = msThisWeek / 60000;
  const minsLastWeek = msLastWeek / 60000;
  const wpmThisWeek =
    minsThisWeek > 0 ? Math.round(wordsThisWeek / minsThisWeek) : 0;
  const wpmLastWeek =
    minsLastWeek > 0 ? Math.round(wordsLastWeek / minsLastWeek) : 0;

  const wordsDeltaPct =
    wordsLastWeek > 0
      ? Math.round(((wordsThisWeek - wordsLastWeek) / wordsLastWeek) * 100)
      : null;
  const wpmDeltaPct =
    wpmLastWeek > 0
      ? Math.round(((wpmThisWeek - wpmLastWeek) / wpmLastWeek) * 100)
      : null;

  const personalBestWeekWords = Math.max(0, ...Array.from(weekTotals.values()));
  const paceVsBestWeekPct =
    personalBestWeekWords > 0
      ? Math.round((wordsThisWeek / personalBestWeekWords) * 100)
      : null;

  return {
    wordsThisWeek,
    wordsLastWeek,
    wordsDeltaPct,
    wpmThisWeek,
    wpmLastWeek,
    wpmDeltaPct,
    activeDaysThisWeek: daysThisWeek.size,
    activeDaysLastWeek: daysLastWeek.size,
    activeDaysDelta: daysThisWeek.size - daysLastWeek.size,
    personalBestWeekWords,
    paceVsBestWeekPct,
  };
};

export type Efficiency = {
  /** Corrections per 100 words, one point per week. */
  correctionRateWeekly: TrendPoint[];
  /** Negative = fewer corrections needed than last week (improving). */
  correctionRateDeltaPct: number | null;
  verbatimWords: number;
  polishedWords: number;
  /** 0-100 share of words dictated with post-processing off (verbatim). */
  verbatimPct: number;
  /** Words transcribed per second of processing time, one point per week. */
  speedWeekly: TrendPoint[];
};

export const computeEfficiency = (
  events: LocalDictationEvent[],
  transcriptions: Transcription[],
): Efficiency => {
  const WEEKS = 8;
  const now = dayjs();
  const correctionRateWeekly: TrendPoint[] = [];
  const speedWeekly: TrendPoint[] = [];

  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = now.subtract(i, "week").startOf("week");
    const end = start.add(1, "week");
    let words = 0;
    let corrections = 0;
    let speedWords = 0;
    let speedMs = 0;
    for (const e of events) {
      const d = dayjs(e.timestamp);
      if (d.isBefore(start) || !d.isBefore(end)) continue;
      words += e.wordCount;
      corrections += e.correctionCount;
      if (e.transcriptionDurationMs && e.transcriptionDurationMs > 0) {
        speedWords += e.wordCount;
        speedMs += e.transcriptionDurationMs;
      }
    }
    const label = start.format("MMM D");
    correctionRateWeekly.push({
      label,
      value: words > 0 ? Math.round((corrections / words) * 1000) / 10 : 0,
    });
    speedWeekly.push({
      label,
      value:
        speedMs > 0 ? Math.round((speedWords / (speedMs / 1000)) * 10) / 10 : 0,
    });
  }

  const lastRate =
    correctionRateWeekly[correctionRateWeekly.length - 1]?.value ?? 0;
  const prevRate =
    correctionRateWeekly[correctionRateWeekly.length - 2]?.value ?? 0;
  const correctionRateDeltaPct =
    prevRate > 0 ? Math.round(((lastRate - prevRate) / prevRate) * 100) : null;

  let verbatimWords = 0;
  let polishedWords = 0;
  for (const t of activeTranscriptions(transcriptions)) {
    const words = transcriptWords(t);
    if (t.postProcessMode && t.postProcessMode !== "none") {
      polishedWords += words;
    } else {
      verbatimWords += words;
    }
  }
  const splitWords = verbatimWords + polishedWords;
  const verbatimPct =
    splitWords > 0 ? Math.round((verbatimWords / splitWords) * 100) : 0;

  return {
    correctionRateWeekly,
    correctionRateDeltaPct,
    verbatimWords,
    polishedWords,
    verbatimPct,
    speedWeekly,
  };
};

// Human-readable label for the raw inference device string ("gpu:0" -> "GPU",
// "cpu" -> "CPU"). Returns null rather than guessing for anything unrecognized.
const deviceLabel = (device: string): string | null => {
  const lower = device.toLowerCase();
  if (lower.startsWith("gpu")) return "GPU";
  if (lower === "cpu") return "CPU";
  return null;
};

export type TranscriptionPerformance = {
  /** How many transcriptions had real audio+processing timing to measure. */
  sampleSize: number;
  /** Average of (audio duration / transcription duration) — "Nx real-time". */
  realtimeFactor: number;
  /** Average words transcribed per second of processing time (from events). */
  wordsPerSecond: number;
  avgTranscribeMs: number;
  fastestTranscribeMs: number;
  /** Average post-processing (AI polish) time in ms, when any is recorded. */
  avgPostprocessMs: number | null;
  /** Human label for the most recently used device, e.g. "GPU". */
  activeDevice: string | null;
  /** Most recently used model size/name, e.g. "large-v3-turbo". */
  activeModel: string | null;
  /** Recent transcription-time trend (oldest to newest), for a MiniLine. */
  speedTrend: TrendPoint[];
};

// Real, measured transcription speed + the active local device/model — no
// fabricated numbers. Rows without both a real audio duration and a real
// transcription duration (common on older data) are excluded entirely.
export const computeTranscriptionPerformance = (
  transcriptions: Transcription[],
  events: LocalDictationEvent[],
): TranscriptionPerformance => {
  const timed = activeTranscriptions(transcriptions)
    .filter(
      (t) =>
        (t.audio?.durationMs ?? 0) > 0 && (t.transcriptionDurationMs ?? 0) > 0,
    )
    .sort(
      (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
    );

  const sampleSize = timed.length;

  let realtimeSum = 0;
  let transcribeMsSum = 0;
  let fastestTranscribeMs = Infinity;
  for (const t of timed) {
    const audioDurationMs = t.audio?.durationMs ?? 0;
    const transcriptionDurationMs = t.transcriptionDurationMs ?? 0;
    realtimeSum += audioDurationMs / transcriptionDurationMs;
    transcribeMsSum += transcriptionDurationMs;
    fastestTranscribeMs = Math.min(
      fastestTranscribeMs,
      transcriptionDurationMs,
    );
  }

  const realtimeFactor =
    sampleSize > 0 ? Math.round((realtimeSum / sampleSize) * 10) / 10 : 0;
  const avgTranscribeMs =
    sampleSize > 0 ? Math.round(transcribeMsSum / sampleSize) : 0;

  let wpsSum = 0;
  let wpsCount = 0;
  for (const e of events) {
    if (
      e.wordCount > 0 &&
      e.transcriptionDurationMs &&
      e.transcriptionDurationMs > 0
    ) {
      wpsSum += e.wordCount / (e.transcriptionDurationMs / 1000);
      wpsCount += 1;
    }
  }
  const wordsPerSecond =
    wpsCount > 0 ? Math.round((wpsSum / wpsCount) * 10) / 10 : 0;

  let postprocessSum = 0;
  let postprocessCount = 0;
  for (const e of events) {
    if (e.postprocessDurationMs && e.postprocessDurationMs > 0) {
      postprocessSum += e.postprocessDurationMs;
      postprocessCount += 1;
    }
  }
  const avgPostprocessMs =
    postprocessCount > 0 ? Math.round(postprocessSum / postprocessCount) : null;

  let activeDevice: string | null = null;
  let activeModel: string | null = null;
  for (let i = timed.length - 1; i >= 0; i -= 1) {
    const t = timed[i];
    if (!activeDevice && t.inferenceDevice) {
      activeDevice = deviceLabel(t.inferenceDevice);
    }
    if (!activeModel && t.modelSize) {
      activeModel = t.modelSize;
    }
    if (activeDevice && activeModel) break;
  }

  const BUCKETS = 8;
  const speedTrend: TrendPoint[] = [];
  if (sampleSize >= 2) {
    const bucketCount = Math.min(BUCKETS, sampleSize);
    const bucketSize = Math.ceil(sampleSize / bucketCount);
    for (let i = 0; i < sampleSize; i += bucketSize) {
      const chunk = timed.slice(i, i + bucketSize);
      const avgMs =
        chunk.reduce((sum, t) => sum + (t.transcriptionDurationMs ?? 0), 0) /
        chunk.length;
      speedTrend.push({
        label: dayjs(chunk[0].createdAt).format("MMM D"),
        value: Math.round(avgMs),
      });
    }
  }

  return {
    sampleSize,
    realtimeFactor,
    wordsPerSecond,
    avgTranscribeMs,
    fastestTranscribeMs: sampleSize > 0 ? fastestTranscribeMs : 0,
    avgPostprocessMs,
    activeDevice,
    activeModel,
    speedTrend,
  };
};

export const AVG_EMAIL_WORDS = 150;
export const AVG_TWEET_WORDS = 20;
export const AVG_PAGE_WORDS = 250;

export type WordComparisons = {
  emails: number;
  tweets: number;
  pages: number;
};

export const computeWordComparisons = (
  totalWords: number,
): WordComparisons => ({
  emails: Math.round(totalWords / AVG_EMAIL_WORDS),
  tweets: Math.round(totalWords / AVG_TWEET_WORDS),
  pages: Math.round(totalWords / AVG_PAGE_WORDS),
});

export type MilestoneOutlook = {
  nextMilestone: number | null;
  wordsRemaining: number | null;
  daysToNextMilestone: number | null;
  /** ISO date (YYYY-MM-DD) the next milestone is projected to land on. */
  projectedDate: string | null;
};

export const computeMilestoneOutlook = (
  events: LocalDictationEvent[],
  transcriptions: Transcription[],
): MilestoneOutlook => {
  const usage = computeUsage(events, transcriptions);
  const predictions = computePredictions(events, transcriptions);
  const wordsRemaining =
    predictions.nextMilestone !== null
      ? Math.max(0, predictions.nextMilestone - usage.totalWords)
      : null;
  const projectedDate =
    predictions.daysToNextMilestone !== null
      ? dayjs().add(predictions.daysToNextMilestone, "day").format("YYYY-MM-DD")
      : null;
  return {
    nextMilestone: predictions.nextMilestone,
    wordsRemaining,
    daysToNextMilestone: predictions.daysToNextMilestone,
    projectedDate,
  };
};
