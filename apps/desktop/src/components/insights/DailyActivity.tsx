import { useMemo, useState } from "react";
import { Box, Divider, Popover, Stack, Typography } from "@mui/material";
import dayjs from "dayjs";
import { FormattedMessage } from "react-intl";
import { Transcription } from "@voquill/types";
import { LocalDictationEvent } from "../../repos/insights.repo";
import {
  UsageExtras,
  UsageStats,
  computeDailyActivitySummary,
  computeDayDetail,
} from "../../lib/insights/compute";
import { ContributionHeatmap } from "./ContributionHeatmap";
import { MiniBars } from "./MiniBars";
import { StatCard } from "./StatCard";

const targetLabel = (target: number) => {
  if (target <= 7) return <FormattedMessage defaultMessage="a week" />;
  if (target <= 30) return <FormattedMessage defaultMessage="a month" />;
  if (target <= 100) return <FormattedMessage defaultMessage="100 days" />;
  return <FormattedMessage defaultMessage="a year" />;
};

const DetailRow = ({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) => (
  <Stack direction="row" justifyContent="space-between" spacing={3}>
    <Typography variant="body2" color="textSecondary">
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={600}>
      {value}
    </Typography>
  </Stack>
);

export const DailyActivity = ({
  usage,
  extras,
  events,
  transcriptions,
}: {
  usage: UsageStats;
  extras: UsageExtras;
  events: LocalDictationEvent[];
  transcriptions: Transcription[];
}) => {
  const summary = useMemo(
    () => computeDailyActivitySummary(transcriptions),
    [transcriptions],
  );

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [day, setDay] = useState<string | null>(null);

  const detail = useMemo(
    () => (day ? computeDayDetail(events, transcriptions, day) : null),
    [day, events, transcriptions],
  );

  const handleDayClick = (date: string, el: HTMLElement) => {
    setDay(date);
    setAnchor(el);
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <StatCard
          label={<FormattedMessage defaultMessage="Current streak" />}
          value={<span>🔥 {summary.currentStreak.toLocaleString()}</span>}
          hint={<FormattedMessage defaultMessage="days in a row" />}
        />
        <StatCard
          label={<FormattedMessage defaultMessage="Longest streak" />}
          value={summary.longestStreak.toLocaleString()}
          hint={<FormattedMessage defaultMessage="days" />}
        />
        <StatCard
          label={<FormattedMessage defaultMessage="Active days" />}
          value={summary.activeDaysThisYear.toLocaleString()}
          hint={<FormattedMessage defaultMessage="this year" />}
        />
        <StatCard
          label={<FormattedMessage defaultMessage="Most active day" />}
          value={
            summary.mostActiveDay
              ? summary.mostActiveDay.words.toLocaleString()
              : "—"
          }
          hint={
            summary.mostActiveDay ? (
              dayjs(summary.mostActiveDay.date).format("MMM D, YYYY")
            ) : (
              <FormattedMessage defaultMessage="words" />
            )
          }
        />
        <StatCard
          label={<FormattedMessage defaultMessage="Words this year" />}
          value={summary.yearWords.toLocaleString()}
        />
      </Stack>

      {summary.nudge && (
        <Typography variant="body2" color="primary" fontWeight={600}>
          <FormattedMessage
            defaultMessage="🔥 {streak}-day streak — {remaining} more to {target}"
            values={{
              streak: summary.nudge.streak,
              remaining: summary.nudge.remaining,
              target: targetLabel(summary.nudge.target),
            }}
          />
        </Typography>
      )}

      <ContributionHeatmap cells={usage.heatmap} onDayClick={handleDayClick} />

      <Typography variant="caption" color="textSecondary">
        <FormattedMessage
          defaultMessage="{days} active days this year · {words} words · click a day for details"
          values={{
            days: summary.activeDaysThisYear.toLocaleString(),
            words: summary.yearWords.toLocaleString(),
          }}
        />
      </Typography>

      <Stack spacing={0.5}>
        <Typography variant="body2" color="textSecondary">
          <FormattedMessage defaultMessage="Last 30 days" />
        </Typography>
        <MiniBars
          data={extras.dailyTrend.map((d) => d.words)}
          labels={extras.dailyTrend.map((d) => dayjs(d.date).format("MMM D"))}
        />
      </Stack>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
      >
        {detail && (
          <Box sx={{ p: 2, minWidth: 220 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              {dayjs(detail.date).format("dddd, MMM D, YYYY")}
            </Typography>
            <Divider sx={{ my: 1 }} />
            {detail.words === 0 ? (
              <Typography variant="body2" color="textSecondary">
                <FormattedMessage defaultMessage="No dictation this day." />
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                <DetailRow
                  label={<FormattedMessage defaultMessage="Words" />}
                  value={detail.words.toLocaleString()}
                />
                <DetailRow
                  label={<FormattedMessage defaultMessage="Speaking pace" />}
                  value={
                    detail.wpm > 0 ? (
                      <FormattedMessage
                        defaultMessage="{wpm} WPM"
                        values={{ wpm: detail.wpm }}
                      />
                    ) : (
                      "—"
                    )
                  }
                />
                <DetailRow
                  label={<FormattedMessage defaultMessage="Time dictating" />}
                  value={
                    <FormattedMessage
                      defaultMessage="{min} min"
                      values={{ min: detail.minutes }}
                    />
                  }
                />
                <DetailRow
                  label={<FormattedMessage defaultMessage="Dictations" />}
                  value={detail.dictations.toLocaleString()}
                />
                <DetailRow
                  label={<FormattedMessage defaultMessage="Top app" />}
                  value={detail.topApp ?? "—"}
                />
              </Stack>
            )}
          </Box>
        )}
      </Popover>
    </Stack>
  );
};
