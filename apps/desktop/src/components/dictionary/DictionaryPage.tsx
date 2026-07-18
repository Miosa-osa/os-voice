import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Term } from "@voquill/types";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { showErrorSnackbar } from "../../actions/app.actions";
import { loadDictionary } from "../../actions/dictionary.actions";
import { setLocalStorageValue } from "../../actions/local-storage.actions";
import {
  dismissLearnedWord,
  refreshLearnedVocabulary,
} from "../../actions/vocab.actions";
import { useAsyncEffect } from "../../hooks/async.hooks";
import { WordCategory } from "../../lib/vocab/categorize";
import {
  buildVocabJson,
  buildVocabMarkdown,
  downloadTextFile,
} from "../../lib/vocab/export";
import { getTermRepo } from "../../repos";
import { LearnedWord } from "../../state/vocab.state";
import { produceAppState, useAppStore } from "../../store";
import { createId } from "../../utils/id.utils";
import { ScrollListPage } from "../common/ScrollListPage";
import { AddTermDialog } from "./AddTermDialog";
import { DictionaryRow } from "./DictionaryRow";

type Row =
  | { kind: "learned-header" }
  | { kind: "learned"; word: LearnedWord }
  | { kind: "corrections-header" }
  | { kind: "glossary-header" }
  | { kind: "term"; id: string };

export default function DictionaryPage() {
  const termIds = useAppStore((state) => state.dictionary.termIds);
  const termById = useAppStore((state) => state.termById);
  const learnedWords = useAppStore((state) => state.local.learnedVocab ?? []);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);

  const correctionIds = useMemo(
    () => termIds.filter((id) => termById[id]?.isReplacement),
    [termIds, termById],
  );
  const glossaryIds = useMemo(
    () => termIds.filter((id) => termById[id] && !termById[id]?.isReplacement),
    [termIds, termById],
  );

  // A single flat list of section headers + rows, so the three sections share
  // one scroll surface and the collapsing page header.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (learnedWords.length > 0) {
      out.push({ kind: "learned-header" });
      for (const word of learnedWords) out.push({ kind: "learned", word });
    }
    if (correctionIds.length > 0) {
      out.push({ kind: "corrections-header" });
      for (const id of correctionIds) out.push({ kind: "term", id });
    }
    if (glossaryIds.length > 0) {
      out.push({ kind: "glossary-header" });
      for (const id of glossaryIds) out.push({ kind: "term", id });
    }
    return out;
  }, [learnedWords, correctionIds, glossaryIds]);

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

  // Promote a learned word into the user's manual glossary, then stop surfacing
  // it as "learned" (it's now something they own explicitly).
  const handlePromote = useCallback(
    async (word: string) => {
      await addTerm(word, "", false);
      dismissLearnedWord(word);
    },
    [addTerm],
  );

  const handleExport = useCallback(
    (format: "json" | "markdown") => {
      setExportAnchor(null);
      const terms = termIds
        .map((id) => termById[id])
        .filter((t): t is Term => Boolean(t));
      if (format === "json") {
        downloadTextFile(
          "os-voice-dictionary.json",
          buildVocabJson(learnedWords, terms),
          "application/json",
        );
      } else {
        downloadTextFile(
          "os-voice-dictionary.md",
          buildVocabMarkdown(learnedWords, terms),
          "text/markdown",
        );
      }
    },
    [learnedWords, termById, termIds],
  );

  const renderItem = useCallback(
    (row: Row) => {
      switch (row.kind) {
        case "learned-header":
          return (
            <SectionHeader
              title={<FormattedMessage defaultMessage="Words you use" />}
              description={
                <FormattedMessage defaultMessage="Vocabulary OS Voice picked up from your dictation — organized, timestamped, and defined so it gets your words right." />
              }
            />
          );
        case "corrections-header":
          return (
            <SectionHeader
              title={
                <FormattedMessage defaultMessage="Corrections you've taught" />
              }
              description={
                <FormattedMessage defaultMessage="Replacement rules that fix how a word is spelled or written automatically." />
              }
            />
          );
        case "glossary-header":
          return (
            <SectionHeader
              title={<FormattedMessage defaultMessage="Your dictionary" />}
              description={
                <FormattedMessage defaultMessage="Glossary terms you've added so OS Voice recognizes them." />
              }
            />
          );
        case "term":
          return <DictionaryRow id={row.id} />;
        case "learned":
          return (
            <LearnedWordRow
              word={row.word}
              onDismiss={dismissLearnedWord}
              onPromote={handlePromote}
            />
          );
        default:
          return null;
      }
    },
    [handlePromote],
  );

  return (
    <>
      <ScrollListPage
        title={<FormattedMessage defaultMessage="Dictionary" />}
        subtitle={
          <FormattedMessage defaultMessage="An intelligent, organized view of your vocabulary: the words you use, the corrections you've taught, and the terms you've defined." />
        }
        action={
          <Stack direction="row" spacing={0.5}>
            <Button
              variant="text"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={(e) => setExportAnchor(e.currentTarget)}
            >
              <FormattedMessage defaultMessage="Export" />
            </Button>
            <Button
              variant="text"
              startIcon={<AddRoundedIcon />}
              onClick={() => setIsAddDialogOpen(true)}
            >
              <FormattedMessage defaultMessage="Add" />
            </Button>
          </Stack>
        }
        items={rows}
        computeItemKey={(row) =>
          row.kind === "learned"
            ? `l:${row.word.word}`
            : row.kind === "term"
              ? `t:${row.id}`
              : row.kind
        }
        renderItem={renderItem}
        emptyState={
          <Stack spacing={1} alignItems="center">
            <Typography variant="h6" color="text.secondary">
              <FormattedMessage defaultMessage="Your dictionary is empty" />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <FormattedMessage defaultMessage="Keep dictating — OS Voice will start learning the words you use. You can also add terms manually." />
            </Typography>
          </Stack>
        }
      />
      <Menu
        anchorEl={exportAnchor}
        open={Boolean(exportAnchor)}
        onClose={() => setExportAnchor(null)}
      >
        <MenuItem onClick={() => handleExport("json")}>
          <FormattedMessage defaultMessage="Export as JSON" />
        </MenuItem>
        <MenuItem onClick={() => handleExport("markdown")}>
          <FormattedMessage defaultMessage="Export as Markdown glossary" />
        </MenuItem>
      </Menu>
      <AddTermDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAddGlossaryTerms={handleAddGlossaryTerms}
        onAddReplacement={handleAddReplacement}
      />
    </>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: React.ReactNode;
  description: React.ReactNode;
}) {
  return (
    <Box sx={{ pt: 3, pb: 1 }}>
      <Typography variant="subtitle2" fontWeight={700}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );
}

function LearnedWordRow({
  word,
  onDismiss,
  onPromote,
}: {
  word: LearnedWord;
  onDismiss: (word: string) => void;
  onPromote: (word: string) => void;
}) {
  const intl = useIntl();
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" py={1.25}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography fontWeight={600}>{word.word}</Typography>
          {word.category && (
            <Chip
              label={<CategoryLabel category={word.category} />}
              size="small"
              variant="outlined"
            />
          )}
          <Typography variant="caption" color="text.secondary">
            <FormattedMessage
              defaultMessage="heard {n, plural, one {# time} other {# times}} · learned {date}"
              values={{
                n: word.timesHeard,
                date: dayjs(word.firstLearnedAt).format("MMM D"),
              }}
            />
          </Typography>
        </Stack>
        {word.definition && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {word.definition}
          </Typography>
        )}
        {word.example && (
          <Typography
            variant="caption"
            color="text.secondary"
            fontStyle="italic"
            sx={{ display: "block", mt: 0.25 }}
          >
            {`“${word.example}”`}
          </Typography>
        )}
      </Box>
      <Tooltip
        disableInteractive
        title={<FormattedMessage defaultMessage="Add to your dictionary" />}
      >
        <IconButton
          size="small"
          aria-label={intl.formatMessage(
            { defaultMessage: "Add {word} to your dictionary" },
            { word: word.word },
          )}
          onClick={() => onPromote(word.word)}
        >
          <BookmarkAddOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip
        disableInteractive
        title={
          <FormattedMessage defaultMessage="Remove and don't learn again" />
        }
      >
        <IconButton
          size="small"
          aria-label={intl.formatMessage(
            { defaultMessage: "Remove {word}" },
            { word: word.word },
          )}
          onClick={() => onDismiss(word.word)}
        >
          <DeleteOutlineRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

function CategoryLabel({ category }: { category: WordCategory }) {
  switch (category) {
    case "proper":
      return <FormattedMessage defaultMessage="Name" />;
    case "technical":
      return <FormattedMessage defaultMessage="Technical" />;
    case "acronym":
      return <FormattedMessage defaultMessage="Acronym" />;
    case "phrase":
      return <FormattedMessage defaultMessage="Phrase" />;
    default:
      return <FormattedMessage defaultMessage="Word" />;
  }
}
