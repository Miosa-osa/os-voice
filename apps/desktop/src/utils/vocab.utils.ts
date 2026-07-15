import { AppState } from "../state/app.state";

export const getLearnedVocabulary = (state: AppState): string[] =>
  state.vocab.learnedWords;
