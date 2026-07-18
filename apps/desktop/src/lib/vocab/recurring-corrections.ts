import { Term, Transcription } from "@voquill/types";
import { loadDictionary } from "../../actions/dictionary.actions";
import { getTermRepo } from "../../repos";
import { createId } from "../../utils/id.utils";
import { learnTermsFromEdit } from "../insights/compute";

// How many times the same raw -> final correction has to recur across the
// user's history before it's worth a nudge. Low enough to catch real habits,
// high enough to stay quiet about one-off rephrases.
export const MIN_RECURRING_CORRECTION_COUNT = 3;

export type RecurringCorrection = {
  source: string;
  destination: string;
  count: number;
  // The single transcription the nudge should be attached to (its most
  // recent occurrence), so the same nudge doesn't repeat on every row.
  anchorTranscriptionId: string;
};

// Scans the loaded transcriptions for clean single-word raw -> final
// corrections (reusing the same LCS-based extractor the "learn on edit"
// flow already uses), counts how often each correction recurs across
// distinct dictations, and returns the ones that recur often enough and
// aren't already in the dictionary. History + Dictionary, tied together.
export const findRecurringCorrections = (
  transcriptions: Transcription[],
  terms: Term[],
  minCount: number = MIN_RECURRING_CORRECTION_COUNT,
): RecurringCorrection[] => {
  const existingSources = new Set(
    terms.map((term) => term.sourceValue.toLowerCase()),
  );

  // Newest first, so the anchor we pick for a recurring correction is the
  // most recent dictation it showed up in.
  const sorted = transcriptions
    .filter((t) => !t.isDeleted && t.rawTranscript)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const bySource = new Map<
    string,
    { source: string; destination: string; count: number; anchorId: string }
  >();

  for (const t of sorted) {
    const raw = t.rawTranscript ?? "";
    const final = t.transcript ?? "";
    if (!raw.trim() || raw.trim() === final.trim()) continue;

    const learned = learnTermsFromEdit(raw, final, existingSources);
    for (const { source, destination } of learned) {
      const key = source.toLowerCase();
      const entry = bySource.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        bySource.set(key, { source, destination, count: 1, anchorId: t.id });
      }
    }
  }

  return Array.from(bySource.values())
    .filter((entry) => entry.count >= minCount)
    .map((entry) => ({
      source: entry.source,
      destination: entry.destination,
      count: entry.count,
      anchorTranscriptionId: entry.anchorId,
    }))
    .sort((a, b) => b.count - a.count);
};

// Persists a recurring correction as a replacement term (misheard ->
// correct) and re-syncs the dictionary store, mirroring the auto-learn
// flow in `saveTranscriptionEdit`.
export const addRecurringCorrectionToDictionary = async (
  correction: Pick<RecurringCorrection, "source" | "destination">,
): Promise<void> => {
  await getTermRepo().createTerm({
    id: createId(),
    createdAt: new Date().toISOString(),
    sourceValue: correction.source,
    destinationValue: correction.destination,
    isReplacement: true,
  });
  await loadDictionary();
};
