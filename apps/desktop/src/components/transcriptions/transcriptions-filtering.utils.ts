import { Transcription } from "@voquill/types";
import dayjs from "dayjs";
import {
  QuickDateRange,
  TranscriptionModeFilter,
} from "./TranscriptionsToolbar";

export type TranscriptionFilters = {
  search: string;
  mode: TranscriptionModeFilter;
  range: QuickDateRange;
  favoritesOnly: boolean;
  flaggedOnly: boolean;
};

export const DEFAULT_TRANSCRIPTION_FILTERS: TranscriptionFilters = {
  search: "",
  mode: "all",
  range: "all",
  favoritesOnly: false,
  flaggedOnly: false,
};

export const hasActiveTranscriptionFilters = (
  filters: TranscriptionFilters,
): boolean =>
  filters.search.trim().length > 0 ||
  filters.mode !== "all" ||
  filters.range !== "all" ||
  filters.favoritesOnly ||
  filters.flaggedOnly;

const isFlagged = (transcription: Transcription): boolean =>
  Boolean(transcription.warnings && transcription.warnings.length > 0);

const isWithinRange = (
  createdAt: string,
  range: QuickDateRange,
  now: dayjs.Dayjs,
): boolean => {
  if (range === "all") return true;
  const created = dayjs(createdAt);
  if (!created.isValid()) return false;
  if (range === "today") return created.isSame(now, "day");
  if (range === "7d") return !created.isBefore(now.subtract(7, "day"), "day");
  return !created.isBefore(now.subtract(30, "day"), "day");
};

// Single predicate the page runs the loaded transcription set through: free
// text (transcript + raw transcript), quick date range, transcription mode,
// favorites-only and flagged-only. Kept pure/standalone so it's easy to unit
// test independent of the store and rendering.
export const matchesTranscriptionFilters = (
  transcription: Transcription,
  filters: TranscriptionFilters,
  favoriteIds: ReadonlySet<string>,
  now: dayjs.Dayjs = dayjs(),
): boolean => {
  const normalizedSearch = filters.search.trim().toLowerCase();
  if (normalizedSearch) {
    const haystack = `${transcription.transcript} ${
      transcription.rawTranscript ?? ""
    }`.toLowerCase();
    if (!haystack.includes(normalizedSearch)) return false;
  }

  if (
    filters.mode !== "all" &&
    transcription.transcriptionMode !== filters.mode
  ) {
    return false;
  }

  if (filters.favoritesOnly && !favoriteIds.has(transcription.id)) {
    return false;
  }

  if (filters.flaggedOnly && !isFlagged(transcription)) {
    return false;
  }

  if (!isWithinRange(transcription.createdAt, filters.range, now)) {
    return false;
  }

  return true;
};

export type DateGroupKind = "today" | "yesterday" | "date";

export const dateGroupKeyOf = (createdAt: string): string =>
  dayjs(createdAt).format("YYYY-MM-DD");

export const dateGroupKindOf = (
  dateKey: string,
  now: dayjs.Dayjs = dayjs(),
): DateGroupKind => {
  const day = dayjs(dateKey, "YYYY-MM-DD");
  if (day.isSame(now, "day")) return "today";
  if (day.isSame(now.subtract(1, "day"), "day")) return "yesterday";
  return "date";
};

// Groups an ordered list of transcription ids into "day" buckets, preserving
// the incoming order and only inserting a new header when the day actually
// changes — cheap (single pass) and stable even if callers pass an
// already-sorted-by-recency list, which is how History loads today.
export const groupTranscriptionIdsByDay = (
  ids: readonly string[],
  transcriptionById: Record<string, Transcription>,
): Array<{ dateKey: string; ids: string[] }> => {
  const groups: Array<{ dateKey: string; ids: string[] }> = [];
  let current: { dateKey: string; ids: string[] } | null = null;

  for (const id of ids) {
    const transcription = transcriptionById[id];
    if (!transcription) continue;
    const dateKey = dateGroupKeyOf(transcription.createdAt);
    if (!current || current.dateKey !== dateKey) {
      current = { dateKey, ids: [] };
      groups.push(current);
    }
    current.ids.push(id);
  }

  return groups;
};
