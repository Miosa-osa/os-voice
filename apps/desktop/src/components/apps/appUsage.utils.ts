import { AppTarget } from "@voquill/types";
import { LocalDictationEvent } from "../../repos/insights.repo";
import { normalizeAppTargetId } from "../../utils/apptarget.utils";

export type AppUsageSummary = {
  /** App target id (matches `AppTarget.id` when the app is registered). */
  id: string;
  name: string;
  iconPath: string | null;
  toneId: string | null;
  totalWords: number;
  dictationCount: number;
  avgWordsPerDictation: number;
  /**
   * Whether this row has a real `AppTarget` record (registered the moment
   * the user first dictated into the app). Rows without one are built from
   * legacy dictation events that predate app-target registration and can't
   * be used to change a tone override, since there's nothing to upsert.
   */
  isRegistered: boolean;
};

/**
 * Aggregates raw dictation events per app and joins in the app's registered
 * name/icon/tone override from `appTargetById`. Only apps with at least one
 * recorded dictation are included, sorted by total words descending.
 */
export const computeAppUsageSummaries = (
  events: readonly LocalDictationEvent[],
  appTargetById: Readonly<Record<string, AppTarget>>,
): AppUsageSummary[] => {
  const totalsById = new Map<string, { words: number; count: number }>();

  for (const event of events) {
    const id =
      event.appTargetId ??
      (event.appName ? normalizeAppTargetId(event.appName) : null);
    if (!id) continue;

    const entry = totalsById.get(id) ?? { words: 0, count: 0 };
    entry.words += event.wordCount;
    entry.count += 1;
    totalsById.set(id, entry);
  }

  const summaries: AppUsageSummary[] = [];
  for (const [id, entry] of totalsById.entries()) {
    if (entry.count === 0) continue;

    const target = appTargetById[id];
    summaries.push({
      id,
      name: target?.name ?? id,
      iconPath: target?.iconPath ?? null,
      toneId: target?.toneId ?? null,
      totalWords: entry.words,
      dictationCount: entry.count,
      avgWordsPerDictation:
        entry.count > 0 ? Math.round(entry.words / entry.count) : 0,
      isRegistered: Boolean(target),
    });
  }

  return summaries.sort((a, b) => b.totalWords - a.totalWords);
};
