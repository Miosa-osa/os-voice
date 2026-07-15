import { Box, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { CloudWord } from "../../lib/insights/compute";

export const WordCloud = ({ words }: { words: CloudWord[] }) => {
  const theme = useTheme();
  if (words.length === 0) return null;
  const counts = words.map((w) => w.count);
  const max = Math.max(1, ...counts);
  const min = Math.min(...counts);

  return (
    <Box
      sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "baseline" }}
    >
      {words.map((w) => {
        const t = max === min ? 1 : (w.count - min) / (max - min);
        const size = 0.8 + t * 1.4;
        return (
          <Tooltip key={w.word} disableInteractive title={`${w.count}×`}>
            <Box
              component="span"
              sx={{
                fontSize: `${size}rem`,
                lineHeight: 1.25,
                fontWeight: 500 + Math.round(t * 300),
                color: alpha(theme.palette.text.primary, 0.5 + t * 0.5),
              }}
            >
              {w.word}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};
