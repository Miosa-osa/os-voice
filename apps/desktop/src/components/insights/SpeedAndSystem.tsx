import { Stack, Tooltip, Typography } from "@mui/material";
import { FormattedMessage, useIntl } from "react-intl";
import { TranscriptionPerformance } from "../../lib/insights/compute";
import { SystemDiagnostics } from "../common/SystemDiagnostics";
import { MiniLine } from "./MiniLine";
import { StatCard } from "./StatCard";

const formatSeconds = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

const formatDurationSeconds = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

type SpeedTier = "blazing" | "fast" | "comfortable" | "slow";

// Plain-English verdict tiers for the headline. Thresholds are on
// realtimeFactor (seconds of audio handled per second of processing):
// >= 10x blazing, >= 4x fast, >= 1.5x comfortable, below that, slow.
const getSpeedTier = (realtimeFactor: number): SpeedTier => {
  if (realtimeFactor >= 10) return "blazing";
  if (realtimeFactor >= 4) return "fast";
  if (realtimeFactor >= 1.5) return "comfortable";
  return "slow";
};

const VerdictHeadline = ({ tier }: { tier: SpeedTier }) => {
  switch (tier) {
    case "blazing":
      return <FormattedMessage defaultMessage="⚡ Blazing fast" />;
    case "fast":
      return <FormattedMessage defaultMessage="🚀 Fast" />;
    case "comfortable":
      return <FormattedMessage defaultMessage="🙂 Comfortable" />;
    case "slow":
    default:
      return <FormattedMessage defaultMessage="🐢 A bit slow" />;
  }
};

const SlowTip = ({ onGpu }: { onGpu: boolean }) =>
  onGpu ? (
    <FormattedMessage defaultMessage="Even on your GPU this is a bit slow — a smaller model may speed things up." />
  ) : (
    <FormattedMessage defaultMessage="A smaller model, or turning on GPU acceleration, would help." />
  );

export type SpeedAndSystemProps = {
  performance: TranscriptionPerformance;
};

// Real, measured transcription speed plus a live snapshot of the machine
// it's running on. Every number here is either read straight off local
// timing data or reported by the OS/GPU driver — nothing is estimated or
// invented. Labels below translate that raw data into plain English for
// people who don't know what "p95" or "real-time factor" means.
export const SpeedAndSystem = ({ performance }: SpeedAndSystemProps) => {
  const intl = useIntl();

  if (performance.sampleSize === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        <FormattedMessage defaultMessage="We'll show real transcription speed once you have a few timed dictations." />
      </Typography>
    );
  }

  const roundedFactor = Math.round(performance.realtimeFactor);
  const tier = getSpeedTier(performance.realtimeFactor);
  const onGpu = performance.activeDevice === "GPU";

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.5}>
        <Tooltip
          title={intl.formatMessage(
            {
              defaultMessage:
                "Measured as {factor}x real-time: for every second of processing, it handles about {factor} seconds of your speech.",
            },
            { factor: performance.realtimeFactor.toFixed(1) },
          )}
        >
          <Typography
            variant="h4"
            fontWeight={800}
            sx={{ width: "fit-content", cursor: "default" }}
          >
            <VerdictHeadline tier={tier} />
          </Typography>
        </Tooltip>
        <Typography variant="body2" color="textSecondary">
          {tier === "slow" ? (
            <SlowTip onGpu={onGpu} />
          ) : (
            <FormattedMessage
              defaultMessage="Transcribes about {factor} seconds of talking every second of processing — basically the instant you stop, it's done."
              values={{ factor: roundedFactor }}
            />
          )}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          <FormattedMessage
            defaultMessage="({factor}x real-time, based on {count} timed dictations)"
            values={{
              factor: performance.realtimeFactor.toFixed(1),
              count: performance.sampleSize,
            }}
          />
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <StatCard
          size="compact"
          label={<FormattedMessage defaultMessage="Typical wait" />}
          value={formatSeconds(performance.avgTranscribeMs)}
          hint={
            <FormattedMessage defaultMessage="How long after you stop talking until the text shows up, on average." />
          }
        />
        <StatCard
          size="compact"
          label={<FormattedMessage defaultMessage="Usually" />}
          value={formatSeconds(performance.medianTranscribeMs)}
          hint={
            <FormattedMessage defaultMessage="Half of your dictations finish faster than this." />
          }
        />
        <StatCard
          size="compact"
          label={<FormattedMessage defaultMessage="Fastest" />}
          value={formatSeconds(performance.fastestTranscribeMs)}
          hint={
            <FormattedMessage defaultMessage="Your quickest dictation so far." />
          }
        />
        <StatCard
          size="compact"
          label={<FormattedMessage defaultMessage="Slowest" />}
          value={formatSeconds(performance.slowestTranscribeMs)}
          hint={
            <FormattedMessage defaultMessage="Your slowest dictation so far — usually a longer recording." />
          }
        />
        <StatCard
          size="compact"
          label={<FormattedMessage defaultMessage="Almost always" />}
          value={formatSeconds(performance.p95TranscribeMs)}
          hint={
            <FormattedMessage defaultMessage="9 out of 10 dictations finish within this time." />
          }
        />
        <StatCard
          size="compact"
          label={<FormattedMessage defaultMessage="Reading speed" />}
          value={
            performance.wordsPerSecond > 0
              ? intl.formatMessage(
                  { defaultMessage: "{words}/sec" },
                  { words: performance.wordsPerSecond },
                )
              : "—"
          }
          hint={
            <FormattedMessage
              defaultMessage="Processes about {words} words every second."
              values={{ words: performance.wordsPerSecond }}
            />
          }
        />
        {performance.avgPostprocessMs !== null && (
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="AI clean-up time" />}
            value={formatSeconds(performance.avgPostprocessMs)}
            hint={
              <FormattedMessage defaultMessage="Extra time spent polishing the text after transcribing (grammar, formatting)." />
            }
          />
        )}
      </Stack>

      <Stack spacing={1}>
        <Typography variant="body2" color="textSecondary">
          <FormattedMessage defaultMessage="Totals so far" />
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="Dictations measured" />}
            value={performance.totalDictationsTimed}
            hint={
              <FormattedMessage defaultMessage="How many recordings these numbers are based on." />
            }
          />
          <StatCard
            size="compact"
            label={
              <FormattedMessage defaultMessage="Total speech transcribed" />
            }
            value={formatDurationSeconds(
              performance.totalAudioSecondsProcessed,
            )}
            hint={
              <FormattedMessage defaultMessage="Combined length of everything you've dictated." />
            }
          />
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="Time spent processing" />}
            value={formatDurationSeconds(performance.totalProcessingSeconds)}
            hint={
              <FormattedMessage defaultMessage="Total time the app spent turning your speech into text." />
            }
          />
          <StatCard
            size="compact"
            label={
              <FormattedMessage defaultMessage="Time you didn't spend waiting" />
            }
            value={formatDurationSeconds(
              Math.max(0, performance.timeSavedSeconds),
            )}
            hint={
              <FormattedMessage defaultMessage="Vs. if you'd had to wait through the recording in real time to see the text." />
            }
          />
        </Stack>
      </Stack>

      {performance.speedTrend.length >= 2 && (
        <Stack spacing={0.5}>
          <Typography variant="body2" color="textSecondary">
            <FormattedMessage defaultMessage="Getting faster or slower over time?" />
          </Typography>
          <MiniLine data={performance.speedTrend} />
        </Stack>
      )}

      {performance.byDevice.length > 1 && (
        <Stack spacing={1}>
          <Typography variant="body2" color="textSecondary">
            <FormattedMessage defaultMessage="Speed by device & model" />
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {performance.byDevice.map((entry) => (
              <StatCard
                key={`${entry.device ?? ""}-${entry.model ?? ""}`}
                size="compact"
                label={
                  entry.device && entry.model
                    ? `${entry.device} · ${entry.model}`
                    : (entry.device ?? entry.model ?? "—")
                }
                value={
                  <FormattedMessage
                    defaultMessage="{factor}x"
                    values={{ factor: entry.avgRealtimeFactor.toFixed(1) }}
                  />
                }
                hint={
                  <FormattedMessage
                    defaultMessage="{count} dictations"
                    values={{ count: entry.count }}
                  />
                }
              />
            ))}
          </Stack>
        </Stack>
      )}

      <SystemDiagnostics performance={performance} />
    </Stack>
  );
};
