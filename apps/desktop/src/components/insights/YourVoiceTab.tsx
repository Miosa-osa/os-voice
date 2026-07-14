import { useMemo } from "react";
import { Card, Stack, Typography } from "@mui/material";
import { FormattedMessage } from "react-intl";
import { Section } from "../common/Section";
import {
  MILESTONE_WORDS,
  computeUsage,
  computeVoiceProfile,
  milestoneFor,
} from "../../lib/insights/compute";
import { InsightsEmpty } from "./InsightsEmpty";
import { useInsightsSources } from "./useInsightsData";

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
  const { events, transcriptions, terms } = useInsightsSources();

  const totalWords = useMemo(
    () => computeUsage(events, transcriptions).totalWords,
    [events, transcriptions],
  );
  const milestone = milestoneFor(totalWords);
  const profile = useMemo(
    () => computeVoiceProfile(events, transcriptions, terms, milestone),
    [events, transcriptions, terms, milestone],
  );

  if (totalWords === 0) {
    return <InsightsEmpty />;
  }

  const wordsToNext = (milestone + 1) * MILESTONE_WORDS - totalWords;

  return (
    <Stack spacing={3}>
      <Card sx={{ p: 3 }}>
        <Stack spacing={1}>
          <Typography variant="overline" color="textSecondary">
            <FormattedMessage defaultMessage="Your voice profile" />
          </Typography>
          <Typography variant="h4" fontWeight={700}>
            {profile.name}
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {profile.description}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            <FormattedMessage
              defaultMessage="Refreshes in {n} words"
              values={{ n: wordsToNext.toLocaleString() }}
            />
          </Typography>
        </Stack>
      </Card>

      <Section title={<FormattedMessage defaultMessage="Signature" />}>
        <Stack spacing={2}>
          <ProfileRow
            label={<FormattedMessage defaultMessage="Catchphrase" />}
            value={profile.catchphrase}
          />
          <ProfileRow
            label={<FormattedMessage defaultMessage="Most used word" />}
            value={profile.mostUsedWord}
          />
          <ProfileRow
            label={<FormattedMessage defaultMessage="Most corrected word" />}
            value={profile.mostCorrectedWord}
          />
        </Stack>
      </Section>

      <Section title={<FormattedMessage defaultMessage="Peak time & place" />}>
        <Stack spacing={2}>
          <ProfileRow
            label={<FormattedMessage defaultMessage="Peak time" />}
            value={profile.peakHourLabel}
          />
          <ProfileRow
            label={<FormattedMessage defaultMessage="Busiest day" />}
            value={profile.peakWeekday}
          />
          <ProfileRow
            label={<FormattedMessage defaultMessage="Top app" />}
            value={profile.topApp}
          />
        </Stack>
      </Section>
    </Stack>
  );
};
