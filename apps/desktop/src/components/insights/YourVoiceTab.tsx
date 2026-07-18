import { useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import dayjs from "dayjs";
import { FormattedMessage, useIntl } from "react-intl";
import { Section } from "../common/Section";
import {
  PROFILE_UNLOCK_WORDS,
  SIGNATURE_UNLOCK_WORDS,
  WORD_ANALYSIS_UNLOCK_WORDS,
  computeCoachingTrend,
  computeRecentDictationsSummary,
  computeUsage,
  computeVoiceProfile,
  computeWordAnalysis,
  computeWordCloud,
  milestoneFor,
  nextMilestoneWords,
} from "../../lib/insights/compute";
import {
  computeCoachingDrills,
  computeCommunicationScore,
  computeFocusThisWeek,
  gradeColor,
} from "../../lib/insights/coaching";
import { generateVoiceProfile } from "../../actions/insights.actions";
import { useAppStore } from "../../store";
import { InsightsEmpty } from "./InsightsEmpty";
import { MiniLine } from "./MiniLine";
import { StatCard } from "./StatCard";
import { useInsightsSources } from "./useInsightsData";
import { WordCloud } from "./WordCloud";

const ChipRow = ({ items }: { items: string[] }) =>
  items.length === 0 ? null : (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {items.map((item) => (
        <Chip key={item} label={item} size="small" variant="outlined" />
      ))}
    </Stack>
  );

const BulletList = ({
  items,
  color = "text.secondary",
}: {
  items: string[];
  color?: string;
}) => (
  <Stack spacing={0.75}>
    {items.map((item, i) => (
      <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
        <Box
          sx={{
            mt: "7px",
            width: 6,
            height: 6,
            borderRadius: "50%",
            bgcolor: color,
            flexShrink: 0,
          }}
        />
        <Typography variant="body2" color="textSecondary">
          {item}
        </Typography>
      </Stack>
    ))}
  </Stack>
);

const CoachingGroup = ({
  color,
  label,
  items,
}: {
  color: string;
  label: React.ReactNode;
  items: string[];
}) => (
  <Box>
    <Typography
      variant="overline"
      sx={{ color, display: "block", fontWeight: 700 }}
    >
      {label}
    </Typography>
    <Box sx={{ mt: 0.5 }}>
      <BulletList items={items} color={color} />
    </Box>
  </Box>
);

const CommunicationScoreGauge = ({
  score,
  grade,
  color,
}: {
  score: number;
  grade: string;
  color: "success" | "info" | "warning" | "error";
}) => (
  <Box sx={{ position: "relative", display: "inline-flex" }}>
    <CircularProgress
      variant="determinate"
      value={100}
      size={88}
      thickness={4}
      sx={{ color: (theme) => alpha(theme.palette.text.primary, 0.08) }}
    />
    <CircularProgress
      variant="determinate"
      value={score}
      size={88}
      thickness={4}
      color={color}
      sx={{ position: "absolute", left: 0 }}
    />
    <Box
      sx={{
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        position: "absolute",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1 }}>
        {grade}
      </Typography>
      <Typography variant="caption" color="textSecondary">
        {score}/100
      </Typography>
    </Box>
  </Box>
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

const LockedSection = ({
  title,
  unlockAt,
  totalWords,
}: {
  title: React.ReactNode;
  unlockAt: number;
  totalWords: number;
}) => (
  <Section title={title}>
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{ py: 1, opacity: 0.75 }}
    >
      <LockOutlinedIcon fontSize="small" color="disabled" />
      <Typography variant="body2" color="textSecondary">
        <FormattedMessage
          defaultMessage="Unlocks at {n} words · {left} to go"
          values={{
            n: unlockAt.toLocaleString(),
            left: (unlockAt - totalWords).toLocaleString(),
          }}
        />
      </Typography>
    </Stack>
  </Section>
);

export const YourVoiceTab = () => {
  const intl = useIntl();
  const theme = useTheme();
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
  const cloud = useMemo(
    () => computeWordCloud(transcriptions),
    [transcriptions],
  );
  const recentTerms = useMemo(
    () =>
      terms
        .slice()
        .sort(
          (a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf(),
        )
        .slice(0, 12),
    [terms],
  );
  const coachingTrend = useMemo(() => computeCoachingTrend(history), [history]);
  const recentSummary = useMemo(
    () => computeRecentDictationsSummary(transcriptions, 20),
    [transcriptions],
  );
  const communicationScore = useMemo(
    () => computeCommunicationScore(words),
    [words],
  );
  const focusThisWeek = useMemo(
    () => computeFocusThisWeek(words, communicationScore),
    [words, communicationScore],
  );
  const coachingDrills = useMemo(() => computeCoachingDrills(words), [words]);

  useEffect(() => {
    if (totalWords >= PROFILE_UNLOCK_WORDS) {
      void generateVoiceProfile();
    }
  }, [totalWords, milestone]);

  if (totalWords === 0) {
    return <InsightsEmpty />;
  }

  if (totalWords < PROFILE_UNLOCK_WORDS) {
    const pct = Math.min(
      100,
      Math.round((totalWords / PROFILE_UNLOCK_WORDS) * 100),
    );
    return (
      <Card variant="outlined" sx={{ p: 4 }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <AutoAwesomeIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>
            <FormattedMessage defaultMessage="Your voice profile is warming up" />
          </Typography>
          <Typography color="textSecondary">
            <FormattedMessage
              defaultMessage="It unlocks at {n} words — {left} to go. Keep dictating and we'll build a profile of how you speak."
              values={{
                n: PROFILE_UNLOCK_WORDS.toLocaleString(),
                left: (PROFILE_UNLOCK_WORDS - totalWords).toLocaleString(),
              }}
            />
          </Typography>
          <Box sx={{ width: "100%", maxWidth: 340 }}>
            <LinearProgress variant="determinate" value={pct} />
            <Typography variant="caption" color="textSecondary">
              {`${totalWords.toLocaleString()} / ${PROFILE_UNLOCK_WORDS.toLocaleString()}`}
            </Typography>
          </Box>
        </Stack>
      </Card>
    );
  }

  const loading = aiStatus === "loading";
  const next = nextMilestoneWords(totalWords);
  const wordsToNext = next === null ? null : next - totalWords;
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

          {aiProfile?.recentActivity && (
            <Typography variant="body2" color="textSecondary">
              {aiProfile.recentActivity}
            </Typography>
          )}

          {(aiProfile?.tone || aiProfile?.whatsChanged) && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {aiProfile?.tone && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={intl.formatMessage(
                    { defaultMessage: "Tone: {t}" },
                    { t: aiProfile.tone },
                  )}
                />
              )}
              {aiProfile?.whatsChanged && (
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={aiProfile.whatsChanged}
                />
              )}
            </Stack>
          )}

          <Typography variant="caption" color="textSecondary">
            {wordsToNext === null ? (
              <FormattedMessage defaultMessage="You've reached the top milestone — your profile keeps living, refreshing itself as you keep dictating." />
            ) : (
              <FormattedMessage
                defaultMessage="Evolves at your next milestone ({n} words to go) — and keeps quietly refreshing as you dictate more."
                values={{ n: wordsToNext.toLocaleString() }}
              />
            )}
          </Typography>
        </Stack>
      </Card>

      {aiProfile?.portrait && (
        <Card
          variant="outlined"
          sx={{
            p: 3,
            borderRadius: 3,
            borderColor: alpha(theme.palette.primary.main, 0.3),
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.primary.main, 0.02)})`,
          }}
        >
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AutoAwesomeIcon color="primary" fontSize="small" />
              <Typography variant="overline" color="primary" fontWeight={700}>
                <FormattedMessage defaultMessage="Your portrait" />
              </Typography>
            </Stack>
            <Typography variant="h6" fontWeight={500} sx={{ lineHeight: 1.5 }}>
              {aiProfile.portrait}
            </Typography>
          </Stack>
        </Card>
      )}

      {aiProfile && (aiProfile.personality?.length ?? 0) > 0 && (
        <Section title={<FormattedMessage defaultMessage="Personality" />}>
          <ChipRow items={aiProfile.personality ?? []} />
        </Section>
      )}

      {aiProfile && (aiProfile.motivations?.length ?? 0) > 0 && (
        <Section title={<FormattedMessage defaultMessage="What drives you" />}>
          <BulletList
            items={aiProfile.motivations ?? []}
            color="primary.main"
          />
        </Section>
      )}

      {aiProfile && (aiProfile.mindsetPatterns?.length ?? 0) > 0 && (
        <Section
          title={<FormattedMessage defaultMessage="How your mind moves" />}
        >
          <BulletList
            items={aiProfile.mindsetPatterns ?? []}
            color="info.main"
          />
        </Section>
      )}

      {aiProfile?.howYouThink && (
        <Section title={<FormattedMessage defaultMessage="How you think" />}>
          <Typography variant="body2" color="textSecondary">
            {aiProfile.howYouThink}
          </Typography>
        </Section>
      )}

      {aiProfile && (aiProfile.ubiquitousLanguage?.length ?? 0) > 0 && (
        <Section
          title={<FormattedMessage defaultMessage="Your ubiquitous language" />}
          description={
            <FormattedMessage defaultMessage="The words and phrases you live in — the vocabulary that's distinctly yours." />
          }
        >
          <ChipRow items={aiProfile.ubiquitousLanguage ?? []} />
        </Section>
      )}

      {aiProfile && (aiProfile.whatYouCareAbout?.length ?? 0) > 0 && (
        <Section
          title={<FormattedMessage defaultMessage="What you care about" />}
        >
          <ChipRow items={aiProfile.whatYouCareAbout ?? []} />
        </Section>
      )}

      {aiProfile && (aiProfile.expertise?.length ?? 0) > 0 && (
        <Section title={<FormattedMessage defaultMessage="Your expertise" />}>
          <ChipRow items={aiProfile.expertise ?? []} />
        </Section>
      )}

      {aiProfile && aiProfile.quirks.length > 0 && (
        <Section title={<FormattedMessage defaultMessage="Speech quirks" />}>
          <ChipRow items={aiProfile.quirks} />
        </Section>
      )}

      {aiProfile?.communicationSuperpower && (
        <Section
          title={
            <FormattedMessage defaultMessage="Your communication superpower" />
          }
        >
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <BoltRoundedIcon color="primary" sx={{ mt: "2px" }} />
            <Typography variant="body1" fontWeight={600}>
              {aiProfile.communicationSuperpower}
            </Typography>
          </Stack>
        </Section>
      )}

      {totalWords >= WORD_ANALYSIS_UNLOCK_WORDS ? (
        <Section title={<FormattedMessage defaultMessage="How you speak" />}>
          {aiProfile?.howYouSpeak && (
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              {aiProfile.howYouSpeak}
            </Typography>
          )}
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
      ) : (
        <LockedSection
          title={<FormattedMessage defaultMessage="How you speak" />}
          unlockAt={WORD_ANALYSIS_UNLOCK_WORDS}
          totalWords={totalWords}
        />
      )}

      {aiProfile?.howOthersExperienceYou && (
        <Section
          title={<FormattedMessage defaultMessage="How you come across" />}
        >
          <Typography variant="body2" color="textSecondary">
            {aiProfile.howOthersExperienceYou}
          </Typography>
        </Section>
      )}

      {aiProfile && (aiProfile.blindSpots?.length ?? 0) > 0 && (
        <Section
          title={<FormattedMessage defaultMessage="Blind spots" />}
          description={
            <FormattedMessage defaultMessage="Patterns worth noticing — not judgments, just honest observations." />
          }
        >
          <BulletList
            items={aiProfile.blindSpots ?? []}
            color="text.secondary"
          />
        </Section>
      )}

      {(() => {
        const hasCoachingContent = Boolean(
          aiProfile?.coaching &&
          (aiProfile.coaching.strengths.length > 0 ||
            aiProfile.coaching.growthAreas.length > 0 ||
            aiProfile.coaching.suggestions.length > 0),
        );
        const hasTrend = Boolean(
          coachingTrend && coachingTrend.summary.length > 0,
        );
        if (!hasCoachingContent && !hasTrend && !recentSummary) return null;

        return (
          <Section
            title={<FormattedMessage defaultMessage="Coaching" />}
            description={
              <FormattedMessage defaultMessage="An honest, grounded read on how you speak — what's working and what to try next." />
            }
          >
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2.5}
                alignItems={{ xs: "flex-start", sm: "center" }}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: 1,
                  borderColor: "divider",
                }}
              >
                <CommunicationScoreGauge
                  score={communicationScore.score}
                  grade={communicationScore.grade}
                  color={gradeColor(communicationScore.grade)}
                />
                <Stack spacing={0.75} sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    <FormattedMessage defaultMessage="Communication score" />
                  </Typography>
                  {communicationScore.lift && (
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <TrendingUpIcon
                        fontSize="small"
                        color="success"
                        sx={{ mt: "1px" }}
                      />
                      <Typography variant="body2" color="textSecondary">
                        {communicationScore.lift}
                      </Typography>
                    </Stack>
                  )}
                  {communicationScore.drag && (
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <TrendingDownIcon
                        fontSize="small"
                        color="warning"
                        sx={{ mt: "1px" }}
                      />
                      <Typography variant="body2" color="textSecondary">
                        {communicationScore.drag}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Stack>

              {focusThisWeek && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.primary.main, 0.02)})`,
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <FlagRoundedIcon color="primary" sx={{ mt: "2px" }} />
                    <Stack spacing={0.5}>
                      <Typography
                        variant="overline"
                        color="primary"
                        fontWeight={700}
                        sx={{ lineHeight: 1.2 }}
                      >
                        <FormattedMessage defaultMessage="Focus this week" />
                      </Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {focusThisWeek.title}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {focusThisWeek.detail}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              )}

              {hasTrend && coachingTrend && (
                <Box>
                  <Typography
                    variant="overline"
                    sx={{
                      color: "info.main",
                      display: "block",
                      fontWeight: 700,
                    }}
                  >
                    <FormattedMessage defaultMessage="Did I improve?" />
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                    {coachingTrend.summary.map((item, i) => (
                      <Stack
                        key={i}
                        direction="row"
                        spacing={1}
                        alignItems="flex-start"
                      >
                        {item.direction === "positive" ? (
                          <TrendingUpIcon
                            fontSize="small"
                            color="success"
                            sx={{ mt: "1px" }}
                          />
                        ) : (
                          <TrendingDownIcon
                            fontSize="small"
                            color="warning"
                            sx={{ mt: "1px" }}
                          />
                        )}
                        <Typography variant="body2" color="textSecondary">
                          {item.text}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                  {coachingTrend.fillerPoints.length >= 2 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="textSecondary">
                        <FormattedMessage defaultMessage="Filler rate over time" />
                      </Typography>
                      <MiniLine data={coachingTrend.fillerPoints} height={48} />
                    </Box>
                  )}
                </Box>
              )}

              {aiProfile?.coaching?.strengths &&
                aiProfile.coaching.strengths.length > 0 && (
                  <CoachingGroup
                    color="success.main"
                    label={
                      <FormattedMessage defaultMessage="What you do well" />
                    }
                    items={aiProfile.coaching.strengths}
                  />
                )}
              {aiProfile?.coaching?.growthAreas &&
                aiProfile.coaching.growthAreas.length > 0 && (
                  <CoachingGroup
                    color="warning.main"
                    label={<FormattedMessage defaultMessage="Where to grow" />}
                    items={aiProfile.coaching.growthAreas}
                  />
                )}
              {aiProfile?.coaching?.suggestions &&
                aiProfile.coaching.suggestions.length > 0 && (
                  <CoachingGroup
                    color="primary.main"
                    label={<FormattedMessage defaultMessage="Try this next" />}
                    items={aiProfile.coaching.suggestions}
                  />
                )}

              {coachingDrills.length > 0 && (
                <Box>
                  <Typography
                    variant="overline"
                    sx={{
                      color: "secondary.main",
                      display: "block",
                      fontWeight: 700,
                    }}
                  >
                    <FormattedMessage defaultMessage="Drills to practice" />
                  </Typography>
                  <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                    {coachingDrills.map((drill) => (
                      <Box key={drill.area}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ mb: 0.5 }}
                        >
                          <FitnessCenterRoundedIcon
                            fontSize="small"
                            color="secondary"
                          />
                          <Typography variant="body2" fontWeight={700}>
                            {drill.area}
                          </Typography>
                        </Stack>
                        <BulletList items={drill.tips} color="secondary.main" />
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {recentSummary && (
                <Box>
                  <Typography
                    variant="overline"
                    color="textSecondary"
                    sx={{ display: "block", fontWeight: 700 }}
                  >
                    <FormattedMessage defaultMessage="Across your recent dictations" />
                  </Typography>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    sx={{ mt: 0.5 }}
                  >
                    <FormattedMessage
                      defaultMessage="Looking at your last {count} dictations: about {fillerRate} filler words per 100, {avgLen}-word sentences on average, and {q}% phrased as questions."
                      values={{
                        count: recentSummary.count,
                        fillerRate: recentSummary.words.fillerRate,
                        avgLen: recentSummary.words.avgSentenceLength,
                        q: recentSummary.words.questionRatio,
                      }}
                    />
                  </Typography>
                </Box>
              )}
            </Stack>
          </Section>
        );
      })()}

      {totalWords >= SIGNATURE_UNLOCK_WORDS ? (
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
      ) : (
        <LockedSection
          title={<FormattedMessage defaultMessage="Signature" />}
          unlockAt={SIGNATURE_UNLOCK_WORDS}
          totalWords={totalWords}
        />
      )}

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

      {cloud.length > 0 && (
        <Section title={<FormattedMessage defaultMessage="Your word cloud" />}>
          <WordCloud words={cloud} />
        </Section>
      )}

      {recentTerms.length > 0 && (
        <Section
          title={<FormattedMessage defaultMessage="Recently learned" />}
          description={
            <FormattedMessage defaultMessage="Words OS Voice has picked up from your corrections and dictionary." />
          }
        >
          <Stack spacing={1}>
            {recentTerms.map((t) => (
              <Stack
                key={t.id}
                direction="row"
                justifyContent="space-between"
                alignItems="baseline"
              >
                <Typography fontWeight={600}>{t.destinationValue}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {dayjs(t.createdAt).format("MMM D")}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Section>
      )}

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
                        defaultMessage="{n} words · {date}"
                        values={{
                          n: h.totalWords.toLocaleString(),
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
                      {`“${h.catchphrase}”`}
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
