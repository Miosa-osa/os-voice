import { useMemo } from "react";
import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import { FormattedMessage, useIntl } from "react-intl";
import { HeatmapCell } from "../../lib/insights/compute";

// Fixed-width label column + month-label row height; everything else
// (the day columns) is fluid so the whole year fits the container with
// no horizontal scrolling.
const LABEL_W = 28;
const MONTH_ROW_H = 16;
const GRID_GAP = "2px";
const LEGEND_CELL = 12;

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

// Opacity steps applied to the theme's primary color, low -> high activity.
const RAMP_OPACITY = [0.28, 0.52, 0.76, 1] as const;

const quantileOf = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
};

export const ContributionHeatmap = ({
  cells,
  onDayClick,
}: {
  cells: HeatmapCell[];
  onDayClick?: (date: string, anchor: HTMLElement) => void;
}) => {
  const theme = useTheme();
  const intl = useIntl();

  const emptyColor = alpha(theme.palette.text.primary, 0.08);
  const colorFor = (level: number): string =>
    level <= 0
      ? emptyColor
      : alpha(theme.palette.primary.main, RAMP_OPACITY[Math.min(level, 4) - 1]);

  // Quartile thresholds computed from non-zero days only, so a single huge
  // outlier day no longer flattens every other active day to level 1.
  const levelFor = useMemo(() => {
    const positive = cells
      .map((cell) => cell.words)
      .filter((words) => words > 0)
      .sort((a, b) => a - b);
    const q25 = quantileOf(positive, 0.25);
    const q50 = quantileOf(positive, 0.5);
    const q75 = quantileOf(positive, 0.75);
    return (words: number): number => {
      if (words <= 0) return 0;
      if (words <= q25) return 1;
      if (words <= q50) return 2;
      if (words <= q75) return 3;
      return 4;
    };
  }, [cells]);

  const weeks: HeatmapCell[][] = useMemo(() => {
    const chunked: HeatmapCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      chunked.push(cells.slice(i, i + 7));
    }
    return chunked;
  }, [cells]);

  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, col) => {
    const first = week[0];
    if (!first) return;
    const month = dayjs(first.date).month();
    if (month !== lastMonth) {
      monthLabels.push({ col, label: dayjs(first.date).format("MMM") });
      lastMonth = month;
    }
  });

  const cellSx = (color: string, gridColumn: number, gridRow: number) => ({
    gridColumn,
    gridRow,
    width: "100%",
    aspectRatio: "1",
    minWidth: 0,
    minHeight: 0,
    borderRadius: "20%",
    backgroundColor: color,
    p: 0,
    border: "none",
    display: "block",
    ...(onDayClick && {
      cursor: "pointer",
      transition: "outline-color 80ms ease",
      "&:hover": {
        outline: "2px solid",
        outlineColor: "text.primary",
        outlineOffset: "1px",
      },
      "&:focus-visible": {
        outline: "2px solid",
        outlineColor: "primary.main",
        outlineOffset: "1px",
      },
    }),
  });

  return (
    <Box sx={{ width: "100%" }}>
      <Box
        sx={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: `${LABEL_W}px repeat(${Math.max(weeks.length, 1)}, minmax(0, 1fr))`,
          gridTemplateRows: `${MONTH_ROW_H}px repeat(7, auto)`,
          columnGap: GRID_GAP,
          rowGap: GRID_GAP,
        }}
      >
        {monthLabels.map(({ col, label }) => (
          <Typography
            key={`${col}-${label}`}
            variant="caption"
            color="textSecondary"
            sx={{
              gridColumn: col + 2,
              gridRow: 1,
              alignSelf: "center",
              fontSize: 10,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {label}
          </Typography>
        ))}

        {WEEKDAY_LABELS.map((day, dayIndex) => (
          <Box
            key={`weekday-${dayIndex}`}
            sx={{
              gridColumn: 1,
              gridRow: dayIndex + 2,
              display: "flex",
              alignItems: "center",
            }}
          >
            {day && (
              <Typography
                variant="caption"
                color="textSecondary"
                sx={{ fontSize: 9, lineHeight: 1 }}
              >
                {day}
              </Typography>
            )}
          </Box>
        ))}

        {weeks.map((week, weekIndex) =>
          week.map((cell, dayIndex) => {
            const label = intl.formatMessage(
              {
                defaultMessage: "{words} words on {date}",
              },
              {
                words: cell.words.toLocaleString(),
                date: dayjs(cell.date).format("MMM D, YYYY"),
              },
            );
            const color = colorFor(levelFor(cell.words));
            const sx = cellSx(color, weekIndex + 2, dayIndex + 2);
            return (
              <Tooltip key={cell.date} disableInteractive title={label}>
                {onDayClick ? (
                  <Box
                    component="button"
                    type="button"
                    aria-label={label}
                    onClick={(e) => onDayClick(cell.date, e.currentTarget)}
                    sx={sx}
                  />
                ) : (
                  <Box sx={sx} />
                )}
              </Tooltip>
            );
          }),
        )}
      </Box>

      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        justifyContent="flex-end"
        sx={{ mt: 1 }}
      >
        <Typography
          variant="caption"
          color="textSecondary"
          sx={{ fontSize: 10 }}
        >
          <FormattedMessage defaultMessage="Less" />
        </Typography>
        {[0, 1, 2, 3, 4].map((level) => (
          <Box
            key={level}
            sx={{
              width: LEGEND_CELL,
              height: LEGEND_CELL,
              borderRadius: "20%",
              backgroundColor: colorFor(level),
            }}
          />
        ))}
        <Typography
          variant="caption"
          color="textSecondary"
          sx={{ fontSize: 10 }}
        >
          <FormattedMessage defaultMessage="More" />
        </Typography>
      </Stack>
    </Box>
  );
};
