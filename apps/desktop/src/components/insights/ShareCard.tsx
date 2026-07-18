import { Box, Card, Chip, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { FormattedMessage, useIntl } from "react-intl";
import {
  Achievement,
  computeAchievements,
  computeUsage,
  computeVoiceProfile,
  computeWordAnalysis,
  milestoneFor,
} from "../../lib/insights/compute";
import { useAppStore } from "../../store";
import { TIER_COLORS } from "./AchievementBadge";
import { useInsightsSources } from "./useInsightsData";

const TIER_RANK: Record<string, number> = {
  platinum: 4,
  gold: 3,
  silver: 2,
  bronze: 1,
};

const tierRankOf = (a: Achievement): number =>
  TIER_RANK[a.tier ?? "bronze"] ?? 0;

// A compact, screenshot-friendly "my voice stats" card. Pure MUI — no
// external image/canvas libraries — meant to be revealed and captured by the
// user, not exported programmatically.
export const ShareCard = () => {
  const theme = useTheme();
  const intl = useIntl();
  const { events, transcriptions, terms } = useInsightsSources();
  const aiProfile = useAppStore((s) => s.insights.aiProfile);

  const usage = computeUsage(events, transcriptions);
  const milestone = milestoneFor(usage.totalWords);
  const fallback = computeVoiceProfile(
    events,
    transcriptions,
    terms,
    milestone,
  );
  const words = computeWordAnalysis(transcriptions);
  const achievements = computeAchievements(events, transcriptions);

  const name = aiProfile?.name ?? fallback.name;
  const tagline = aiProfile?.tone
    ? intl.formatMessage(
        { defaultMessage: "{tone} voice" },
        { tone: aiProfile.tone },
      )
    : intl.formatMessage({ defaultMessage: "Voice stats" });

  const topAchievements = achievements
    .filter((a) => a.unlocked)
    .sort((a, b) => tierRankOf(b) - tierRankOf(a))
    .slice(0, 5);

  const stats: { label: React.ReactNode; value: string }[] = [
    {
      label: <FormattedMessage defaultMessage="Total words" />,
      value: usage.totalWords.toLocaleString(),
    },
    {
      label: <FormattedMessage defaultMessage="Vocabulary" />,
      value: words.vocabularySize.toLocaleString(),
    },
    {
      label: <FormattedMessage defaultMessage="Streak" />,
      value: intl.formatMessage(
        { defaultMessage: "{n} days" },
        { n: usage.currentStreak },
      ),
    },
    {
      label: <FormattedMessage defaultMessage="Pace" />,
      value: intl.formatMessage(
        { defaultMessage: "{n} WPM" },
        { n: usage.wpm },
      ),
    },
  ];

  return (
    <Card
      variant="outlined"
      sx={{
        p: 3,
        borderRadius: 3,
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.14)}, ${alpha(theme.palette.primary.dark, 0.06)})`,
      }}
    >
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="overline" color="textSecondary">
            {tagline}
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {name}
          </Typography>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 1.5,
          }}
        >
          {stats.map((s, i) => (
            <Box key={i}>
              <Typography variant="caption" color="textSecondary">
                {s.label}
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {s.value}
              </Typography>
            </Box>
          ))}
        </Box>

        {topAchievements.length > 0 && (
          <Box>
            <Typography
              variant="caption"
              color="textSecondary"
              sx={{ display: "block", mb: 0.75 }}
            >
              <FormattedMessage defaultMessage="Top achievements" />
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {topAchievements.map((a) => {
                const color = TIER_COLORS[a.tier ?? "bronze"];
                return (
                  <Chip
                    key={a.key}
                    size="small"
                    variant="outlined"
                    label={`${a.emoji ?? "🏆"} ${a.label}`}
                    sx={{
                      borderColor: alpha(color, 0.45),
                      bgcolor: alpha(color, 0.1),
                      color,
                      fontWeight: 600,
                    }}
                  />
                );
              })}
            </Stack>
          </Box>
        )}

        <Typography
          variant="caption"
          color="textSecondary"
          fontWeight={700}
          sx={{ textAlign: "right", opacity: 0.6, letterSpacing: 0.5 }}
        >
          OS Voice
        </Typography>
      </Stack>
    </Card>
  );
};
