import DateRangeRoundedIcon from "@mui/icons-material/DateRangeRounded";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import {
  Chip,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  type SelectChangeEvent,
} from "@mui/material";
import { TranscriptionMode } from "@voquill/types";
import { useIntl } from "react-intl";

// Quick, coarse date windows — deliberately not a full date-range picker so
// the bar stays a single, scannable row.
export const QUICK_DATE_RANGES = ["all", "today", "7d", "30d"] as const;
export type QuickDateRange = (typeof QUICK_DATE_RANGES)[number];

export type TranscriptionModeFilter = TranscriptionMode | "all";

export type TranscriptionsToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  mode: TranscriptionModeFilter;
  onModeChange: (value: TranscriptionModeFilter) => void;
  range: QuickDateRange;
  onRangeChange: (value: QuickDateRange) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  flaggedOnly: boolean;
  onFlaggedOnlyChange: (value: boolean) => void;
};

// A compact, single-row (wrapping) filter bar for History: free-text search
// plus mode, date-range, favorites-only and flagged-only filters. Mirrors the
// DictionaryToolbar's flat, theme-token styling so both list pages feel
// consistent.
export function TranscriptionsToolbar({
  search,
  onSearchChange,
  mode,
  onModeChange,
  range,
  onRangeChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  flaggedOnly,
  onFlaggedOnlyChange,
}: TranscriptionsToolbarProps) {
  const intl = useIntl();

  const handleModeChange = (event: SelectChangeEvent<string>) => {
    onModeChange(event.target.value as TranscriptionModeFilter);
  };

  const handleRangeChange = (event: SelectChangeEvent<string>) => {
    onRangeChange(event.target.value as QuickDateRange);
  };

  const rangeLabel = (value: QuickDateRange): string => {
    switch (value) {
      case "today":
        return intl.formatMessage({ defaultMessage: "Today" });
      case "7d":
        return intl.formatMessage({ defaultMessage: "Last 7 days" });
      case "30d":
        return intl.formatMessage({ defaultMessage: "Last 30 days" });
      case "all":
      default:
        return intl.formatMessage({ defaultMessage: "All time" });
    }
  };

  const modeLabel = (value: TranscriptionModeFilter): string => {
    switch (value) {
      case "local":
        return intl.formatMessage({ defaultMessage: "Local" });
      case "api":
        return intl.formatMessage({ defaultMessage: "API" });
      case "cloud":
        return intl.formatMessage({ defaultMessage: "Cloud" });
      case "all":
      default:
        return intl.formatMessage({ defaultMessage: "All modes" });
    }
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ pt: 1 }}
      flexWrap="wrap"
      useFlexGap
    >
      <TextField
        variant="outlined"
        size="small"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={intl.formatMessage({
          defaultMessage: "Search your transcripts…",
        })}
        aria-label={intl.formatMessage({
          defaultMessage: "Search your transcripts",
        })}
        sx={{ flex: 1, minWidth: 180 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          },
        }}
      />
      <Select<string>
        size="small"
        value={range}
        onChange={handleRangeChange}
        aria-label={intl.formatMessage({ defaultMessage: "Filter by date" })}
        sx={{ minWidth: 150 }}
        startAdornment={
          <InputAdornment position="start">
            <DateRangeRoundedIcon fontSize="small" color="action" />
          </InputAdornment>
        }
      >
        {QUICK_DATE_RANGES.map((option) => (
          <MenuItem key={option} value={option}>
            {rangeLabel(option)}
          </MenuItem>
        ))}
      </Select>
      <Select<string>
        size="small"
        value={mode}
        onChange={handleModeChange}
        aria-label={intl.formatMessage({ defaultMessage: "Filter by mode" })}
        sx={{ minWidth: 130 }}
      >
        {(["all", "local", "api", "cloud"] as const).map((option) => (
          <MenuItem key={option} value={option}>
            {modeLabel(option)}
          </MenuItem>
        ))}
      </Select>
      <Chip
        clickable
        size="small"
        variant={favoritesOnly ? "filled" : "outlined"}
        color={favoritesOnly ? "primary" : "default"}
        icon={
          favoritesOnly ? (
            <StarRoundedIcon fontSize="small" />
          ) : (
            <StarOutlineRoundedIcon fontSize="small" />
          )
        }
        label={intl.formatMessage({ defaultMessage: "Favorites" })}
        aria-label={intl.formatMessage({
          defaultMessage: "Show favorites only",
        })}
        aria-pressed={favoritesOnly}
        onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
      />
      <Chip
        clickable
        size="small"
        variant={flaggedOnly ? "filled" : "outlined"}
        color={flaggedOnly ? "primary" : "default"}
        icon={
          flaggedOnly ? (
            <FlagRoundedIcon fontSize="small" />
          ) : (
            <FlagOutlinedIcon fontSize="small" />
          )
        }
        label={intl.formatMessage({ defaultMessage: "Flagged" })}
        aria-label={intl.formatMessage({
          defaultMessage: "Show flagged transcripts only",
        })}
        aria-pressed={flaggedOnly}
        onClick={() => onFlaggedOnlyChange(!flaggedOnly)}
      />
    </Stack>
  );
}
