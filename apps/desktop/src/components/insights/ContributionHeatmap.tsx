import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import { FormattedMessage, useIntl } from "react-intl";
import { HeatmapCell } from "../../lib/insights/compute";

const CELL = 14;
const GAP = 3;
const COL = CELL + GAP;
const LABEL_W = 30;
// Show a recent window that fits without an awkward horizontal drag.
const WEEKS_TO_SHOW = 26;

const RAMP = {
  light: {
    empty: "#ebedf0",
    steps: ["#9be9a8", "#40c463", "#30a14e", "#216e39"],
  },
  dark: {
    empty: "rgba(255, 255, 255, 0.07)",
    steps: ["#0e4429", "#006d32", "#26a641", "#39d353"],
  },
} as const;

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export const ContributionHeatmap = ({
  cells,
  onDayClick,
}: {
  cells: HeatmapCell[];
  onDayClick?: (date: string, anchor: HTMLElement) => void;
}) => {
  const mode = useTheme().palette.mode;
  const ramp = RAMP[mode];
  const intl = useIntl();

  const colorFor = (level: number): string =>
    level <= 0 ? ramp.empty : ramp.steps[Math.min(level, 4) - 1];

  const shown =
    cells.length > WEEKS_TO_SHOW * 7 ? cells.slice(-WEEKS_TO_SHOW * 7) : cells;
  const weeks: HeatmapCell[][] = [];
  for (let i = 0; i < shown.length; i += 7) {
    weeks.push(shown.slice(i, i + 7));
  }

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

  const cellSx = (color: string) => ({
    width: CELL,
    height: CELL,
    borderRadius: "3px",
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
    <Box sx={{ overflowX: "auto", pb: 0.5 }}>
      <Box sx={{ display: "inline-block", minWidth: "min-content" }}>
        <Box sx={{ position: "relative", height: 14, ml: `${LABEL_W}px` }}>
          {monthLabels.map(({ col, label }) => (
            <Typography
              key={`${col}-${label}`}
              variant="caption"
              color="textSecondary"
              sx={{ position: "absolute", left: col * COL, fontSize: 10 }}
            >
              {label}
            </Typography>
          ))}
        </Box>

        <Stack direction="row">
          <Stack spacing={`${GAP}px`} sx={{ width: LABEL_W, pr: 0.5 }}>
            {WEEKDAY_LABELS.map((day, index) => (
              <Box
                key={index}
                sx={{ height: CELL, display: "flex", alignItems: "center" }}
              >
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{ fontSize: 9, lineHeight: 1 }}
                >
                  {day}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Stack direction="row" spacing={`${GAP}px`}>
            {weeks.map((week, weekIndex) => (
              <Stack key={weekIndex} spacing={`${GAP}px`}>
                {week.map((cell) => {
                  const label = intl.formatMessage(
                    {
                      defaultMessage: "{words} words on {date}",
                    },
                    {
                      words: cell.words.toLocaleString(),
                      date: dayjs(cell.date).format("MMM D, YYYY"),
                    },
                  );
                  return (
                    <Tooltip key={cell.date} disableInteractive title={label}>
                      {onDayClick ? (
                        <Box
                          component="button"
                          type="button"
                          aria-label={label}
                          onClick={(e) =>
                            onDayClick(cell.date, e.currentTarget)
                          }
                          sx={cellSx(colorFor(cell.level))}
                        />
                      ) : (
                        <Box sx={cellSx(colorFor(cell.level))} />
                      )}
                    </Tooltip>
                  );
                })}
              </Stack>
            ))}
          </Stack>
        </Stack>

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
                width: CELL,
                height: CELL,
                borderRadius: "3px",
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
    </Box>
  );
};
