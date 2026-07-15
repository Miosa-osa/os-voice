import { Box, Tooltip } from "@mui/material";

export const MiniBars = ({
  data,
  labels,
  height = 56,
}: {
  data: number[];
  labels?: string[];
  height?: number;
}) => {
  const max = Math.max(1, ...data);
  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: "2px", height }}>
      {data.map((value, index) => (
        <Tooltip
          key={index}
          disableInteractive
          title={
            labels?.[index]
              ? `${labels[index]}: ${value.toLocaleString()}`
              : value.toLocaleString()
          }
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 3,
              height: `${Math.max(3, (value / max) * 100)}%`,
              bgcolor: value > 0 ? "primary.main" : "action.hover",
              opacity: value > 0 ? 0.85 : 1,
              borderRadius: "2px 2px 0 0",
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
};
