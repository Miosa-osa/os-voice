import { useMemo } from "react";
import { Box, Card, LinearProgress, Stack, Typography } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { FormattedMessage } from "react-intl";
import { Section } from "../common/Section";
import {
  computeAchievements,
  computeLeaderboard,
} from "../../lib/insights/compute";
import { InsightsEmpty } from "./InsightsEmpty";
import { StatCard } from "./StatCard";
import { useInsightsSources } from "./useInsightsData";

export const LeaderboardTab = () => {
  const { events, transcriptions } = useInsightsSources();
  const data = useMemo(
    () => computeLeaderboard(events, transcriptions),
    [events, transcriptions],
  );
  const achievements = useMemo(
    () => computeAchievements(events, transcriptions),
    [events, transcriptions],
  );

  if (data.records.length === 0) {
    return <InsightsEmpty />;
  }

  const unlocked = achievements.filter((a) => a.unlocked).length;

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

      <Section
        title={<FormattedMessage defaultMessage="Achievements" />}
        description={
          <FormattedMessage
            defaultMessage="{unlocked} of {total} unlocked"
            values={{ unlocked, total: achievements.length }}
          />
        }
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 1.5,
          }}
        >
          {achievements.map((a) => (
            <Card
              key={a.key}
              variant="outlined"
              sx={{ p: 1.5, opacity: a.unlocked ? 1 : 0.7 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {a.unlocked ? (
                  <EmojiEventsIcon color="primary" fontSize="small" />
                ) : (
                  <LockOutlinedIcon color="disabled" fontSize="small" />
                )}
                <Box flex={1} minWidth={0}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {a.label}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" noWrap>
                    {a.description}
                  </Typography>
                </Box>
              </Stack>
              {!a.unlocked && (
                <LinearProgress
                  variant="determinate"
                  value={a.progress * 100}
                  sx={{ mt: 1, borderRadius: 1 }}
                />
              )}
            </Card>
          ))}
        </Box>
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
