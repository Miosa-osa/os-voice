import { useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RefreshIcon from "@mui/icons-material/Refresh";
import dayjs from "dayjs";
import { FormattedMessage, useIntl } from "react-intl";
import { Section } from "../common/Section";
import {
  MILESTONE_WORDS,
  computeUsage,
  computeVoiceProfile,
  computeWordAnalysis,
  milestoneFor,
} from "../../lib/insights/compute";
import { generateVoiceProfile } from "../../actions/insights.actions";
import { useAppStore } from "../../store";
import { InsightsEmpty } from "./InsightsEmpty";
import { StatCard } from "./StatCard";
import { useInsightsSources } from "./useInsightsData";

const ChipRow = ({ items }: { items: string[] }) =>
  items.length === 0 ? null : (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {items.map((item) => (
        <Chip key={item} label={item} size="small" variant="outlined" />
      ))}
    </Stack>
  );

const ProfileRow = ({
  label,
  value,
}: {
  label: React.ReactNode;
  value: string | null;
}) => (
  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
    <Typography color="textSecondary">{label}</Typography>
    <Typography fontWeight={600} textAlign="right">
      {value ?? "—"}
    </Typography>
  </Stack>
);

export const YourVoiceTab = () => {
  const intl = useIntl();
  const { events, transcriptions, terms } = useInsightsSources();
  const aiProfile = useAppStore((s) => s.insights.aiProfile);
  const aiStatus = useAppStore((s) => s.insights.aiProfileStatus);
  const history = useAppStore((s) => s.local.voiceProfiles ?? []);

  const totalWords = useMemo(
    () => computeUsage(events, transcriptions).totalWords,
    [events, transcriptions],
  );
  const milestone = milestoneFor(totalWords);
  const fallback = useMemo(
    () => computeVoiceProfile(events, transcriptions, terms, milestone),
    [events, transcriptions, terms, milestone],
  );
  const words = useMemo(
    () => computeWordAnalysis(transcriptions),
    [transcriptions],
  );

  useEffect(() => {
    if (totalWords > 0) {
      void generateVoiceProfile();
    }
  }, [totalWords, milestone]);

  if (totalWords === 0) {
    return <InsightsEmpty />;
  }

  const loading = aiStatus === "loading";
  const wordsToNext = (milestone + 1) * MILESTONE_WORDS - totalWords;
  const name = aiProfile?.name ?? fallback.name;
  const identity = aiProfile?.identity ?? fallback.description;

  return (
    <Stack spacing={3}>
      <Card variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Chip
              size="small"
              color={aiProfile?.generated ? "primary" : "default"}
              variant={aiProfile?.generated ? "filled" : "outlined"}
              icon={<AutoAwesomeIcon />}
              label={
                aiProfile?.generated
                  ? intl.formatMessage({ defaultMessage: "AI profile" })
                  : intl.formatMessage({ defaultMessage: "From your stats" })
              }
            />
            <Button
              size="small"
              startIcon={
                loading ? <CircularProgress size={14} /> : <RefreshIcon />
              }
              disabled={loading}
              onClick={() => void generateVoiceProfile({ force: true })}
            >
              {loading ? (
                <FormattedMessage defaultMessage="Analyzing…" />
              ) : (
                <FormattedMessage defaultMessage="Regenerate" />
              )}
            </Button>
          </Stack>

          <Typography variant="h4" fontWeight={700}>
            {name}
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {identity}
          </Typography>

          {aiProfile && aiProfile.traits.length > 0 && (
            <Box pt={1}>
              <ChipRow items={aiProfile.traits} />
            </Box>
          )}

          {aiProfile && aiProfile.topics.length > 0 && (
            <Box pt={0.5}>
              <Typography variant="caption" color="textSecondary">
                <FormattedMessage defaultMessage="Recurring topics" />
              </Typography>
              <Box pt={0.5}>
                <ChipRow items={aiProfile.topics} />
              </Box>
            </Box>
          )}

          {aiProfile?.style && (
            <Typography
              variant="body2"
              color="textSecondary"
              fontStyle="italic"
            >
              {aiProfile.style}
            </Typography>
          )}

          <Typography variant="caption" color="textSecondary">
            <FormattedMessage
              defaultMessage="Refreshes at your next milestone · {n} words to go"
              values={{ n: wordsToNext.toLocaleString() }}
            />
          </Typography>
        </Stack>
      </Card>

      {aiProfile && aiProfile.quirks.length > 0 && (
        <Section title={<FormattedMessage defaultMessage="Speech quirks" />}>
          <ChipRow items={aiProfile.quirks} />
        </Section>
      )}

      <Section title={<FormattedMessage defaultMessage="How you speak" />}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 2,
          }}
        >
          <StatCard
            label={<FormattedMessage defaultMessage="Vocabulary" />}
            value={words.vocabularySize.toLocaleString()}
            hint={<FormattedMessage defaultMessage="distinct words" />}
          />
          <StatCard
            label={<FormattedMessage defaultMessage="Filler rate" />}
            value={`${words.fillerRate}`}
            hint={<FormattedMessage defaultMessage="per 100 words" />}
          />
          <StatCard
            label={<FormattedMessage defaultMessage="Avg sentence" />}
            value={`${words.avgSentenceLength}`}
            hint={<FormattedMessage defaultMessage="words" />}
          />
          <StatCard
            label={<FormattedMessage defaultMessage="Questions" />}
            value={`${words.questionRatio}%`}
            hint={<FormattedMessage defaultMessage="of sentences" />}
          />
        </Box>
        {words.topPhrases.length > 0 && (
          <Box pt={2}>
            <Typography variant="caption" color="textSecondary">
              <FormattedMessage defaultMessage="Your top phrases" />
            </Typography>
            <Box pt={1}>
              <ChipRow items={words.topPhrases.map((p) => p.phrase)} />
            </Box>
          </Box>
        )}
      </Section>

      <Section title={<FormattedMessage defaultMessage="Signature" />}>
        <Stack spacing={2}>
          <ProfileRow
            label={<FormattedMessage defaultMessage="Catchphrase" />}
            value={fallback.catchphrase}
          />
          <ProfileRow
            label={<FormattedMessage defaultMessage="Most used word" />}
            value={fallback.mostUsedWord}
          />
          <ProfileRow
            label={<FormattedMessage defaultMessage="Most corrected word" />}
            value={fallback.mostCorrectedWord}
          />
        </Stack>
      </Section>

      <Section title={<FormattedMessage defaultMessage="Peak time & place" />}>
        <Stack spacing={2}>
          <ProfileRow
            label={<FormattedMessage defaultMessage="Peak time" />}
            value={fallback.peakHourLabel}
          />
          <ProfileRow
            label={<FormattedMessage defaultMessage="Busiest day" />}
            value={fallback.peakWeekday}
          />
          <ProfileRow
            label={<FormattedMessage defaultMessage="Top app" />}
            value={fallback.topApp}
          />
        </Stack>
      </Section>

      {history.length > 0 && (
        <Section
          title={<FormattedMessage defaultMessage="Milestone history" />}
        >
          <Stack spacing={1.5}>
            {history
              .slice()
              .reverse()
              .map((h) => (
                <Stack
                  key={h.milestone}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{
                    borderLeft: 2,
                    borderColor: "primary.main",
                    pl: 1.5,
                    py: 0.5,
                  }}
                >
                  <Box>
                    <Typography fontWeight={600}>{h.profile.name}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      <FormattedMessage
                        defaultMessage="{k}k words · {date}"
                        values={{
                          k: (h.milestone + 1) * (MILESTONE_WORDS / 1000),
                          date: dayjs(h.createdAt).format("MMM D"),
                        }}
                      />
                    </Typography>
                  </Box>
                  {h.catchphrase && (
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      sx={{ maxWidth: 160, textAlign: "right" }}
                      noWrap
                    >
                      “{h.catchphrase}”
                    </Typography>
                  )}
                </Stack>
              ))}
          </Stack>
        </Section>
      )}
    </Stack>
  );
};
