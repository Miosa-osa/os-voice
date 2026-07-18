import { Box, Typography } from "@mui/material";
import { Transcription } from "@voquill/types";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import {
  findRecurringCorrections,
  RecurringCorrection,
} from "../../lib/vocab/recurring-corrections";
import { useLocalStorage } from "../../hooks/local-storage.hooks";
import { useAppStore } from "../../store";
import { ScrollListPage } from "../common/ScrollListPage";
import {
  DateGroupKind,
  dateGroupKindOf,
  groupTranscriptionIdsByDay,
  hasActiveTranscriptionFilters,
  matchesTranscriptionFilters,
  TranscriptionFilters,
} from "./transcriptions-filtering.utils";
import {
  QuickDateRange,
  TranscriptionModeFilter,
  TranscriptionsToolbar,
} from "./TranscriptionsToolbar";
import { TranscriptionsSideEffects } from "./TranscriptionsSideEffects";
import { TranscriptionRow } from "./TranscriptRow";

const FAVORITE_TRANSCRIPTION_IDS_KEY = "voquill:favorite-transcription-ids";

type Row =
  | { kind: "toolbar" }
  | { kind: "date-header"; dateKey: string; groupKind: DateGroupKind }
  | { kind: "transcription"; id: string }
  | { kind: "no-transcriptions" }
  | { kind: "no-results" };

const rowKey = (row: Row): string => {
  switch (row.kind) {
    case "toolbar":
      return "toolbar";
    case "date-header":
      return `header-${row.dateKey}`;
    case "transcription":
      return row.id;
    case "no-transcriptions":
      return "no-transcriptions";
    case "no-results":
      return "no-results";
  }
};

// A day-section header ("Today" / "Yesterday" / "Jul 3, 2026") rendered as a
// prominent, theme-toned band above each day's rows — reads as a sticky
// section divider while staying inside the same flat, virtualization-free
// list ScrollListPage already renders (avoids fighting the page's own
// animated collapsing header with real position: sticky).
function DateSectionHeader({
  dateKey,
  groupKind,
}: {
  dateKey: string;
  groupKind: DateGroupKind;
}) {
  return (
    <Box
      sx={(theme) => ({
        mt: 2,
        mb: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        bgcolor: theme.vars?.palette.level1 ?? theme.palette.background.paper,
      })}
    >
      <Typography
        variant="overline"
        color="text.secondary"
        fontWeight={700}
        letterSpacing={0.5}
      >
        {groupKind === "today" ? (
          <FormattedMessage defaultMessage="Today" />
        ) : groupKind === "yesterday" ? (
          <FormattedMessage defaultMessage="Yesterday" />
        ) : (
          dayjs(dateKey).format("MMM D, YYYY")
        )}
      </Typography>
    </Box>
  );
}

export default function TranscriptionsPage() {
  const transcriptionIds = useAppStore(
    (state) => state.transcriptions.transcriptionIds,
  );
  const transcriptionById = useAppStore((state) => state.transcriptionById);
  const termById = useAppStore((state) => state.termById);

  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<TranscriptionModeFilter>("all");
  const [range, setRange] = useState<QuickDateRange>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const [favoriteIds, setFavoriteIds] = useLocalStorage<string[]>(
    FAVORITE_TRANSCRIPTION_IDS_KEY,
    [],
  );
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const handleToggleFavorite = useCallback(
    (id: string) => {
      setFavoriteIds(
        favoriteIdSet.has(id)
          ? favoriteIds.filter((favoriteId) => favoriteId !== id)
          : [...favoriteIds, id],
      );
    },
    [favoriteIds, favoriteIdSet, setFavoriteIds],
  );

  // Ties History + Dictionary together: from the loaded transcriptions,
  // find corrections (raw -> final) the user keeps making that aren't in
  // the dictionary yet, and attach each one to a single row (its most
  // recent occurrence) so the nudge only ever shows once.
  const nudgeByTranscriptionId = useMemo(() => {
    const transcriptions = transcriptionIds
      .map((id) => transcriptionById[id])
      .filter((t): t is Transcription => Boolean(t));
    const recurring = findRecurringCorrections(
      transcriptions,
      Object.values(termById),
    );
    const map = new Map<string, RecurringCorrection>();
    for (const correction of recurring) {
      map.set(correction.anchorTranscriptionId, correction);
    }
    return map;
  }, [transcriptionIds, transcriptionById, termById]);

  const filters = useMemo<TranscriptionFilters>(
    () => ({ search, mode, range, favoritesOnly, flaggedOnly }),
    [search, mode, range, favoritesOnly, flaggedOnly],
  );

  const filteredIds = useMemo(
    () =>
      transcriptionIds.filter((id) => {
        const transcription = transcriptionById[id];
        if (!transcription) return false;
        return matchesTranscriptionFilters(
          transcription,
          filters,
          favoriteIdSet,
        );
      }),
    [transcriptionIds, transcriptionById, filters, favoriteIdSet],
  );

  const dayGroups = useMemo(
    () => groupTranscriptionIdsByDay(filteredIds, transcriptionById),
    [filteredIds, transcriptionById],
  );

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [{ kind: "toolbar" }];

    if (transcriptionIds.length === 0) {
      out.push({ kind: "no-transcriptions" });
      return out;
    }

    if (filteredIds.length === 0) {
      out.push({ kind: "no-results" });
      return out;
    }

    for (const group of dayGroups) {
      out.push({
        kind: "date-header",
        dateKey: group.dateKey,
        groupKind: dateGroupKindOf(group.dateKey),
      });
      for (const id of group.ids) {
        out.push({ kind: "transcription", id });
      }
    }

    return out;
  }, [transcriptionIds.length, filteredIds.length, dayGroups]);

  const renderItem = useCallback(
    (row: Row) => {
      switch (row.kind) {
        case "toolbar":
          return (
            <TranscriptionsToolbar
              search={search}
              onSearchChange={setSearch}
              mode={mode}
              onModeChange={setMode}
              range={range}
              onRangeChange={setRange}
              favoritesOnly={favoritesOnly}
              onFavoritesOnlyChange={setFavoritesOnly}
              flaggedOnly={flaggedOnly}
              onFlaggedOnlyChange={setFlaggedOnly}
            />
          );
        case "date-header":
          return (
            <DateSectionHeader
              dateKey={row.dateKey}
              groupKind={row.groupKind}
            />
          );
        case "transcription":
          return (
            <TranscriptionRow
              id={row.id}
              nudge={nudgeByTranscriptionId.get(row.id)}
              isFavorite={favoriteIdSet.has(row.id)}
              onToggleFavorite={handleToggleFavorite}
            />
          );
        case "no-transcriptions":
          return (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <Typography variant="h6" color="text.secondary">
                <FormattedMessage defaultMessage="No transcriptions yet" />
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <FormattedMessage defaultMessage="Start dictating and your history will show up here." />
              </Typography>
            </Box>
          );
        case "no-results":
          return (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                <FormattedMessage defaultMessage="No transcriptions match your search or filters." />
              </Typography>
            </Box>
          );
        default:
          return null;
      }
    },
    [
      search,
      mode,
      range,
      favoritesOnly,
      flaggedOnly,
      nudgeByTranscriptionId,
      favoriteIdSet,
      handleToggleFavorite,
    ],
  );

  const isFiltered = hasActiveTranscriptionFilters(filters);

  return (
    <>
      <TranscriptionsSideEffects />
      <ScrollListPage
        title={<FormattedMessage defaultMessage="History" />}
        subtitle={
          isFiltered ? (
            <FormattedMessage
              defaultMessage="{count} of {total} {total, plural, one {transcription} other {transcriptions}}"
              values={{
                count: filteredIds.length,
                total: transcriptionIds.length,
              }}
            />
          ) : (
            <FormattedMessage
              defaultMessage="{count} {count, plural, one {transcription} other {transcriptions}}"
              values={{ count: transcriptionIds.length }}
            />
          )
        }
        items={rows}
        computeItemKey={rowKey}
        renderItem={renderItem}
      />
    </>
  );
}
