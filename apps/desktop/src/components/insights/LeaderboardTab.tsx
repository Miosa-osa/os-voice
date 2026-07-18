import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogContent,
  Stack,
  Typography,
} from "@mui/material";
import IosShareIcon from "@mui/icons-material/IosShare";
import { FormattedMessage } from "react-intl";
import { Section } from "../common/Section";
import {
  computeAchievements,
  computeLeaderboard,
} from "../../lib/insights/compute";
import { AchievementBadge } from "./AchievementBadge";
import { InsightsEmpty } from "./InsightsEmpty";
import { ShareCard } from "./ShareCard";
import { StatCard } from "./StatCard";
import { useInsightsSources } from "./useInsightsData";

export const LeaderboardTab = () => {
  const { events, transcriptions } = useInsightsSources();
  const [shareOpen, setShareOpen] = useState(false);
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
        <Stack spacing={2}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 1.5,
            }}
          >
            {achievements.map((a) => (
              <Card
                key={a.key}
                variant="outlined"
                sx={{ p: 1.5, opacity: a.unlocked ? 1 : 0.75 }}
              >
                <AchievementBadge achievement={a} />
              </Card>
            ))}
          </Box>
          <Box>
            <Button
              size="small"
              startIcon={<IosShareIcon />}
              onClick={() => setShareOpen(true)}
            >
              <FormattedMessage defaultMessage="Share your stats" />
            </Button>
          </Box>
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

      <Dialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogContent>
          <ShareCard />
        </DialogContent>
      </Dialog>
    </Stack>
  );
};
