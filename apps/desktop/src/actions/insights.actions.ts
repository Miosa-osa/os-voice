import {
  getGenerateTextRepo,
  getInsightsRepo,
  getTermRepo,
  getTranscriptionRepo,
} from "../repos";
import { LocalDictationEvent } from "../repos/insights.repo";
import {
  computeUsage,
  computeVoiceProfile,
  computeWordAnalysis,
  milestoneFor,
  PROFILE_UNLOCK_WORDS,
  sampleTranscripts,
  templatedProfile,
  WORD_ANALYSIS_UNLOCK_WORDS,
} from "../lib/insights/compute";
import {
  buildProfileSystemPrompt,
  buildProfileUserPrompt,
  parseProfileResponse,
} from "../lib/insights/profile-prompt";
import {
  AiVoiceProfile,
  StoredVoiceProfile,
} from "../lib/insights/profile.types";
import { getAppState, produceAppState } from "../store";
import { registerTerms, registerTranscriptions } from "../utils/app.utils";
import { createId } from "../utils/id.utils";
import { getLogger } from "../utils/log.utils";

export const loadInsights = async (): Promise<void> => {
  produceAppState((draft) => {
    draft.insights.status = "loading";
  });

  try {
    const [events, transcriptions, terms] = await Promise.all([
      getInsightsRepo().listEvents(),
      getTranscriptionRepo().listTranscriptions({ limit: 5000, offset: 0 }),
      getTermRepo().listTerms(),
    ]);

    produceAppState((draft) => {
      draft.insights.events = events;
      registerTranscriptions(draft, transcriptions);
      registerTerms(draft, terms);
      draft.insights.status = "success";
    });
  } catch (error) {
    getLogger().error(`Failed to load insights: ${error}`);
    produceAppState((draft) => {
      draft.insights.status = "error";
    });
  }
};

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

// Debounced refresh so the Insights dashboard updates live as the user dictates,
// without hammering the DB on every single event.
export const scheduleInsightsRefresh = (): void => {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void loadInsights();
  }, 1500);
};

export const generateVoiceProfile = async (opts?: {
  force?: boolean;
}): Promise<void> => {
  const state = getAppState();
  const events = state.insights.events;
  const transcriptions = Object.values(state.transcriptionById);
  const terms = Object.values(state.termById);
  const usage = computeUsage(events, transcriptions);
  if (usage.totalWords < PROFILE_UNLOCK_WORDS) return;
  const milestone = milestoneFor(usage.totalWords);
  const history = state.local.voiceProfiles ?? [];
  const latest = history.slice().sort((a, b) => b.createdAt - a.createdAt)[0];
  const existingForMilestone = history.find((p) => p.milestone === milestone);

  let shouldRegen = opts?.force === true;
  if (!shouldRegen) {
    if (!latest) {
      shouldRegen = true;
    } else if (milestone > latest.milestone) {
      shouldRegen = true;
    } else if (usage.totalWords < WORD_ANALYSIS_UNLOCK_WORDS) {
      const ageMs = Date.now() - latest.createdAt;
      const wordsSince = usage.totalWords - latest.totalWords;
      if (ageMs > 24 * 60 * 60 * 1000 || wordsSince >= 500) shouldRegen = true;
    }
  }

  if (!shouldRegen) {
    const cached = existingForMilestone?.profile ?? latest?.profile;
    if (cached) {
      produceAppState((draft) => {
        draft.insights.aiProfile = cached;
        draft.insights.aiProfileStatus = "success";
      });
    }
    return;
  }

  // Reentrancy guard: the live-refresh effect re-fires ~every 1.5s while
  // dictating, so bail if a generation is already in flight — otherwise
  // overlapping LLM calls can let a slower/staler response clobber a fresher one.
  if (!opts?.force && getAppState().insights.aiProfileStatus === "loading") {
    return;
  }

  produceAppState((draft) => {
    draft.insights.aiProfileStatus = "loading";
  });

  const base = computeVoiceProfile(events, transcriptions, terms, milestone);
  const words = computeWordAnalysis(transcriptions);
  const samples = sampleTranscripts(transcriptions);

  let profile: AiVoiceProfile;
  const liteMode = state.local.liteMode === true;
  try {
    if (liteMode) {
      // Lite mode skips the local LLM entirely to stay light on weak hardware.
      profile = templatedProfile(base);
    } else {
      const gen = getGenerateTextRepo();
      if (!gen.repo) throw new Error("no generation model configured");
      const output = await gen.repo.generateText({
        system: buildProfileSystemPrompt(),
        prompt: buildProfileUserPrompt({
          usage,
          profile: base,
          words,
          samples,
          previousIdentity: latest?.profile.identity ?? null,
        }),
      });
      profile = parseProfileResponse(output.text) ?? templatedProfile(base);
    }
  } catch (error) {
    getLogger().warning(
      `Voice profile generation fell back to template: ${error}`,
    );
    profile = templatedProfile(base);
  }

  const stored: StoredVoiceProfile = {
    milestone,
    createdAt: Date.now(),
    totalWords: usage.totalWords,
    profile,
    catchphrase: base.catchphrase,
    mostUsedWord: base.mostUsedWord,
  };

  produceAppState((draft) => {
    draft.insights.aiProfile = profile;
    draft.insights.aiProfileStatus = "success";
    const history = (draft.local.voiceProfiles ?? []).filter(
      (p) => p.milestone !== milestone,
    );
    history.push(stored);
    history.sort((a, b) => a.milestone - b.milestone);
    draft.local.voiceProfiles = history;
  });
};

export type RecordDictationEventInput = {
  wordCount: number;
  charCount: number;
  appName: string | null;
  appTargetId: string | null;
  toneId: string | null;
  correctionCount: number;
  transcriptionDurationMs: number | null;
  postprocessDurationMs: number | null;
};

export const recordDictationEvent = async (
  input: RecordDictationEventInput,
): Promise<void> => {
  try {
    const event: LocalDictationEvent = {
      id: createId(),
      timestamp: Date.now(),
      ...input,
    };
    await getInsightsRepo().recordEvent(event);
    produceAppState((draft) => {
      draft.insights.events = [event, ...draft.insights.events];
    });
    scheduleInsightsRefresh();
  } catch (error) {
    getLogger().error(`Failed to record dictation event: ${error}`);
  }
};
