import { Term } from "@voquill/types";
import dayjs from "dayjs";
import { getTermRepo } from "../repos";
import { getAppState, produceAppState } from "../store";
import { registerTerms } from "../utils/app.utils";
import { createId } from "../utils/id.utils";
import { setLocalStorageValue } from "./local-storage.actions";
import { showErrorSnackbar } from "./app.actions";

export const loadDictionary = async (): Promise<void> => {
  const terms = await getTermRepo().listTerms();
  const activeTerms = terms.sort(
    (a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf(),
  );

  produceAppState((draft) => {
    registerTerms(draft, terms);
    draft.dictionary.termIds = activeTerms.map((term) => term.id);
  });
};

export const createDictionaryTerm = async (
  sourceValue: string,
  destinationValue: string,
  isReplacement: boolean,
): Promise<Term | null> => {
  const newTerm: Term = {
    id: createId(),
    createdAt: dayjs().toISOString(),
    sourceValue,
    destinationValue,
    isReplacement,
  };

  produceAppState((draft) => {
    draft.termById[newTerm.id] = newTerm;
    draft.dictionary.termIds = [newTerm.id, ...draft.dictionary.termIds];
  });

  try {
    const created = await getTermRepo().createTerm(newTerm);
    produceAppState((draft) => {
      draft.termById[created.id] = created;
    });
    setLocalStorageValue("voquill:checklist-dictionary", true);
    return created;
  } catch (error) {
    produceAppState((draft) => {
      delete draft.termById[newTerm.id];
      draft.dictionary.termIds = draft.dictionary.termIds.filter(
        (termId) => termId !== newTerm.id,
      );
    });
    showErrorSnackbar(error);
    return null;
  }
};

/**
 * Surfaces a detected self-correction (e.g. "I said MIOSA") to the user as
 * a dismissible suggestion instead of adding it to the dictionary directly,
 * so a misheard "correction" can't silently pollute the dictionary.
 */
export const suggestDictionaryTerm = (sourceValue: string): void => {
  produceAppState((draft) => {
    draft.dictionary.suggestedTerm = sourceValue;
  });
};

export const acceptDictionarySuggestion = async (): Promise<void> => {
  const sourceValue = getAppState().dictionary.suggestedTerm;
  if (!sourceValue) {
    return;
  }

  produceAppState((draft) => {
    draft.dictionary.suggestedTerm = null;
  });

  await createDictionaryTerm(sourceValue, "", false);
};

export const dismissDictionarySuggestion = (): void => {
  produceAppState((draft) => {
    draft.dictionary.suggestedTerm = null;
  });
};
