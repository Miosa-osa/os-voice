import { ActionStatus } from "../types/state.types";

export type DictionaryState = {
  termIds: string[];
  status: ActionStatus;
  suggestedTerm: string | null;
};

export const INITIAL_DICTIONARY_STATE: DictionaryState = {
  termIds: [],
  status: "idle",
  suggestedTerm: null,
};
