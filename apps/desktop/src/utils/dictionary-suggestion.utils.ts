import { Term } from "@voquill/types";

// Captures the word right after "I said"/"I meant", then greedily extends
// into a multi-word proper noun only while the following words are also
// capitalized (e.g. "Agency Miosa"), so it doesn't swallow the rest of the
// sentence when the correction is followed by ordinary lowercase words.
// Deliberately case-sensitive on "I" and the capitalized continuation so
// the [A-Z] check isn't neutralized by a case-insensitive flag.
const CORRECTION_PATTERN =
  /\bI\s+(?:said|meant)\s+["'“]?([A-Za-z][A-Za-z0-9'-]*)((?:\s+[A-Z][A-Za-z0-9'-]*){0,2})["'”]?(?=[.,!?]|\s|$)/g;

const IGNORED_TERMS = new Set([
  "yes",
  "no",
  "okay",
  "ok",
  "sure",
  "so",
  "that",
  "this",
  "it",
  "not",
  "maybe",
  "right",
  "wrong",
  "true",
  "false",
  "please",
  "sorry",
  "hello",
  "hi",
]);

/**
 * Scans a transcript for spoken self-corrections ("I said X", "I meant X")
 * and returns the corrected terms as dictionary candidates.
 */
export const detectDictionarySuggestions = (transcript: string): string[] => {
  if (!transcript) {
    return [];
  }

  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const match of transcript.matchAll(CORRECTION_PATTERN)) {
    const candidate = `${match[1] ?? ""}${match[2] ?? ""}`.trim();
    if (!candidate) {
      continue;
    }

    const normalized = candidate.toLowerCase();
    if (IGNORED_TERMS.has(normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    suggestions.push(candidate);
  }

  return suggestions;
};

/**
 * Filters out candidates that already exist as a dictionary term
 * (case-insensitive match on the term's source value).
 */
export const filterNewDictionarySuggestions = (
  candidates: string[],
  existingTerms: Term[],
): string[] => {
  const existingSourceValues = new Set(
    existingTerms.map((term) => term.sourceValue.trim().toLowerCase()),
  );

  return candidates.filter(
    (candidate) => !existingSourceValues.has(candidate.trim().toLowerCase()),
  );
};
