import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
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
import { alpha } from "@mui/material/styles";
import { Term } from "@voquill/types";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useCallback, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { showErrorSnackbar, showSnackbar } from "../../actions/app.actions";
import { loadDictionary } from "../../actions/dictionary.actions";
import { setLocalStorageValue } from "../../actions/local-storage.actions";
import {
  dismissLearnedWord,
  refreshLearnedVocabulary,
  syncUbiquitousLanguage,
} from "../../actions/vocab.actions";
import { useAsyncEffect } from "../../hooks/async.hooks";
import { CATEGORY_ORDER, WordCategory } from "../../lib/vocab/categorize";
import {
  buildVocabJson,
  buildVocabMarkdown,
  exportDictionaryFile,
  type ExportableTerm,
} from "../../lib/vocab/export";
import { getTermRepo } from "../../repos";
import { LearnedWord } from "../../state/vocab.state";
import { produceAppState, useAppStore } from "../../store";
import { createId } from "../../utils/id.utils";
import { ScrollListPage } from "../common/ScrollListPage";
import { AddTermDialog } from "./AddTermDialog";
import { CategoryLabel, DictionaryToolbar } from "./DictionaryToolbar";
import type {
  DictionaryCategoryFilter,
  DictionarySort,
} from "./DictionaryToolbar";
import { DictionaryRow } from "./DictionaryRow";

dayjs.extend(relativeTime);

type Row =
  | { kind: "toolbar" }
  | { kind: "no-results" }
  | { kind: "ubiquitous-header" }
  | { kind: "ubiquitous"; word: LearnedWord }
  | { kind: "learned-header" }
  | { kind: "category-header"; category: WordCategory }
  | { kind: "learned"; word: LearnedWord }
  | { kind: "corrections-header" }
  | { kind: "glossary-header" }
  | { kind: "term"; id: string };

export default function DictionaryPage() {
  const intl = useIntl();
  const termIds = useAppStore((state) => state.dictionary.termIds);
  const termById = useAppStore((state) => state.termById);
  const learnedWords = useAppStore((state) => state.local.learnedVocab ?? []);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState<DictionaryCategoryFilter>("all");
  const [sort, setSort] = useState<DictionarySort>("mostHeard");

  const normalizedSearch = search.trim().toLowerCase();

  const hasAnyContent = learnedWords.length > 0 || termIds.length > 0;

  const sortWords = useCallback(
    (list: LearnedWord[]): LearnedWord[] => {
      const copy = [...list];
      switch (sort) {
        case "alpha":
          copy.sort((a, b) => a.word.localeCompare(b.word));
          break;
        case "recent":
          copy.sort(
            (a, b) =>
              (b.lastHeardAt ?? b.firstLearnedAt) -
              (a.lastHeardAt ?? a.firstLearnedAt),
          );
          break;
        case "mostHeard":
        default:
          copy.sort(
            (a, b) =>
              b.timesHeard - a.timesHeard ||
              (b.lastHeardAt ?? b.firstLearnedAt) -
                (a.lastHeardAt ?? a.firstLearnedAt),
          );
          break;
      }
      return copy;
    },
    [sort],
  );

  const matchesWordSearch = useCallback(
    (word: LearnedWord) => {
      if (!normalizedSearch) return true;
      return (
        word.word.toLowerCase().includes(normalizedSearch) ||
        (word.definition ?? "").toLowerCase().includes(normalizedSearch) ||
        (word.example ?? "").toLowerCase().includes(normalizedSearch)
      );
    },
    [normalizedSearch],
  );

  // Sorted (by heard count) regardless of the toolbar's sort control — the
  // ubiquitous section always leads with what the user says most.
  const ubiquitousWords = useMemo(
    () =>
      learnedWords
        .filter((word) => word.isUbiquitous && matchesWordSearch(word))
        .sort((a, b) => b.timesHeard - a.timesHeard),
    [learnedWords, matchesWordSearch],
  );

  // Grouped by category (in CATEGORY_ORDER) unless the toolbar narrows to a
  // single category, in which case a flat sorted list reads cleaner.
  const learnedRows = useMemo<Row[]>(() => {
    const filtered = learnedWords.filter(
      (word) => !word.isUbiquitous && matchesWordSearch(word),
    );
    const byFilter =
      categoryFilter === "all"
        ? filtered
        : filtered.filter(
            (word) => (word.category ?? "word") === categoryFilter,
          );

    if (categoryFilter !== "all") {
      return sortWords(byFilter).map((word) => ({
        kind: "learned" as const,
        word,
      }));
    }

    const rows: Row[] = [];
    for (const category of CATEGORY_ORDER) {
      const group = byFilter.filter(
        (word) => (word.category ?? "word") === category,
      );
      if (group.length === 0) continue;
      rows.push({ kind: "category-header", category });
      for (const word of sortWords(group)) {
        rows.push({ kind: "learned", word });
      }
    }
    return rows;
  }, [learnedWords, matchesWordSearch, categoryFilter, sortWords]);

  const correctionIds = useMemo(
    () =>
      termIds.filter((id) => {
        const term = termById[id];
        if (!term?.isReplacement) return false;
        if (!normalizedSearch) return true;
        return (
          term.sourceValue.toLowerCase().includes(normalizedSearch) ||
          term.destinationValue.toLowerCase().includes(normalizedSearch)
        );
      }),
    [termIds, termById, normalizedSearch],
  );
  const glossaryIds = useMemo(
    () =>
      termIds.filter((id) => {
        const term = termById[id];
        if (!term || term.isReplacement) return false;
        if (!normalizedSearch) return true;
        return term.sourceValue.toLowerCase().includes(normalizedSearch);
      }),
    [termIds, termById, normalizedSearch],
  );

  // A single flat list of section headers + rows, so every section shares one
  // scroll surface, the collapsing page header, and the toolbar above it.
  const rows = useMemo<Row[]>(() => {
    if (!hasAnyContent) return [];

    const out: Row[] = [{ kind: "toolbar" }];
    if (ubiquitousWords.length > 0) {
      out.push({ kind: "ubiquitous-header" });
      for (const word of ubiquitousWords)
        out.push({ kind: "ubiquitous", word });
    }
    if (learnedRows.length > 0) {
      out.push({ kind: "learned-header" });
      out.push(...learnedRows);
    }
    if (correctionIds.length > 0) {
      out.push({ kind: "corrections-header" });
      for (const id of correctionIds) out.push({ kind: "term", id });
    }
    if (glossaryIds.length > 0) {
      out.push({ kind: "glossary-header" });
      for (const id of glossaryIds) out.push({ kind: "term", id });
    }
    if (out.length === 1 && normalizedSearch) {
      out.push({ kind: "no-results" });
    }
    return out;
  }, [
    hasAnyContent,
    ubiquitousWords,
    learnedRows,
    correctionIds,
    glossaryIds,
    normalizedSearch,
  ]);

  useAsyncEffect(async () => {
    await loadDictionary();
    await refreshLearnedVocabulary();
    // Belt-and-suspenders: refreshLearnedVocabulary already syncs ubiquitous
    // language, but re-run explicitly so the section reflects the latest
    // voice profile even if that internal call is ever removed.
    await syncUbiquitousLanguage();
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
    async (format: "json" | "markdown") => {
      setExportAnchor(null);
      const terms = termIds
        .map((id) => termById[id])
        .filter((t): t is ExportableTerm => Boolean(t));
      const filename =
        format === "json"
          ? "os-voice-dictionary.json"
          : "os-voice-dictionary.md";
      const contents =
        format === "json"
          ? buildVocabJson(learnedWords, terms)
          : buildVocabMarkdown(learnedWords, terms);

      try {
        const saved = await exportDictionaryFile(filename, contents);
        if (saved) {
          showSnackbar(
            intl.formatMessage({
              defaultMessage: "Dictionary exported successfully",
            }),
            { mode: "success" },
          );
        }
      } catch (error) {
        showErrorSnackbar(error);
      }
    },
    [intl, learnedWords, termById, termIds],
  );

  const renderItem = useCallback(
    (row: Row) => {
      switch (row.kind) {
        case "toolbar":
          return (
            <DictionaryToolbar
              search={search}
              onSearchChange={setSearch}
              category={categoryFilter}
              onCategoryChange={setCategoryFilter}
              sort={sort}
              onSortChange={setSort}
            />
          );
        case "no-results":
          return (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                <FormattedMessage defaultMessage="No matches for your search." />
              </Typography>
            </Box>
          );
        case "ubiquitous-header":
          return (
            <SectionHeader
              highlight
              icon={<AutoAwesomeRoundedIcon fontSize="small" color="primary" />}
              title={
                <FormattedMessage defaultMessage="Your ubiquitous language" />
              }
              description={
                <FormattedMessage defaultMessage="The words and phrases you live in." />
              }
            />
          );
        case "learned-header":
          return (
            <SectionHeader
              title={<FormattedMessage defaultMessage="Words you use" />}
              description={
                <FormattedMessage defaultMessage="Vocabulary OS Voice picked up from your dictation — organized, timestamped, and defined so it gets your words right." />
              }
            />
          );
        case "category-header":
          return (
            <Typography
              variant="overline"
              color="text.secondary"
              fontWeight={700}
              letterSpacing={0.5}
              sx={{ display: "block", pt: 2, pb: 0.5 }}
            >
              <CategoryLabel category={row.category} />
            </Typography>
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
        case "ubiquitous":
          return (
            <LearnedWordRow
              word={row.word}
              highlight
              onDismiss={dismissLearnedWord}
              onPromote={handlePromote}
            />
          );
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
    [categoryFilter, handlePromote, search, sort],
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
          row.kind === "learned" || row.kind === "ubiquitous"
            ? `${row.kind}:${row.word.word}`
            : row.kind === "term"
              ? `t:${row.id}`
              : row.kind === "category-header"
                ? `cat:${row.category}`
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
        <MenuItem onClick={() => void handleExport("json")}>
          <FormattedMessage defaultMessage="Export as JSON" />
        </MenuItem>
        <MenuItem onClick={() => void handleExport("markdown")}>
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
  highlight,
  icon,
}: {
  title: React.ReactNode;
  description: React.ReactNode;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Box sx={{ pt: 3, pb: 1 }}>
      <Stack direction="row" spacing={0.75} alignItems="center">
        {icon}
        <Typography
          variant="subtitle2"
          fontWeight={700}
          color={highlight ? "primary.main" : undefined}
        >
          {title}
        </Typography>
      </Stack>
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
  highlight,
}: {
  word: LearnedWord;
  onDismiss: (word: string) => void;
  onPromote: (word: string) => void;
  highlight?: boolean;
}) {
  const intl = useIntl();
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      py={1.25}
      px={highlight ? 1.5 : 0}
      sx={
        highlight
          ? (theme) => ({
              backgroundColor: alpha(theme.palette.primary.main, 0.07),
              borderRadius: 2,
              mb: 0.75,
            })
          : undefined
      }
    >
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
            {word.lastHeardAt && (
              <FormattedMessage
                defaultMessage=" · last heard {relative}"
                values={{ relative: dayjs(word.lastHeardAt).fromNow() }}
              />
            )}
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
