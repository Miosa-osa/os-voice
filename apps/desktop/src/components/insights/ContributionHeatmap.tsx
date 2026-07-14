import { Box, Stack, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import { HeatmapCell } from "../../lib/insights/compute";

const CELL = 11;
const GAP = 3;

export const ContributionHeatmap = ({ cells }: { cells: HeatmapCell[] }) => {
  const theme = useTheme();
  const base = theme.palette.primary.main;

  const colorFor = (level: number): string => {
    if (level <= 0) return theme.palette.action.hover;
    return alpha(base, 0.2 + level * 0.2);
  };

  const weeks: HeatmapCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <Box sx={{ overflowX: "auto", pb: 1 }}>
      <Stack direction="row" spacing={`${GAP}px`}>
        {weeks.map((week) => (
          <Stack key={week[0]?.date} spacing={`${GAP}px`}>
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
    </Box>
  );
};
