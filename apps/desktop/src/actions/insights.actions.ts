import { getInsightsRepo, getTermRepo, getTranscriptionRepo } from "../repos";
import { LocalDictationEvent } from "../repos/insights.repo";
import { produceAppState } from "../store";
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
  } catch (error) {
    getLogger().error(`Failed to record dictation event: ${error}`);
  }
};
