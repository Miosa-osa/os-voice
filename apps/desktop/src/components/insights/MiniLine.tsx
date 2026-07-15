import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { TrendPoint } from "../../lib/insights/compute";

export const MiniLine = ({
  data,
  height = 64,
}: {
  data: TrendPoint[];
  height?: number;
}) => {
  const theme = useTheme();
  if (data.length < 2) return null;

  const W = 100;
  const H = 100;
  const values = data.map((d) => d.value);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;

  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.value - min) / range) * H;
    return `${x},${y}`;
  });
  const line = pts.join(" ");
  const stroke = theme.palette.primary.main;

  return (
    <Box sx={{ width: "100%", height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
      >
        <polygon
          points={`0,${H} ${line} ${W},${H}`}
          fill={stroke}
          opacity={0.12}
        />
        <polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </Box>
  );
};
