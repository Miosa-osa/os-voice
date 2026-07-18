import { useMemo } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import dayjs from "dayjs";
import { FormattedMessage, useIntl } from "react-intl";
import { Section } from "../common/Section";
import {
  booksComparison,
  computeEfficiency,
  computeMilestoneOutlook,
  computeMomentum,
  computePredictions,
  computeRhythm,
  computeSessionStats,
  computeTrends,
  computeUsage,
  computeUsageExtras,
  computeWeekComparison,
  computeWordComparisons,
} from "../../lib/insights/compute";
import { DailyActivity } from "./DailyActivity";
import { InsightsEmpty } from "./InsightsEmpty";
import { MiniBars } from "./MiniBars";
import { MiniLine } from "./MiniLine";
import { StatCard } from "./StatCard";
import { useInsightsSources } from "./useInsightsData";

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => {
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${period}`;
});

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DeltaIndicator = ({ pct }: { pct: number | null }) => {
  if (pct === null) return null;
  if (pct === 0) {
    return <TrendingFlatIcon fontSize="small" color="disabled" />;
  }
  return pct > 0 ? (
    <TrendingUpIcon fontSize="small" color="success" />
  ) : (
    <TrendingDownIcon fontSize="small" color="error" />
  );
};

const DeltaLabel = ({ pct }: { pct: number | null }) => {
  if (pct === null) return <>—</>;
  return (
    <FormattedMessage
      defaultMessage="{sign}{pct}% vs last week"
      values={{ sign: pct > 0 ? "+" : "", pct }}
    />
  );
};

export const YourUsageTab = () => {
  const intl = useIntl();
  const { events, transcriptions } = useInsightsSources();
  const usage = useMemo(
    () => computeUsage(events, transcriptions),
    [events, transcriptions],
  );
  const extras = useMemo(
    () => computeUsageExtras(events, transcriptions),
    [events, transcriptions],
  );
  const books = useMemo(
    () => booksComparison(usage.totalWords),
    [usage.totalWords],
  );
  const wordComparisons = useMemo(
    () => computeWordComparisons(usage.totalWords),
    [usage.totalWords],
  );
  const momentum = useMemo(
    () => computeMomentum(events, transcriptions),
    [events, transcriptions],
  );
  const weekComparison = useMemo(
    () => computeWeekComparison(transcriptions),
    [transcriptions],
  );
  const rhythm = useMemo(() => computeRhythm(transcriptions), [transcriptions]);
  const sessionStats = useMemo(
    () => computeSessionStats(transcriptions),
    [transcriptions],
  );
  const efficiency = useMemo(
    () => computeEfficiency(events, transcriptions),
    [events, transcriptions],
  );
  const trends = useMemo(() => computeTrends(transcriptions), [transcriptions]);
  const predictions = useMemo(
    () => computePredictions(events, transcriptions),
    [events, transcriptions],
  );
  const milestoneOutlook = useMemo(
    () => computeMilestoneOutlook(events, transcriptions),
    [events, transcriptions],
  );

  if (usage.totalDictations === 0) {
    return <InsightsEmpty />;
  }

  const chronotypeMessage = (() => {
    switch (rhythm.chronotype) {
      case "morning":
        return intl.formatMessage({
          defaultMessage: "You're a morning dictator — most words before noon.",
        });
      case "afternoon":
        return intl.formatMessage({
          defaultMessage: "You're an afternoon dictator — your peak is midday.",
        });
      case "evening":
        return intl.formatMessage({
          defaultMessage:
            "You're an evening dictator — you pick up after work.",
        });
      case "night":
        return intl.formatMessage({
          defaultMessage: "You're a night owl — most words after 10pm.",
        });
      default:
        return null;
    }
  })();

  return (
    <Stack spacing={3}>
      {/* Hero: the 2-3 numbers that matter at a glance, today. */}
      <Stack spacing={1.5}>
        <Typography variant="h6" fontWeight="bold">
          <FormattedMessage defaultMessage="Today" />
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <StatCard
            size="hero"
            value={momentum.wordsToday.toLocaleString()}
            label={<FormattedMessage defaultMessage="Words today" />}
          />
          <StatCard
            size="hero"
            value={momentum.wpmToday || "—"}
            label={<FormattedMessage defaultMessage="WPM today" />}
            hint={
              momentum.paceVsAvgPct !== 0 ? (
                <FormattedMessage
                  defaultMessage="{pct}% vs your average"
                  values={{
                    pct:
                      momentum.paceVsAvgPct > 0
                        ? `+${momentum.paceVsAvgPct}`
                        : momentum.paceVsAvgPct,
                  }}
                />
              ) : undefined
            }
          />
          <StatCard
            size="hero"
            value={momentum.currentStreak}
            label={<FormattedMessage defaultMessage="Day streak" />}
          />
        </Stack>
      </Stack>

      {/* This week: a compact strip of week-over-week deltas. */}
      <Stack spacing={1.5}>
        <Typography variant="subtitle1" fontWeight={700} color="textSecondary">
          <FormattedMessage defaultMessage="This week" />
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <StatCard
            label={<FormattedMessage defaultMessage="Words this week" />}
            value={weekComparison.wordsThisWeek.toLocaleString()}
            hint={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <DeltaIndicator pct={weekComparison.wordsDeltaPct} />
                <DeltaLabel pct={weekComparison.wordsDeltaPct} />
              </Stack>
            }
          />
          <StatCard
            label={<FormattedMessage defaultMessage="Pace this week" />}
            value={weekComparison.wpmThisWeek || "—"}
            hint={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <DeltaIndicator pct={weekComparison.wpmDeltaPct} />
                <DeltaLabel pct={weekComparison.wpmDeltaPct} />
              </Stack>
            }
          />
          <StatCard
            label={<FormattedMessage defaultMessage="Active days" />}
            value={weekComparison.activeDaysThisWeek}
            hint={
              <FormattedMessage
                defaultMessage="{delta} vs last week ({last} days)"
                values={{
                  delta:
                    weekComparison.activeDaysDelta > 0
                      ? `+${weekComparison.activeDaysDelta}`
                      : weekComparison.activeDaysDelta,
                  last: weekComparison.activeDaysLastWeek,
                }}
              />
            }
          />
          <StatCard
            label={<FormattedMessage defaultMessage="On pace this week" />}
            value={momentum.weekProjection.toLocaleString()}
          />
          <StatCard
            label={<FormattedMessage defaultMessage="Vs your best week" />}
            value={
              weekComparison.paceVsBestWeekPct !== null
                ? `${weekComparison.paceVsBestWeekPct}%`
                : "—"
            }
            hint={
              <FormattedMessage
                defaultMessage="Best week: {words} words"
                values={{
                  words: weekComparison.personalBestWeekWords.toLocaleString(),
                }}
              />
            }
          />
        </Stack>
      </Stack>

      {/* Everything else: demoted behind a single "Detailed stats" toggle so
          a casual glance stays short, while all the data stays reachable. */}
      <Accordion
        disableGutters
        elevation={0}
        sx={{
          "&:before": { display: "none" },
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" fontWeight="bold">
            <FormattedMessage defaultMessage="Detailed stats" />
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <Section title={<FormattedMessage defaultMessage="Overview" />}>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <StatCard
                  size="compact"
                  value={usage.wpm}
                  label={<FormattedMessage defaultMessage="Words per minute" />}
                />
                <StatCard
                  size="compact"
                  value={usage.fixes.toLocaleString()}
                  label={
                    <FormattedMessage defaultMessage="Fixes by OS Voice" />
                  }
                />
                <StatCard
                  size="compact"
                  value={usage.wordsThisMonth.toLocaleString()}
                  label={<FormattedMessage defaultMessage="Words this month" />}
                />
                <StatCard
                  size="compact"
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
            </Section>

            <Section
              title={<FormattedMessage defaultMessage="Daily activity" />}
            >
              <DailyActivity
                usage={usage}
                extras={extras}
                events={events}
                transcriptions={transcriptions}
              />
            </Section>

            <Section
              title={<FormattedMessage defaultMessage="When you dictate" />}
              description={
                <FormattedMessage defaultMessage="Your rhythm by hour of day and day of week." />
              }
            >
              <Stack spacing={2.5}>
                <Stack spacing={1}>
                  <Typography variant="body2" color="textSecondary">
                    <FormattedMessage defaultMessage="By hour of day" />
                  </Typography>
                  <MiniBars data={rhythm.hourBars} labels={HOUR_LABELS} />
                </Stack>
                <Stack spacing={1}>
                  <Typography variant="body2" color="textSecondary">
                    <FormattedMessage defaultMessage="By day of week" />
                  </Typography>
                  <MiniBars data={rhythm.weekdayBars} labels={WEEKDAY_LABELS} />
                </Stack>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  <StatCard
                    size="compact"
                    label={<FormattedMessage defaultMessage="Consistency" />}
                    value={`${rhythm.consistencyScore}`}
                    hint={
                      <FormattedMessage defaultMessage="0-100 · higher = more even, less bursty" />
                    }
                  />
                  <StatCard
                    size="compact"
                    label={<FormattedMessage defaultMessage="Peak day" />}
                    value={rhythm.peakWeekdayLabel ?? "—"}
                  />
                  <StatCard
                    size="compact"
                    label={<FormattedMessage defaultMessage="Peak hour" />}
                    value={rhythm.peakHourLabel ?? "—"}
                  />
                </Stack>
                {chronotypeMessage && (
                  <Typography variant="body2" color="textSecondary">
                    {chronotypeMessage}
                  </Typography>
                )}
                {extras.bestDay && (
                  <Typography variant="body2" color="textSecondary">
                    <FormattedMessage
                      defaultMessage="Most productive day: {words} words on {date}"
                      values={{
                        words: extras.bestDay.words.toLocaleString(),
                        date: dayjs(extras.bestDay.day).format("MMM D, YYYY"),
                      }}
                    />
                  </Typography>
                )}
              </Stack>
            </Section>

            <Section title={<FormattedMessage defaultMessage="Trends" />}>
              <Stack spacing={2.5}>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="textSecondary">
                    <FormattedMessage defaultMessage="Speaking pace, words per minute (weekly)" />
                    {trends.wpmDeltaPct !== 0 && (
                      <FormattedMessage
                        defaultMessage=" · {pct}% vs last week"
                        values={{
                          pct:
                            trends.wpmDeltaPct > 0
                              ? `+${trends.wpmDeltaPct}`
                              : trends.wpmDeltaPct,
                        }}
                      />
                    )}
                  </Typography>
                  <MiniLine data={trends.wpmWeekly} />
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="textSecondary">
                    <FormattedMessage defaultMessage="Vocabulary growth, unique words used (cumulative)" />
                  </Typography>
                  <MiniLine data={trends.vocabGrowth} />
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="textSecondary">
                    <FormattedMessage defaultMessage="Filler words per 100 words (weekly)" />
                  </Typography>
                  <MiniBars
                    data={trends.fillerWeekly.map((p) => p.value)}
                    labels={trends.fillerWeekly.map((p) => p.label)}
                  />
                </Stack>
              </Stack>
            </Section>

            <Section
              title={<FormattedMessage defaultMessage="Sessions" />}
              description={
                <FormattedMessage defaultMessage="How long a typical dictation runs, and how that's changing." />
              }
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  <StatCard
                    size="compact"
                    label={
                      <FormattedMessage defaultMessage="Avg words / dictation" />
                    }
                    value={sessionStats.avgWordsPerSession.toLocaleString()}
                  />
                  <StatCard
                    size="compact"
                    label={
                      <FormattedMessage defaultMessage="Typical (median)" />
                    }
                    value={sessionStats.medianWordsPerSession.toLocaleString()}
                  />
                  <StatCard
                    size="compact"
                    label={
                      <FormattedMessage defaultMessage="Longest dictation" />
                    }
                    value={sessionStats.longestSessionWords.toLocaleString()}
                    hint={
                      sessionStats.longestSessionDate
                        ? dayjs(sessionStats.longestSessionDate).format(
                            "MMM D, YYYY",
                          )
                        : undefined
                    }
                  />
                  <StatCard
                    size="compact"
                    label={
                      <FormattedMessage defaultMessage="Dictations / active day" />
                    }
                    value={sessionStats.sessionsPerActiveDay || "—"}
                  />
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="textSecondary">
                    <FormattedMessage defaultMessage="Words per dictation (weekly average)" />
                  </Typography>
                  <MiniLine data={sessionStats.wordsPerSessionWeekly} />
                </Stack>
              </Stack>
            </Section>

            <Section
              title={<FormattedMessage defaultMessage="Efficiency" />}
              description={
                <FormattedMessage defaultMessage="How much editing OS Voice's output still needs, and how fast it's processing." />
              }
            >
              <Stack spacing={2.5}>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="textSecondary">
                    <FormattedMessage defaultMessage="Corrections per 100 words (weekly)" />
                    {efficiency.correctionRateDeltaPct !== null && (
                      <FormattedMessage
                        defaultMessage=" · {pct}% vs last week"
                        values={{
                          pct:
                            efficiency.correctionRateDeltaPct > 0
                              ? `+${efficiency.correctionRateDeltaPct}`
                              : efficiency.correctionRateDeltaPct,
                        }}
                      />
                    )}
                  </Typography>
                  <MiniBars
                    data={efficiency.correctionRateWeekly.map((p) => p.value)}
                    labels={efficiency.correctionRateWeekly.map((p) => p.label)}
                  />
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="textSecondary">
                    <FormattedMessage defaultMessage="Transcription speed, words / second processed (weekly)" />
                  </Typography>
                  {efficiency.speedWeekly.some((p) => p.value > 0) ? (
                    <MiniLine data={efficiency.speedWeekly} />
                  ) : (
                    <Typography variant="caption" color="textSecondary">
                      <FormattedMessage defaultMessage="Not enough timing data yet." />
                    </Typography>
                  )}
                </Stack>
                <Stack spacing={0.75}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="textSecondary">
                      <FormattedMessage defaultMessage="Verbatim vs polished" />
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <FormattedMessage
                        defaultMessage="{pct}% verbatim"
                        values={{ pct: efficiency.verbatimPct }}
                      />
                    </Typography>
                  </Stack>
                  {efficiency.verbatimWords + efficiency.polishedWords > 0 ? (
                    <>
                      <LinearProgress
                        variant="determinate"
                        value={efficiency.verbatimPct}
                        aria-label={intl.formatMessage({
                          defaultMessage:
                            "Share of words dictated verbatim vs polished by AI",
                        })}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="caption" color="textSecondary">
                        <FormattedMessage
                          defaultMessage="{verbatim} verbatim words · {polished} AI-polished words"
                          values={{
                            verbatim: efficiency.verbatimWords.toLocaleString(),
                            polished: efficiency.polishedWords.toLocaleString(),
                          }}
                        />
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="caption" color="textSecondary">
                      <FormattedMessage defaultMessage="We'll show this split as you dictate." />
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Section>

            <Section
              title={<FormattedMessage defaultMessage="Looking ahead" />}
            >
              <Stack spacing={1}>
                {milestoneOutlook.nextMilestone !== null &&
                  milestoneOutlook.daysToNextMilestone !== null &&
                  milestoneOutlook.wordsRemaining !== null && (
                    <Typography variant="body2" color="textSecondary">
                      <FormattedMessage
                        defaultMessage="At your current pace, {remaining} words to go until {milestone} — about {days} days{date}."
                        values={{
                          remaining:
                            milestoneOutlook.wordsRemaining.toLocaleString(),
                          milestone:
                            milestoneOutlook.nextMilestone.toLocaleString(),
                          days: milestoneOutlook.daysToNextMilestone,
                          date: milestoneOutlook.projectedDate
                            ? intl.formatMessage(
                                { defaultMessage: " (around {date})" },
                                {
                                  date: dayjs(
                                    milestoneOutlook.projectedDate,
                                  ).format("MMM D, YYYY"),
                                },
                              )
                            : "",
                        }}
                      />
                    </Typography>
                  )}
                <Typography variant="body2" color="textSecondary">
                  <FormattedMessage
                    defaultMessage="On track for {words} words this month ({rate}/day lately)."
                    values={{
                      words: predictions.projectedMonthWords.toLocaleString(),
                      rate: predictions.dailyRate.toLocaleString(),
                    }}
                  />
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  <FormattedMessage
                    defaultMessage="Lifetime, that's about {books}, {pages} manuscript pages, {emails} emails, or {tweets} tweets."
                    values={{
                      books: books.phrase,
                      pages: wordComparisons.pages.toLocaleString(),
                      emails: wordComparisons.emails.toLocaleString(),
                      tweets: wordComparisons.tweets.toLocaleString(),
                    }}
                  />
                </Typography>
              </Stack>
            </Section>

            {extras.perApp.length > 0 && (
              <Section
                title={<FormattedMessage defaultMessage="App deep dive" />}
              >
                <Stack spacing={1}>
                  {extras.perApp.map((a) => (
                    <Stack
                      key={a.app}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="baseline"
                    >
                      <Typography noWrap sx={{ maxWidth: 180 }}>
                        {a.app}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        <FormattedMessage
                          defaultMessage="{words} words · {avg}/dictation"
                          values={{
                            words: a.words.toLocaleString(),
                            avg: a.avgLength,
                          }}
                        />
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Section>
            )}

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
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};
