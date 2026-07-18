import { WordCategory } from "../lib/vocab/categorize";

// A single word/phrase OS Voice has learned the user actually uses, enriched
// over time with an LLM category + definition and the evidence behind it. Stored
// under `local` so timestamps, definitions and the dismissed set persist across
// restarts rather than being recomputed from scratch every launch.
export type LearnedWord = {
  word: string;
  category?: WordCategory;
  definition?: string;
  example: string;
  firstLearnedAt: number;
  timesHeard: number;
  // Epoch millis of the most recent time this word showed up in a transcript.
  // Undefined for words learned before this was tracked.
  lastHeardAt?: number;
  // True when this term is part of the user's characteristic "ubiquitous
  // language" as identified by the voice profile — surfaced as a distinct,
  // highlighted section in the dictionary.
  isUbiquitous?: boolean;
};

export type VocabState = {
  learnedWords: string[];
};

export const INITIAL_VOCAB_STATE: VocabState = {
  learnedWords: [],
};
