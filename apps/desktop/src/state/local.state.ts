import { StoredVoiceProfile } from "../lib/insights/profile.types";
import { LearnedWord } from "./vocab.state";

export type LocalState = {
  assistantModeEnabled: boolean;
  powerModeEnabled: boolean;
  lastDictationReminderShownAt: number | null;
  lastDictatedAt: number | null;
  lastSeenTrialExtensionClaimedAt: string | null;
  featureSeenAt: string | null;
  disablePillRewards: boolean;
  accurateDictationEnabled?: boolean;
  hasHiddenTrialExtensionCard: boolean;
  disableAutoStyleLoading?: boolean;
  optInToBetaUpdates: boolean;
  voiceProfiles?: StoredVoiceProfile[];
  liteMode?: boolean;
  // Persistent intelligent dictionary: timestamped, categorized, defined words
  // OS Voice has learned, plus the words the user has explicitly dismissed.
  learnedVocab?: LearnedWord[];
  dismissedVocab?: string[];
};

export const INITIAL_LOCAL_STATE: LocalState = {
  assistantModeEnabled: false,
  powerModeEnabled: false,
  lastDictationReminderShownAt: null,
  lastDictatedAt: null,
  lastSeenTrialExtensionClaimedAt: null,
  featureSeenAt: null,
  disablePillRewards: false,
  accurateDictationEnabled: false,
  hasHiddenTrialExtensionCard: false,
  disableAutoStyleLoading: false,
  optInToBetaUpdates: false,
};
