import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { Term } from "@voquill/types";
import dayjs from "dayjs";
import { useCallback, useState } from "react";
import { FormattedMessage } from "react-intl";
import { showErrorSnackbar } from "../../actions/app.actions";
import { loadDictionary } from "../../actions/dictionary.actions";
import { refreshLearnedVocabulary } from "../../actions/vocab.actions";
import { setLocalStorageValue } from "../../actions/local-storage.actions";
import { useAsyncEffect } from "../../hooks/async.hooks";
import { getTermRepo } from "../../repos";
import { produceAppState, useAppStore } from "../../store";
import { createId } from "../../utils/id.utils";
import { ScrollListPage } from "../common/ScrollListPage";
import { AddTermDialog } from "./AddTermDialog";
import { DictionaryRow } from "./DictionaryRow";

export default function DictionaryPage() {
  const termIds = useAppStore((state) => state.dictionary.termIds);
  const learnedWords = useAppStore((state) => state.vocab.learnedWords);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useAsyncEffect(async () => {
    await loadDictionary();
    await refreshLearnedVocabulary();
  }, []);

  const addTerm = useCallback(
    async (
      sourceValue: string,
      destinationValue: string,
      replacement: boolean,
    ) => {
      const newTerm: Term = {
        id: createId(),
        createdAt: dayjs().toISOString(),
        sourceValue,
        destinationValue,
        isReplacement: replacement,
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
      } catch (error) {
        produceAppState((draft) => {
          delete draft.termById[newTerm.id];
          draft.dictionary.termIds = draft.dictionary.termIds.filter(
            (termId) => termId !== newTerm.id,
          );
        });
        showErrorSnackbar(error);
      }
    },
    [],
  );

  const handleAddGlossaryTerms = useCallback(
    async (terms: string[]) => {
      for (const term of terms) {
        await addTerm(term, "", false);
      }
    },
    [addTerm],
  );

  const handleAddReplacement = useCallback(
    async (source: string, destination: string) => {
      await addTerm(source, destination, true);
    },
    [addTerm],
  );

  return (
    <>
      <ScrollListPage
        title={<FormattedMessage defaultMessage="Dictionary" />}
        subtitle={
          <FormattedMessage defaultMessage="OS Voice may misunderstand you on occasion. If you see certain words being missed frequently, you can define a replacement rule here to fix the spelling automatically." />
        }
        action={
          <Button
            variant="text"
            startIcon={<AddRoundedIcon />}
            onClick={() => setIsAddDialogOpen(true)}
          >
            <FormattedMessage defaultMessage="Add" />
          </Button>
        }
        items={termIds}
        computeItemKey={(id) => id}
        renderItem={(id) => <DictionaryRow key={id} id={id} />}
      />
      {learnedWords.length > 0 && (
        <Box sx={{ px: 3, py: 2, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            <FormattedMessage defaultMessage="Words OS Voice has learned from you" />
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <FormattedMessage defaultMessage="Automatically picked up from your dictation history to improve accuracy on the words you actually use." />
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {learnedWords.map((word) => (
              <Chip key={word} label={word} size="small" variant="outlined" />
            ))}
          </Stack>
        </Box>
      )}
      <AddTermDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAddGlossaryTerms={handleAddGlossaryTerms}
        onAddReplacement={handleAddReplacement}
      />
    </>
  );
}
