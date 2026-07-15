import { Transcription } from "@voquill/types";
import { getRec } from "@voquill/utilities";
import { getTermRepo, getTranscriptionRepo } from "../repos";
import { getAppState, produceAppState } from "../store";
import {
  applyReplacements,
  applySymbolConversions,
} from "../utils/string.utils";
import { learnTermsFromEdit } from "../lib/insights/compute";
import { createId } from "../utils/id.utils";
import { postProcessTranscript, transcribeAudio } from "./transcribe.actions";
import { loadDictionary } from "./dictionary.actions";

export const openTranscriptionDetailsDialog = (transcriptionId: string) => {
  produceAppState((draft) => {
    draft.transcriptions.detailsDialogTranscriptionId = transcriptionId;
    draft.transcriptions.detailsDialogOpen = true;
  });
};

export const closeTranscriptionDetailsDialog = () => {
  produceAppState((draft) => {
    draft.transcriptions.detailsDialogOpen = false;
  });
};

export const openRetranscribeDialog = (transcriptionId: string) => {
  produceAppState((draft) => {
    draft.transcriptions.retranscribeDialogTranscriptionId = transcriptionId;
    draft.transcriptions.retranscribeDialogOpen = true;
  });
};

export const closeRetranscribeDialog = () => {
  produceAppState((draft) => {
    draft.transcriptions.retranscribeDialogOpen = false;
  });
};

export const openFlagTranscriptionDialog = (transcriptionId: string) => {
  produceAppState((draft) => {
    draft.transcriptions.flagDialogTranscriptionId = transcriptionId;
    draft.transcriptions.flagDialogOpen = true;
  });
};

export const closeFlagTranscriptionDialog = () => {
  produceAppState((draft) => {
    draft.transcriptions.flagDialogOpen = false;
  });
};

type RetranscribeTranscriptionParams = {
  transcriptionId: string;
  toneId?: string | null;
  languageCode?: string | null;
};

export const retranscribeTranscription = async ({
  transcriptionId,
  toneId,
  languageCode,
}: RetranscribeTranscriptionParams): Promise<void> => {
  const state = getAppState();
  const transcription = getRec(state.transcriptionById, transcriptionId);

  if (!transcription) {
    throw new Error("Transcription not found.");
  }

  const repo = getTranscriptionRepo();
  const audioData = await repo.loadTranscriptionAudio(transcriptionId);

  const transcribeResult = await transcribeAudio({
    samples: audioData.samples,
    sampleRate: audioData.sampleRate,
    dictationLanguage: languageCode ?? undefined,
  });

  const rawTranscript = transcribeResult.rawTranscript;

  const replacementRules = Object.values(state.termById)
    .filter((term) => term.isReplacement)
    .map((term) => ({
      sourceValue: term.sourceValue,
      destinationValue: term.destinationValue,
    }));

  const afterReplacements = applyReplacements(rawTranscript, replacementRules);
  const sanitizedTranscript = applySymbolConversions(afterReplacements);

  const postProcessResult = await postProcessTranscript({
    rawTranscript: sanitizedTranscript,
    toneId: toneId ?? null,
    dictationLanguage: languageCode ?? undefined,
  });

  const finalTranscript = postProcessResult.transcript;

  const warnings = [
    ...transcribeResult.warnings,
    ...postProcessResult.warnings,
  ];
  const metadata = {
    ...transcribeResult.metadata,
    ...postProcessResult.metadata,
  };

  if (!finalTranscript) {
    throw new Error("Retranscription produced no text.");
  }

  const updatedPayload: Transcription = {
    ...transcription,
    transcript: finalTranscript,
    sanitizedTranscript,
    modelSize: metadata?.modelSize ?? null,
    inferenceDevice: metadata?.inferenceDevice ?? null,
    rawTranscript: rawTranscript ?? finalTranscript,
    transcriptionPrompt: metadata?.transcriptionPrompt ?? null,
    postProcessPrompt: metadata?.postProcessPrompt ?? null,
    transcriptionApiKeyId: metadata?.transcriptionApiKeyId ?? null,
    postProcessApiKeyId: metadata?.postProcessApiKeyId ?? null,
    transcriptionMode: metadata?.transcriptionMode ?? null,
    postProcessMode: metadata?.postProcessMode ?? null,
    postProcessDevice: metadata?.postProcessDevice ?? null,
    warnings: warnings.length > 0 ? warnings : null,
  };

  const updated = await repo.updateTranscription(updatedPayload);

  produceAppState((draft) => {
    draft.transcriptionById[transcriptionId] = updated;
  });
};

// Saves a user-corrected transcript and auto-learns clean single-word fixes
// into the dictionary (Wispr-Flow-style "learns from your corrections").
export const saveTranscriptionEdit = async (
  transcriptionId: string,
  newTranscript: string,
): Promise<number> => {
  const state = getAppState();
  const transcription = getRec(state.transcriptionById, transcriptionId);
  if (!transcription) {
    return 0;
  }

  const oldText = transcription.transcript ?? "";
  if (newTranscript.trim() === oldText.trim()) {
    return 0;
  }

  const updated = await getTranscriptionRepo().updateTranscription({
    ...transcription,
    transcript: newTranscript,
  });
  produceAppState((draft) => {
    draft.transcriptionById[transcriptionId] = updated;
  });

  const existingSources = new Set(
    Object.values(getAppState().termById).map((term) =>
      term.sourceValue.toLowerCase(),
    ),
  );
  const learned = learnTermsFromEdit(oldText, newTranscript, existingSources);
  for (const { source, destination } of learned) {
    await getTermRepo().createTerm({
      id: createId(),
      createdAt: new Date().toISOString(),
      sourceValue: source,
      destinationValue: destination,
      isReplacement: true,
    });
  }
  if (learned.length > 0) {
    await loadDictionary();
  }
  return learned.length;
};
