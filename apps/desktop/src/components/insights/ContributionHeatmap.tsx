import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import { FormattedMessage } from "react-intl";
import { HeatmapCell } from "../../lib/insights/compute";

const CELL = 11;
const GAP = 3;
const COL = CELL + GAP;
const LABEL_W = 28;

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

export const ContributionHeatmap = ({ cells }: { cells: HeatmapCell[] }) => {
  const mode = useTheme().palette.mode;
  const ramp = RAMP[mode];

  const colorFor = (level: number): string =>
    level <= 0 ? ramp.empty : ramp.steps[Math.min(level, 4) - 1];

  const weeks: HeatmapCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
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
                {week.map((cell) => (
                  <Tooltip
                    key={cell.date}
                    disableInteractive
                    title={`${cell.words.toLocaleString()} words · ${dayjs(cell.date).format("MMM D, YYYY")}`}
                  >
                    <Box
                      sx={{
                        width: CELL,
                        height: CELL,
                        borderRadius: "2px",
                        backgroundColor: colorFor(cell.level),
                      }}
                    />
                  </Tooltip>
                ))}
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
                borderRadius: "2px",
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
