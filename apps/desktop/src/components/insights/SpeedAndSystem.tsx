import { Stack, Typography } from "@mui/material";
import { FormattedMessage } from "react-intl";
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

export type SpeedAndSystemProps = {
  performance: TranscriptionPerformance;
};

// Real, measured transcription speed plus a live snapshot of the machine
// it's running on. Every number here is either read straight off local
// timing data or reported by the OS/GPU driver — nothing is estimated or
// invented.
export const SpeedAndSystem = ({ performance }: SpeedAndSystemProps) => {
  if (performance.sampleSize === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        <FormattedMessage defaultMessage="We'll show real transcription speed once you have a few timed dictations." />
      </Typography>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.25}>
        <Typography variant="h4" fontWeight={800}>
          <FormattedMessage
            defaultMessage="{factor}x real-time"
            values={{ factor: performance.realtimeFactor }}
          />
        </Typography>
        <Typography variant="body2" color="textSecondary">
          <FormattedMessage
            defaultMessage="Transcribes about {factor} seconds of speech per second of processing, across {count} timed dictations."
            values={{
              factor: performance.realtimeFactor,
              count: performance.sampleSize,
            }}
          />
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <StatCard
          size="compact"
          label={<FormattedMessage defaultMessage="Avg transcribe time" />}
          value={formatSeconds(performance.avgTranscribeMs)}
        />
        <StatCard
          size="compact"
          label={<FormattedMessage defaultMessage="Median transcribe time" />}
          value={formatSeconds(performance.medianTranscribeMs)}
        />
        <StatCard
          size="compact"
          label={<FormattedMessage defaultMessage="Fastest transcribe" />}
          value={formatSeconds(performance.fastestTranscribeMs)}
        />
        <StatCard
          size="compact"
          label={<FormattedMessage defaultMessage="Slowest transcribe" />}
          value={formatSeconds(performance.slowestTranscribeMs)}
        />
        <StatCard
          size="compact"
          label={<FormattedMessage defaultMessage="P95 transcribe time" />}
          value={formatSeconds(performance.p95TranscribeMs)}
        />
        <StatCard
          size="compact"
          label={<FormattedMessage defaultMessage="Words per second" />}
          value={
            performance.wordsPerSecond > 0 ? performance.wordsPerSecond : "—"
          }
        />
        {performance.avgPostprocessMs !== null && (
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="Avg post-processing" />}
            value={formatSeconds(performance.avgPostprocessMs)}
          />
        )}
      </Stack>

      <Stack spacing={1}>
        <Typography variant="body2" color="textSecondary">
          <FormattedMessage defaultMessage="Totals" />
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="Dictations timed" />}
            value={performance.totalDictationsTimed}
          />
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="Audio processed" />}
            value={formatDurationSeconds(
              performance.totalAudioSecondsProcessed,
            )}
          />
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="Time spent processing" />}
            value={formatDurationSeconds(performance.totalProcessingSeconds)}
          />
          <StatCard
            size="compact"
            label={
              <FormattedMessage defaultMessage="Time saved vs. real-time" />
            }
            value={formatDurationSeconds(
              Math.max(0, performance.timeSavedSeconds),
            )}
          />
        </Stack>
      </Stack>

      {performance.speedTrend.length >= 2 && (
        <Stack spacing={0.5}>
          <Typography variant="body2" color="textSecondary">
            <FormattedMessage defaultMessage="Transcribe time trend, ms per dictation" />
          </Typography>
          <MiniLine data={performance.speedTrend} />
        </Stack>
      )}

      {performance.byDevice.length > 1 && (
        <Stack spacing={1}>
          <Typography variant="body2" color="textSecondary">
            <FormattedMessage defaultMessage="By device & model" />
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
                    values={{ factor: entry.avgRealtimeFactor }}
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
