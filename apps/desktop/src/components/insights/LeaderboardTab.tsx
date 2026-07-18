import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogContent,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import IosShareIcon from "@mui/icons-material/IosShare";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import { FormattedMessage, useIntl, type IntlShape } from "react-intl";
import { Section } from "../common/Section";
import {
  Achievement,
  AchievementTier,
  computeAchievements,
  computeLeaderboard,
} from "../../lib/insights/compute";
import { AchievementBadge, TIER_COLORS } from "./AchievementBadge";
import { InsightsEmpty } from "./InsightsEmpty";
import { ShareCard } from "./ShareCard";
import { StatCard } from "./StatCard";
import { useInsightsSources } from "./useInsightsData";

const TIER_ORDER: AchievementTier[] = ["platinum", "gold", "silver", "bronze"];

const TIER_RANK: Record<AchievementTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

const TIER_EMOJI: Record<AchievementTier, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
};

const tierRankOf = (a: Achievement): number => TIER_RANK[a.tier ?? "bronze"];

const tierLabel = (intl: IntlShape, tier: AchievementTier): string => {
  switch (tier) {
    case "bronze":
      return intl.formatMessage({ defaultMessage: "Bronze" });
    case "silver":
      return intl.formatMessage({ defaultMessage: "Silver" });
    case "gold":
      return intl.formatMessage({ defaultMessage: "Gold" });
    case "platinum":
      return intl.formatMessage({ defaultMessage: "Platinum" });
  }
};

const RING_SIZE = 88;
const RING_RADIUS = 38;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// A larger version of AchievementBadge's progress ring, used once as the
// centerpiece of the achievements hero to show overall completion.
const CompletionRing = ({
  percent,
  color,
}: {
  percent: number;
  color: string;
}) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const dash = (RING_CIRCUMFERENCE * clamped) / 100;
  return (
    <Box
      sx={{
        position: "relative",
        width: RING_SIZE,
        height: RING_SIZE,
        flexShrink: 0,
      }}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={alpha(color, 0.15)}
          strokeWidth={6}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={`${dash} ${RING_CIRCUMFERENCE}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          style={{ transition: "stroke-dasharray 0.6s ease-out" }}
        />
      </svg>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1 }}>
          {clamped}%
        </Typography>
      </Box>
    </Box>
  );
};

// A small pill summarizing how many achievements of a given tier are
// unlocked out of how many exist, e.g. "💎 1/3". Hidden entirely when the
// tier has no achievements defined.
const TierChip = ({
  tier,
  unlockedCount,
  total,
}: {
  tier: AchievementTier;
  unlockedCount: number;
  total: number;
}) => {
  const intl = useIntl();
  if (total === 0) return null;
  const color = TIER_COLORS[tier];
  const earned = unlockedCount > 0;
  return (
    <Tooltip title={tierLabel(intl, tier)} disableInteractive>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.4,
          borderRadius: 999,
          border: `1px solid ${alpha(color, earned ? 0.45 : 0.2)}`,
          bgcolor: alpha(color, earned ? 0.14 : 0.05),
        }}
      >
        <Box component="span" sx={{ fontSize: 13, lineHeight: 1 }}>
          {TIER_EMOJI[tier]}
        </Box>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ color: earned ? color : "text.disabled" }}
        >
          {unlockedCount}/{total}
        </Typography>
      </Box>
    </Tooltip>
  );
};

// A compact "game-feel" callout — used for both the closest-to-unlocking
// goal and the rarest earned badge, so the achievements screen reads a bit
// like a real accomplishment dashboard instead of a flat list.
const SpotlightCard = ({
  icon,
  title,
  achievement,
  color,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  achievement: Achievement;
  color: string;
}) => (
  <Card sx={{ flex: 1, p: 1.5, borderLeft: `3px solid ${color}`, minWidth: 0 }}>
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
      {icon}
      <Typography
        variant="caption"
        fontWeight={700}
        color="textSecondary"
        sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        {title}
      </Typography>
    </Stack>
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box
        component="span"
        role="img"
        aria-label={achievement.label}
        sx={{ fontSize: 22, lineHeight: 1 }}
      >
        {achievement.emoji ?? "🏆"}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" fontWeight={700} noWrap>
          {achievement.label}
        </Typography>
        <Typography
          variant="caption"
          color="textSecondary"
          noWrap
          sx={{ display: "block" }}
        >
          {achievement.description}
        </Typography>
      </Box>
    </Stack>
    {!achievement.unlocked && (
      <LinearProgress
        variant="determinate"
        value={Math.round(achievement.progress * 100)}
        sx={{
          mt: 1,
          height: 5,
          borderRadius: 3,
          bgcolor: alpha(color, 0.15),
          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 },
        }}
      />
    )}
  </Card>
);

const MEDALS = ["🥇", "🥈", "🥉"];

export const LeaderboardTab = () => {
  const theme = useTheme();
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

  const unlockedList = useMemo(
    () =>
      achievements
        .filter((a) => a.unlocked)
        .sort((a, b) => tierRankOf(b) - tierRankOf(a)),
    [achievements],
  );
  const lockedList = useMemo(
    () =>
      achievements
        .filter((a) => !a.unlocked)
        .sort((a, b) => b.progress - a.progress),
    [achievements],
  );
  const tierStats = useMemo(() => {
    const stats: Record<AchievementTier, { unlocked: number; total: number }> =
      {
        bronze: { unlocked: 0, total: 0 },
        silver: { unlocked: 0, total: 0 },
        gold: { unlocked: 0, total: 0 },
        platinum: { unlocked: 0, total: 0 },
      };
    for (const a of achievements) {
      const tier = a.tier ?? "bronze";
      stats[tier].total += 1;
      if (a.unlocked) stats[tier].unlocked += 1;
    }
    return stats;
  }, [achievements]);

  if (data.records.length === 0) {
    return <InsightsEmpty />;
  }

  const total = achievements.length;
  const percent =
    total > 0 ? Math.round((unlockedList.length / total) * 100) : 0;
  const closestLocked =
    lockedList.length > 0 && lockedList[0].progress > 0
      ? lockedList[0]
      : undefined;
  const rarestEarned = unlockedList.length > 0 ? unlockedList[0] : undefined;
  const heroColor = theme.palette.primary.main;
  const maxTopAppWords = data.topApps[0]?.words ?? 0;

  const renderTile = (a: Achievement) => (
    <Card
      key={a.key}
      sx={{
        p: 1.5,
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: theme.shadows[4],
        },
      }}
    >
      <AchievementBadge achievement={a} />
    </Card>
  );

  return (
    <Stack spacing={3}>
      <Section
        title={<FormattedMessage defaultMessage="Personal records" />}
        description={
          <FormattedMessage defaultMessage="Your all-time bests. Beat them." />
        }
      >
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
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

      <Box>
        <Typography variant="h6" fontWeight="bold">
          <FormattedMessage defaultMessage="Achievements" />
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
          <FormattedMessage defaultMessage="Your accomplishment dashboard — see what you've earned and what's next." />
        </Typography>
      </Box>

      <Card
        sx={{
          p: 3,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(heroColor, 0.12)}, ${alpha(heroColor, 0.03)})`,
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={3}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={2.5} alignItems="center">
            <CompletionRing percent={percent} color={heroColor} />
            <Stack spacing={0.25}>
              <Typography
                variant="overline"
                color="textSecondary"
                fontWeight={700}
                sx={{ lineHeight: 1.4 }}
              >
                <FormattedMessage defaultMessage="Overall progress" />
              </Typography>
              <Typography
                variant="h4"
                fontWeight={800}
                sx={{ lineHeight: 1.1 }}
              >
                <FormattedMessage
                  defaultMessage="{unlocked} / {total} unlocked"
                  values={{ unlocked: unlockedList.length, total }}
                />
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {percent === 100 ? (
                  <FormattedMessage defaultMessage="You've unlocked every achievement. Legendary." />
                ) : (
                  <FormattedMessage defaultMessage="Unlock badges as you build your dictation habit." />
                )}
              </Typography>
            </Stack>
          </Stack>

          <Stack spacing={1.25} sx={{ width: { xs: "100%", sm: "auto" } }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {TIER_ORDER.map((tier) => (
                <TierChip
                  key={tier}
                  tier={tier}
                  unlockedCount={tierStats[tier].unlocked}
                  total={tierStats[tier].total}
                />
              ))}
            </Stack>
            <Button
              size="small"
              variant="outlined"
              startIcon={<IosShareIcon />}
              onClick={() => setShareOpen(true)}
              aria-label="Share your stats"
              sx={{ alignSelf: { xs: "stretch", sm: "flex-end" } }}
            >
              <FormattedMessage defaultMessage="Share your stats" />
            </Button>
          </Stack>
        </Stack>
      </Card>

      {(closestLocked || rarestEarned) && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          {closestLocked && (
            <SpotlightCard
              icon={
                <TrendingUpRoundedIcon
                  sx={{
                    fontSize: 16,
                    color: TIER_COLORS[closestLocked.tier ?? "bronze"],
                  }}
                />
              }
              title={<FormattedMessage defaultMessage="Closest to unlocking" />}
              achievement={closestLocked}
              color={TIER_COLORS[closestLocked.tier ?? "bronze"]}
            />
          )}
          {rarestEarned && (
            <SpotlightCard
              icon={
                <WorkspacePremiumRoundedIcon
                  sx={{
                    fontSize: 16,
                    color: TIER_COLORS[rarestEarned.tier ?? "bronze"],
                  }}
                />
              }
              title={<FormattedMessage defaultMessage="Rarest earned" />}
              achievement={rarestEarned}
              color={TIER_COLORS[rarestEarned.tier ?? "bronze"]}
            />
          )}
        </Stack>
      )}

      <Box>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 1.25 }}
        >
          <Typography variant="subtitle2" fontWeight={700}>
            <FormattedMessage defaultMessage="Earned" />
          </Typography>
          <Chip size="small" label={unlockedList.length} />
        </Stack>
        {unlockedList.length > 0 ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 1.5,
            }}
          >
            {unlockedList.map(renderTile)}
          </Box>
        ) : (
          <Card variant="outlined" sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="body2" color="textSecondary">
              <FormattedMessage defaultMessage="No achievements unlocked yet — keep dictating to earn your first badge." />
            </Typography>
          </Card>
        )}
      </Box>

      <Box>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 1.25 }}
        >
          <Typography variant="subtitle2" fontWeight={700}>
            <FormattedMessage defaultMessage="In progress" />
          </Typography>
          <Chip size="small" label={lockedList.length} />
        </Stack>
        {lockedList.length > 0 ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 1.5,
            }}
          >
            {lockedList.map(renderTile)}
          </Box>
        ) : (
          <Card variant="outlined" sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="body2" color="textSecondary">
              <FormattedMessage defaultMessage="You've unlocked every achievement. There's nothing left to chase — for now." />
            </Typography>
          </Card>
        )}
      </Box>

      {data.topApps.length > 0 && (
        <Section
          title={<FormattedMessage defaultMessage="Top apps" />}
          description={
            <FormattedMessage defaultMessage="Where your words go." />
          }
        >
          <Stack spacing={1.5}>
            {data.topApps.map((a, i) => {
              const pct =
                maxTopAppWords > 0
                  ? Math.round((a.words / maxTopAppWords) * 100)
                  : 0;
              return (
                <Box key={a.app}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 0.5 }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      minWidth={0}
                    >
                      <Box
                        component="span"
                        sx={{
                          width: 22,
                          textAlign: "center",
                          fontSize: i < 3 ? 15 : 13,
                          fontWeight: i < 3 ? 400 : 600,
                          color: i < 3 ? undefined : "text.secondary",
                          flexShrink: 0,
                        }}
                      >
                        {MEDALS[i] ?? i + 1}
                      </Box>
                      <Typography noWrap fontWeight={i < 3 ? 600 : 400}>
                        {a.app}
                      </Typography>
                    </Stack>
                    <Typography
                      color="textSecondary"
                      variant="body2"
                      sx={{ flexShrink: 0, ml: 1 }}
                    >
                      <FormattedMessage
                        defaultMessage="{words} words"
                        values={{ words: a.words.toLocaleString() }}
                      />
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 5,
                      borderRadius: 3,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      "& .MuiLinearProgress-bar": {
                        bgcolor: theme.palette.primary.main,
                        borderRadius: 3,
                      },
                    }}
                  />
                </Box>
              );
            })}
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
