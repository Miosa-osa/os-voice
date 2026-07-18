import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SortRoundedIcon from "@mui/icons-material/SortRounded";
import {
  Box,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  type SelectChangeEvent,
} from "@mui/material";
import { FormattedMessage, useIntl } from "react-intl";
import { CATEGORY_ORDER, WordCategory } from "../../lib/vocab/categorize";

export type DictionarySort = "mostHeard" | "recent" | "alpha";
export type DictionaryCategoryFilter = WordCategory | "all";

export type DictionaryToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  category: DictionaryCategoryFilter;
  onCategoryChange: (value: DictionaryCategoryFilter) => void;
  sort: DictionarySort;
  onSortChange: (value: DictionarySort) => void;
};

// Renders the label for a single word category — shared between the toolbar's
// filter dropdown, the category group headers, and each learned-word chip so
// the vocabulary reads consistently everywhere it's grouped or filtered.
export function CategoryLabel({ category }: { category: WordCategory }) {
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

// A compact toolbar above the dictionary sections: free-text search (matches
// learned words, corrections and glossary terms) plus a category filter and
// sort order for the "Words you use" section.
export function DictionaryToolbar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
}: DictionaryToolbarProps) {
  const intl = useIntl();

  const handleCategoryChange = (event: SelectChangeEvent<string>) => {
    onCategoryChange(event.target.value as DictionaryCategoryFilter);
  };

  const handleSortChange = (event: SelectChangeEvent<string>) => {
    onSortChange(event.target.value as DictionarySort);
  };

  return (
    <Stack direction="row" spacing={1} sx={{ pt: 1 }} flexWrap="wrap">
      <TextField
        variant="outlined"
        size="small"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={intl.formatMessage({
          defaultMessage: "Search your dictionary…",
        })}
        aria-label={intl.formatMessage({
          defaultMessage: "Search your dictionary",
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
        value={category}
        onChange={handleCategoryChange}
        aria-label={intl.formatMessage({
          defaultMessage: "Filter by category",
        })}
        sx={{ minWidth: 140 }}
      >
        <MenuItem value="all">
          <FormattedMessage defaultMessage="All categories" />
        </MenuItem>
        {CATEGORY_ORDER.map((option) => (
          <MenuItem key={option} value={option}>
            <CategoryLabel category={option} />
          </MenuItem>
        ))}
      </Select>
      <Select<string>
        size="small"
        value={sort}
        onChange={handleSortChange}
        aria-label={intl.formatMessage({ defaultMessage: "Sort by" })}
        sx={{ minWidth: 160 }}
        startAdornment={
          <InputAdornment position="start">
            <SortRoundedIcon fontSize="small" color="action" />
          </InputAdornment>
        }
      >
        <MenuItem value="mostHeard">
          <FormattedMessage defaultMessage="Most heard" />
        </MenuItem>
        <MenuItem value="recent">
          <FormattedMessage defaultMessage="Most recent" />
        </MenuItem>
        <MenuItem value="alpha">
          <FormattedMessage defaultMessage="A–Z" />
        </MenuItem>
      </Select>
      <Box sx={{ flexBasis: "100%", height: 0 }} />
    </Stack>
  );
}
