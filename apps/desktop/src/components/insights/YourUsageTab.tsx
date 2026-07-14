import { useMemo } from "react";
import { Stack, Typography } from "@mui/material";
import { FormattedMessage } from "react-intl";
import { Section } from "../common/Section";
import { booksComparison, computeUsage } from "../../lib/insights/compute";
import { ContributionHeatmap } from "./ContributionHeatmap";
import { InsightsEmpty } from "./InsightsEmpty";
import { StatCard } from "./StatCard";
import { useInsightsSources } from "./useInsightsData";

export const YourUsageTab = () => {
  const { events, transcriptions } = useInsightsSources();
  const usage = useMemo(
    () => computeUsage(events, transcriptions),
    [events, transcriptions],
  );
  const books = useMemo(
    () => booksComparison(usage.totalWords),
    [usage.totalWords],
  );

  if (usage.totalDictations === 0) {
    return <InsightsEmpty />;
  }

  return (
    <Stack spacing={3}>
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
