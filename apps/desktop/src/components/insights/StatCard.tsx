import { Card, Stack, Typography } from "@mui/material";

export type StatCardProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
};

export const StatCard = ({ label, value, hint }: StatCardProps) => (
  <Card
    variant="outlined"
    sx={{ p: 2, flex: 1, minWidth: 150, borderRadius: 2 }}
  >
    <Stack spacing={0.5}>
      <Typography
        variant="overline"
        color="textSecondary"
        sx={{ lineHeight: 1.4 }}
      >
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.1 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="textSecondary">
          {hint}
        </Typography>
      )}
    </Stack>
  </Card>
);
