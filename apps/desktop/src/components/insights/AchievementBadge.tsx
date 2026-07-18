import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Achievement, AchievementTier } from "../../lib/insights/compute";

export const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: "#CD7F32",
  silver: "#9CA3AF",
  gold: "#F5B700",
  platinum: "#7DD3FC",
};

const SIZE = 48;
const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// A tier-colored badge with an emoji and a progress ring for locked
// achievements, plus a subtle "pop" animation for unlocked ones.
export const AchievementBadge = ({
  achievement,
}: {
  achievement: Achievement;
}) => {
  const theme = useTheme();
  const tier = achievement.tier ?? "bronze";
  const emoji = achievement.emoji ?? "🏆";
  const color = TIER_COLORS[tier];
  const progress = Math.max(0, Math.min(1, achievement.progress));
  const dash = CIRCUMFERENCE * progress;

  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box
        sx={{
          position: "relative",
          width: SIZE,
          height: SIZE,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...(achievement.unlocked && {
            animation: "achievementPop 0.5s ease-out",
            "@keyframes achievementPop": {
              "0%": { transform: "scale(0.6)", opacity: 0 },
              "70%": { transform: "scale(1.12)", opacity: 1 },
              "100%": { transform: "scale(1)", opacity: 1 },
            },
          }),
        }}
      >
        <svg
          width={SIZE}
          height={SIZE}
          style={{ position: "absolute", inset: 0 }}
          aria-hidden="true"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={alpha(color, 0.15)}
            strokeWidth={3}
          />
          {!achievement.unlocked && (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          )}
        </svg>
        <Box
          sx={{
            width: SIZE - 12,
            height: SIZE - 12,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: achievement.unlocked ? 20 : 16,
            lineHeight: 1,
            bgcolor: achievement.unlocked
              ? alpha(color, 0.18)
              : alpha(theme.palette.text.disabled, 0.08),
            filter: achievement.unlocked ? "none" : "grayscale(1)",
            opacity: achievement.unlocked ? 1 : 0.5,
          }}
        >
          <span role="img" aria-label={achievement.label}>
            {emoji}
          </span>
        </Box>
      </Box>
      <Box flex={1} minWidth={0}>
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="flex-start"
          sx={{ minWidth: 0 }}
        >
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{
              minWidth: 0,
              overflowWrap: "anywhere",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {achievement.label}
          </Typography>
          <Box
            component="span"
            sx={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              color,
              border: `1px solid ${alpha(color, 0.4)}`,
              borderRadius: 0.75,
              px: 0.5,
              py: 0.1,
              mt: 0.25,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {tier}
          </Box>
        </Stack>
        <Typography
          variant="caption"
          color="textSecondary"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            overflowWrap: "anywhere",
          }}
        >
          {achievement.description}
        </Typography>
      </Box>
    </Stack>
  );
};
