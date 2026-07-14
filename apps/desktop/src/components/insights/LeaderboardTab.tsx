import { useMemo } from "react";
import { Stack, Typography } from "@mui/material";
import { FormattedMessage } from "react-intl";
import { Section } from "../common/Section";
import { computeLeaderboard } from "../../lib/insights/compute";
import { InsightsEmpty } from "./InsightsEmpty";
import { StatCard } from "./StatCard";
import { useInsightsSources } from "./useInsightsData";

export const LeaderboardTab = () => {
  const { events, transcriptions } = useInsightsSources();
  const data = useMemo(
    () => computeLeaderboard(events, transcriptions),
    [events, transcriptions],
  );

  if (data.records.length === 0) {
    return <InsightsEmpty />;
  }

  return (
    <Stack spacing={3}>
      <Section
        title={<FormattedMessage defaultMessage="Personal records" />}
        description={
          <FormattedMessage defaultMessage="Your all-time bests. Beat them." />
        }
      >
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {data.records.map((r) => (
            <StatCard
              key={r.label}
              value={r.value}
              label={r.label}
              hint={r.detail}
            />
          ))}
        </Stack>
      </Section>

      {data.topApps.length > 0 && (
        <Section title={<FormattedMessage defaultMessage="Top apps" />}>
          <Stack spacing={1}>
            {data.topApps.map((a, i) => (
              <Stack key={a.app} direction="row" justifyContent="space-between">
                <Typography>
                  {i + 1}. {a.app}
                </Typography>
                <Typography color="textSecondary">
                  <FormattedMessage
                    defaultMessage="{words} words"
                    values={{ words: a.words.toLocaleString() }}
                  />
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Section>
      )}
    </Stack>
  );
};
