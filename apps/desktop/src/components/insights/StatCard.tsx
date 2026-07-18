import { Card, Stack, Typography, type TypographyProps } from "@mui/material";

export type StatCardSize = "hero" | "default" | "compact";

export type StatCardProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /**
   * Visual weight of the card. "hero" is reserved for the 2-3 numbers that
   * matter most at a glance (e.g. today's stats). "compact" is for secondary
   * stats tucked into detailed/collapsed areas. Defaults to "default", the
   * standard stat card used across the app.
   */
  size?: StatCardSize;
};

const VALUE_VARIANT: Record<StatCardSize, TypographyProps["variant"]> = {
  hero: "h2",
  default: "h4",
  compact: "h6",
};

const LABEL_VARIANT: Record<StatCardSize, TypographyProps["variant"]> = {
  hero: "subtitle2",
  default: "overline",
  compact: "caption",
};

const PADDING: Record<StatCardSize, number> = {
  hero: 3,
  default: 2,
  compact: 1.5,
};

export const StatCard = ({
  label,
  value,
  hint,
  size = "default",
}: StatCardProps) => (
  <Card
    sx={{ p: PADDING[size], flex: 1, minWidth: size === "compact" ? 130 : 150 }}
  >
    <Stack spacing={0.5}>
      <Typography
        variant={LABEL_VARIANT[size]}
        color="textSecondary"
        fontWeight={size === "hero" ? 700 : undefined}
        sx={{ lineHeight: 1.4 }}
      >
        {label}
      </Typography>
      <Typography
        variant={VALUE_VARIANT[size]}
        fontWeight={size === "hero" ? 800 : 700}
        sx={{ lineHeight: 1.1 }}
      >
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
