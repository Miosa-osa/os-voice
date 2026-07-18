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
  templatedCoaching,
  templatedProfile,
} from "../lib/insights/compute";
import {
  buildProfileSystemPrompt,
  buildProfileUserPrompt,
  parseProfileResponse,
} from "../lib/insights/profile-prompt";
import {
  AiVoiceProfile,
  CoachingSnapshot,
  StoredVoiceProfile,
} from "../lib/insights/profile.types";
import { OllamaGenerateTextRepo } from "../repos/generate-text.repo";
import { getAppState, produceAppState } from "../store";
import { registerTerms, registerTranscriptions } from "../utils/app.utils";
import { createId } from "../utils/id.utils";
import { getLogger } from "../utils/log.utils";
import { getMyUserPreferences } from "../utils/user.utils";

// Deep-profile model: a large model (served via the local Ollama endpoint,
// which routes `*-cloud` models to Ollama's cloud) for a genuinely insightful
// read. Falls back to the user's configured model, then a template.
const PROFILE_MODEL = "gpt-oss:120b-cloud";
const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

// Bump whenever the profile schema/prompt gains depth. A stored profile from an
// older version (or a templated fallback generated while the cloud model was
// unreachable) is treated as stale and regenerated, so users always see the
// latest, deepest profile instead of a shallow cached one.
const PROFILE_VERSION = 2;

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

  // Living profile cadence: keep the profile fresh forever, not just up to the
  // 10k-word "word analysis" unlock. Regenerate on a force, on the very first
  // run, whenever a new milestone is crossed, or on a gentle time/word cadence
  // (stale after a day, or enough new material since the last generation) —
  // throttled by the reentrancy guard below so it never spams the LLM.
  let shouldRegen = opts?.force === true;
  if (!shouldRegen) {
    if (!latest) {
      shouldRegen = true;
    } else if ((latest.version ?? 0) < PROFILE_VERSION) {
      // Newer/deeper profile schema available — upgrade the stale cached one.
      shouldRegen = true;
    } else if (latest.profile.generated === false) {
      // Last profile was a templated fallback (cloud model was down at the
      // time, e.g. the /v1 404). Now that it may be reachable, try for real.
      shouldRegen = true;
    } else if (milestone > latest.milestone) {
      shouldRegen = true;
    } else {
      const ageMs = Date.now() - latest.createdAt;
      const wordsSince = usage.totalWords - latest.totalWords;
      if (ageMs > 24 * 60 * 60 * 1000 || wordsSince >= 750) shouldRegen = true;
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
  const samples = sampleTranscripts(transcriptions, 100);

  let profile: AiVoiceProfile;
  const liteMode = state.local.liteMode === true;
  try {
    if (liteMode) {
      // Lite mode skips the LLM entirely to stay light on weak hardware.
      profile = templatedProfile(base, transcriptions, words);
    } else {
      const input = {
        system: buildProfileSystemPrompt(),
        prompt: buildProfileUserPrompt({
          usage,
          profile: base,
          words,
          samples,
          events,
          previousIdentity: latest?.profile.identity ?? null,
        }),
      };
      const ollamaUrl =
        getMyUserPreferences(state)?.postProcessingOllamaUrl ??
        DEFAULT_OLLAMA_URL;
      let text: string | null = null;
      try {
        const deep = new OllamaGenerateTextRepo(ollamaUrl, PROFILE_MODEL);
        text = (await deep.generateText(input)).text;
      } catch (deepError) {
        // Big model unavailable (offline / not authed) — fall back to whatever
        // model the user has configured, then to a template.
        getLogger().warning(`Deep profile model unavailable: ${deepError}`);
        const gen = getGenerateTextRepo();
        if (!gen.repo) throw new Error("no generation model configured");
        text = (await gen.repo.generateText(input)).text;
      }
      profile =
        parseProfileResponse(text) ??
        templatedProfile(base, transcriptions, words);
      // If the model omitted coaching, backfill a grounded offline version so the
      // Coaching card is never empty when we have enough signal.
      if (!profile.coaching) {
        profile = { ...profile, coaching: templatedCoaching(words) };
      }
    }
  } catch (error) {
    getLogger().warning(
      `Voice profile generation fell back to template: ${error}`,
    );
    profile = templatedProfile(base, transcriptions, words);
  }

  const stats: CoachingSnapshot = {
    fillerRate: words.fillerRate,
    avgSentenceLength: words.avgSentenceLength,
    vocabularySize: words.vocabularySize,
    questionRatio: words.questionRatio,
    wpm: usage.wpm,
  };

  const stored: StoredVoiceProfile = {
    milestone,
    createdAt: Date.now(),
    totalWords: usage.totalWords,
    profile,
    catchphrase: base.catchphrase,
    mostUsedWord: base.mostUsedWord,
    stats,
    version: PROFILE_VERSION,
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

export type TranscriptReview = {
  critique: string;
  rewrite: string;
};

// One-shot "Review this" for a single transcript: sends it to the big model and
// gets back honest coaching plus a cleaner rewrite. Falls back to the user's
// configured model, and degrades gracefully to raw text if JSON isn't returned.
export const reviewTranscript = async (
  transcript: string,
): Promise<TranscriptReview> => {
  const state = getAppState();
  const text = transcript.trim();
  if (!text) throw new Error("empty transcript");

  const system =
    "You are a warm, sharp writing and speaking coach. Given one thing the user dictated by voice, give brief honest feedback and a cleaner rewrite. Respond with ONLY a JSON object, no prose or markdown.";
  const prompt = `Here is something the user dictated by voice:

"""
${text.slice(0, 4000)}
"""

Return a JSON object with exactly these keys:
{
  "critique": "2-4 sentences of specific, kind, actionable feedback on clarity, structure, filler words, and tone",
  "rewrite": "a cleaner, tighter version that keeps their voice and meaning, in the same language as the original"
}`;
  const input = { system, prompt };
  const ollamaUrl =
    getMyUserPreferences(state)?.postProcessingOllamaUrl ?? DEFAULT_OLLAMA_URL;

  let raw: string;
  try {
    const deep = new OllamaGenerateTextRepo(ollamaUrl, PROFILE_MODEL);
    raw = (await deep.generateText(input)).text;
  } catch (deepError) {
    getLogger().warning(`Review model unavailable: ${deepError}`);
    const gen = getGenerateTextRepo();
    if (!gen.repo) throw new Error("no generation model configured");
    raw = (await gen.repo.generateText(input)).text;
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const p = JSON.parse(match[0]) as Record<string, unknown>;
      const critique = typeof p.critique === "string" ? p.critique.trim() : "";
      const rewrite = typeof p.rewrite === "string" ? p.rewrite.trim() : "";
      if (critique || rewrite) return { critique, rewrite };
    } catch {
      // fall through to raw degrade
    }
  }
  return { critique: raw.trim(), rewrite: "" };
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
