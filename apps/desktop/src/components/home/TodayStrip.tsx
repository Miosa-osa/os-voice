import {
  LocalFireDepartmentRounded,
  SpeedRounded,
  TrendingUpRounded,
} from "@mui/icons-material";
import { Divider, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { FormattedMessage } from "react-intl";
import { computeMomentum } from "../../lib/insights/compute";
import { useInsightsSources } from "../insights/useInsightsData";

type TodayStatProps = {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: React.ReactNode;
};

function TodayStat({ icon, value, label }: TodayStatProps) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      {icon}
      <Typography variant="body2" fontWeight={700}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

// A compact, glanceable read on "today" only — the deep-dive numbers live on
// the Insights page. Derived from the same computeMomentum used there, over
// the same event/transcription sources the app already loads for Home.
export function TodayStrip() {
  const { events, transcriptions } = useInsightsSources();
  const momentum = useMemo(
    () => computeMomentum(events, transcriptions),
    [events, transcriptions],
  );

  // Nothing to glance at yet (brand new user) — GettingStartedList already
  // owns that empty state, so stay silent here rather than showing all zeros.
  if (momentum.wordsToday === 0 && momentum.currentStreak === 0) {
    return null;
  }

  return (
    <Stack
      direction="row"
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
      divider={<Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />}
      spacing={1.5}
    >
      <TodayStat
        icon={
          <LocalFireDepartmentRounded sx={{ color: "#FF6B35", fontSize: 18 }} />
        }
        value={momentum.currentStreak}
        label={<FormattedMessage defaultMessage="day streak" />}
      />
      <TodayStat
        icon={
          <TrendingUpRounded sx={{ color: "text.secondary", fontSize: 18 }} />
        }
        value={momentum.wordsToday.toLocaleString()}
        label={<FormattedMessage defaultMessage="words today" />}
      />
      {momentum.wpmToday > 0 && (
        <TodayStat
          icon={<SpeedRounded sx={{ color: "text.secondary", fontSize: 18 }} />}
          value={momentum.wpmToday}
          label={<FormattedMessage defaultMessage="WPM today" />}
        />
      )}
    </Stack>
  );
}
