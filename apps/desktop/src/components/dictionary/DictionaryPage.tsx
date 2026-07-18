import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { Term } from "@voquill/types";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import {
  CATEGORY_ORDER,
  categorizeWord,
  WordCategory,
} from "../../lib/vocab/categorize";
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

  // Group the learned vocabulary by an offline heuristic category so the list
  // reads as an organized picture of the words the user actually lives in,
  // rather than one undifferentiated blob of chips.
  const learnedByCategory = useMemo(() => {
    const groups = new Map<WordCategory, string[]>();
    for (const word of learnedWords) {
      const category = categorizeWord(word);
      const bucket = groups.get(category);
      if (bucket) bucket.push(word);
      else groups.set(category, [word]);
    }
    return CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => ({
      category: c,
      words: groups.get(c) ?? [],
    }));
  }, [learnedWords]);

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
          <Typography variant="subtitle2" fontWeight={700}>
            <FormattedMessage defaultMessage="Words you use" />
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <FormattedMessage
              defaultMessage="{count, plural, one {# word} other {# words}} OS Voice picked up from your dictation history — grouped by kind — so it gets the vocabulary you actually use right."
              values={{ count: learnedWords.length }}
            />
          </Typography>
          <Stack spacing={2}>
            {learnedByCategory.map(({ category, words }) => (
              <Box key={category}>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ display: "block", mb: 0.5 }}
                >
                  <CategoryLabel category={category} count={words.length} />
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {words.map((word) => (
                    <Chip
                      key={word}
                      label={word}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Box>
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

function CategoryLabel({
  category,
  count,
}: {
  category: WordCategory;
  count: number;
}) {
  switch (category) {
    case "proper":
      return (
        <FormattedMessage
          defaultMessage="Names & places · {count}"
          values={{ count }}
        />
      );
    case "technical":
      return (
        <FormattedMessage
          defaultMessage="Technical · {count}"
          values={{ count }}
        />
      );
    case "acronym":
      return (
        <FormattedMessage
          defaultMessage="Acronyms · {count}"
          values={{ count }}
        />
      );
    case "phrase":
      return (
        <FormattedMessage
          defaultMessage="Phrases · {count}"
          values={{ count }}
        />
      );
    default:
      return (
        <FormattedMessage
          defaultMessage="Other words · {count}"
          values={{ count }}
        />
      );
  }
}
