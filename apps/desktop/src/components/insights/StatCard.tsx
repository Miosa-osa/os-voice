import { Card, Stack, Typography } from "@mui/material";

export type StatCardProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
};

export const StatCard = ({ label, value, hint }: StatCardProps) => (
  <Card sx={{ p: 2, flex: 1, minWidth: 150 }}>
    <Stack spacing={0.5}>
      <Typography variant="h4" fontWeight={700}>
        {value}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {label}
      </Typography>
      {hint && (
        <Typography variant="caption" color="textSecondary">
          {hint}
        </Typography>
      )}
    </Stack>
  </Card>
);
