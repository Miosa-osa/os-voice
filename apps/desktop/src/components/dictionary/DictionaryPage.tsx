import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { Button } from "@mui/material";
import { useCallback, useState } from "react";
import { FormattedMessage } from "react-intl";
import {
  createDictionaryTerm,
  loadDictionary,
} from "../../actions/dictionary.actions";
import { useAsyncEffect } from "../../hooks/async.hooks";
import { useAppStore } from "../../store";
import { ScrollListPage } from "../common/ScrollListPage";
import { AddTermDialog } from "./AddTermDialog";
import { DictionaryRow } from "./DictionaryRow";

export default function DictionaryPage() {
  const termIds = useAppStore((state) => state.dictionary.termIds);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useAsyncEffect(async () => {
    await loadDictionary();
  }, []);

  const handleAddGlossaryTerms = useCallback(async (terms: string[]) => {
    for (const term of terms) {
      await createDictionaryTerm(term, "", false);
    }
  }, []);

  const handleAddReplacement = useCallback(
    async (source: string, destination: string) => {
      await createDictionaryTerm(source, destination, true);
    },
    [],
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
      <AddTermDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAddGlossaryTerms={handleAddGlossaryTerms}
        onAddReplacement={handleAddReplacement}
      />
    </>
  );
}
