import { useMemo } from "react";
import { Stack, Typography } from "@mui/material";
import dayjs from "dayjs";
import { FormattedMessage } from "react-intl";
import { Section } from "../common/Section";
import {
  booksComparison,
  computeMomentum,
  computePredictions,
  computeTrends,
  computeUsage,
  computeUsageExtras,
} from "../../lib/insights/compute";
import { ContributionHeatmap } from "./ContributionHeatmap";
import { InsightsEmpty } from "./InsightsEmpty";
import { MiniBars } from "./MiniBars";
import { MiniLine } from "./MiniLine";
import { StatCard } from "./StatCard";
import { useInsightsSources } from "./useInsightsData";

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => {
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${period}`;
});

export const YourUsageTab = () => {
  const { events, transcriptions } = useInsightsSources();
  const usage = useMemo(
    () => computeUsage(events, transcriptions),
    [events, transcriptions],
  );
  const extras = useMemo(
    () => computeUsageExtras(events, transcriptions),
    [events, transcriptions],
  );
  const books = useMemo(
    () => booksComparison(usage.totalWords),
    [usage.totalWords],
  );
  const momentum = useMemo(
    () => computeMomentum(events, transcriptions),
    [events, transcriptions],
  );
  const trends = useMemo(() => computeTrends(transcriptions), [transcriptions]);
  const predictions = useMemo(
    () => computePredictions(events, transcriptions),
    [events, transcriptions],
  );

  if (usage.totalDictations === 0) {
    return <InsightsEmpty />;
  }

  return (
    <Stack spacing={3}>
      <Section title={<FormattedMessage defaultMessage="Today" />}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <StatCard
            value={momentum.wordsToday.toLocaleString()}
            label={<FormattedMessage defaultMessage="Words today" />}
          />
          <StatCard
            value={momentum.wpmToday || "—"}
            label={<FormattedMessage defaultMessage="WPM today" />}
            hint={
              momentum.paceVsAvgPct !== 0 ? (
                <FormattedMessage
                  defaultMessage="{pct}% vs your average"
                  values={{
                    pct:
                      momentum.paceVsAvgPct > 0
                        ? `+${momentum.paceVsAvgPct}`
                        : momentum.paceVsAvgPct,
                  }}
                />
              ) : undefined
            }
          />
          <StatCard
            value={momentum.currentStreak}
            label={<FormattedMessage defaultMessage="Day streak" />}
          />
          <StatCard
            value={momentum.weekProjection.toLocaleString()}
            label={<FormattedMessage defaultMessage="On pace this week" />}
          />
        </Stack>
      </Section>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <StatCard
          value={usage.wpm}
          label={<FormattedMessage defaultMessage="Words per minute" />}
        />
        <StatCard
          value={usage.fixes.toLocaleString()}
          label={<FormattedMessage defaultMessage="Fixes by OS Voice" />}
        />
        <StatCard
          value={usage.wordsThisMonth.toLocaleString()}
          label={<FormattedMessage defaultMessage="Words this month" />}
        />
        <StatCard
          value={usage.totalWords.toLocaleString()}
          label={<FormattedMessage defaultMessage="Words all time" />}
          hint={
            <FormattedMessage
              defaultMessage="That's {phrase}"
              values={{ phrase: books.phrase }}
            />
          }
        />
      </Stack>

      <Section title={<FormattedMessage defaultMessage="Daily activity" />}>
        <Stack spacing={1.5}>
          <ContributionHeatmap cells={usage.heatmap} />
          <Typography variant="body2" color="textSecondary">
            <FormattedMessage
              defaultMessage="Current streak: {c} days · Longest: {l} days"
              values={{ c: usage.currentStreak, l: usage.longestStreak }}
            />
          </Typography>
        </Stack>
      </Section>

      <Section title={<FormattedMessage defaultMessage="When you dictate" />}>
        <Stack spacing={1.5}>
          <MiniBars data={extras.hourHistogram} labels={HOUR_LABELS} />
          {extras.bestDay && (
            <Typography variant="body2" color="textSecondary">
              <FormattedMessage
                defaultMessage="Most productive day: {words} words on {date}"
                values={{
                  words: extras.bestDay.words.toLocaleString(),
                  date: dayjs(extras.bestDay.day).format("MMM D, YYYY"),
                }}
              />
            </Typography>
          )}
        </Stack>
      </Section>

      <Section title={<FormattedMessage defaultMessage="Last 30 days" />}>
        <MiniBars
          data={extras.dailyTrend.map((d) => d.words)}
          labels={extras.dailyTrend.map((d) => dayjs(d.date).format("MMM D"))}
        />
      </Section>

      <Section title={<FormattedMessage defaultMessage="Trends" />}>
        <Stack spacing={2.5}>
          <Stack spacing={0.5}>
            <Typography variant="body2" color="textSecondary">
              <FormattedMessage defaultMessage="Speaking pace (weekly)" />
              {trends.wpmDeltaPct !== 0 && (
                <FormattedMessage
                  defaultMessage=" · {pct}% vs last week"
                  values={{
                    pct:
                      trends.wpmDeltaPct > 0
                        ? `+${trends.wpmDeltaPct}`
                        : trends.wpmDeltaPct,
                  }}
                />
              )}
            </Typography>
            <MiniLine data={trends.wpmWeekly} />
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="body2" color="textSecondary">
              <FormattedMessage defaultMessage="Vocabulary growth" />
            </Typography>
            <MiniLine data={trends.vocabGrowth} />
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="body2" color="textSecondary">
              <FormattedMessage defaultMessage="Filler words per 100 (weekly)" />
            </Typography>
            <MiniBars
              data={trends.fillerWeekly.map((p) => p.value)}
              labels={trends.fillerWeekly.map((p) => p.label)}
            />
          </Stack>
        </Stack>
      </Section>

      <Section title={<FormattedMessage defaultMessage="Looking ahead" />}>
        <Stack spacing={1}>
          {predictions.nextMilestone !== null &&
            predictions.daysToNextMilestone !== null && (
              <Typography variant="body2" color="textSecondary">
                <FormattedMessage
                  defaultMessage="At your current pace, you'll hit {milestone} words in about {days} days."
                  values={{
                    milestone: predictions.nextMilestone.toLocaleString(),
                    days: predictions.daysToNextMilestone,
                  }}
                />
              </Typography>
            )}
          <Typography variant="body2" color="textSecondary">
            <FormattedMessage
              defaultMessage="On track for {words} words this month ({rate}/day lately)."
              values={{
                words: predictions.projectedMonthWords.toLocaleString(),
                rate: predictions.dailyRate.toLocaleString(),
              }}
            />
          </Typography>
        </Stack>
      </Section>

      {extras.perApp.length > 0 && (
        <Section title={<FormattedMessage defaultMessage="App deep dive" />}>
          <Stack spacing={1}>
            {extras.perApp.map((a) => (
              <Stack
                key={a.app}
                direction="row"
                justifyContent="space-between"
                alignItems="baseline"
              >
                <Typography noWrap sx={{ maxWidth: 180 }}>
                  {a.app}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  <FormattedMessage
                    defaultMessage="{words} words · {avg}/dictation"
                    values={{
                      words: a.words.toLocaleString(),
                      avg: a.avgLength,
                    }}
                  />
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Section>
      )}

      <Section
        title={<FormattedMessage defaultMessage="Where your words go" />}
        description={
          <FormattedMessage defaultMessage="How your dictation breaks down across apps." />
        }
      >
        {usage.breakdown.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            <FormattedMessage defaultMessage="We'll show your app breakdown as you dictate." />
          </Typography>
        ) : (
          <Stack spacing={1}>
            {usage.breakdown.map((b) => (
              <Stack
                key={b.category}
                direction="row"
                justifyContent="space-between"
              >
                <Typography>{b.category}</Typography>
                <Typography color="textSecondary">
                  <FormattedMessage
                    defaultMessage="{words} words"
                    values={{ words: b.words.toLocaleString() }}
                  />
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Section>
    </Stack>
  );
};
