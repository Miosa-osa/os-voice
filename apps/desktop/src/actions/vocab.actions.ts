import { learnVocabulary } from "../lib/vocab/learn-vocab";
import { getTranscriptionRepo } from "../repos";
import { getAppState, produceAppState } from "../store";
import { getMyUser } from "../utils/user.utils";

const MAX_TRANSCRIPTS = 500;

export const refreshLearnedVocabulary = async (): Promise<void> => {
  try {
    const transcriptions = await getTranscriptionRepo().listTranscriptions({
      limit: MAX_TRANSCRIPTS,
    });
    const transcripts = transcriptions
      .map((transcription) => transcription.transcript)
      .filter((text): text is string => Boolean(text));

    const state = getAppState();
    const excluded = new Set<string>();
    for (const termId of state.dictionary.termIds) {
      const term = state.termById[termId];
      if (term?.sourceValue) excluded.add(term.sourceValue);
      if (term?.destinationValue) excluded.add(term.destinationValue);
    }
    // learnVocabulary excludes per-token, so add each word of a multi-word name.
    const name = getMyUser(state)?.name;
    if (name) {
      for (const part of name.split(/\s+/)) {
        if (part) excluded.add(part);
      }
    }

    const learnedWords = learnVocabulary(transcripts, { excluded });
    produceAppState((draft) => {
      draft.vocab.learnedWords = learnedWords;
    });
  } catch (error) {
    console.error("Failed to refresh learned vocabulary", error);
  }
};
