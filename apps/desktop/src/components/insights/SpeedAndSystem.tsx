import { useEffect, useState } from "react";
import { Stack, Typography } from "@mui/material";
import { FormattedMessage } from "react-intl";
import { getDeviceCapability } from "../../actions/hardware.actions";
import { DeviceCapability } from "../../lib/hardware/recommend";
import { getLogger } from "../../utils/log.utils";
import { TranscriptionPerformance } from "../../lib/insights/compute";
import { MiniLine } from "./MiniLine";
import { StatCard } from "./StatCard";

const formatSeconds = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

export type SpeedAndSystemProps = {
  performance: TranscriptionPerformance;
};

// Real, measured transcription speed plus a snapshot of the machine it's
// running on. Every number here is either read straight off local timing
// data or reported by the OS/GPU driver — nothing is estimated or invented.
export const SpeedAndSystem = ({ performance }: SpeedAndSystemProps) => {
  const [hardware, setHardware] = useState<DeviceCapability | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getDeviceCapability()
      .then((cap) => {
        if (!cancelled) {
          setHardware(cap);
        }
      })
      .catch((error) => {
        getLogger().verbose(`Failed to read device capability: ${error}`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (performance.sampleSize === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        <FormattedMessage defaultMessage="We'll show real transcription speed once you have a few timed dictations." />
      </Typography>
    );
  }

  const activeDeviceModel =
    performance.activeDevice && performance.activeModel
      ? `${performance.activeDevice} · ${performance.activeModel}`
      : (performance.activeDevice ?? performance.activeModel);

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
          label={<FormattedMessage defaultMessage="Fastest transcribe" />}
          value={formatSeconds(performance.fastestTranscribeMs)}
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

      {performance.speedTrend.length >= 2 && (
        <Stack spacing={0.5}>
          <Typography variant="body2" color="textSecondary">
            <FormattedMessage defaultMessage="Transcribe time trend, ms per dictation" />
          </Typography>
          <MiniLine data={performance.speedTrend} />
        </Stack>
      )}

      <Stack spacing={1}>
        <Typography variant="body2" color="textSecondary">
          <FormattedMessage defaultMessage="System" />
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {activeDeviceModel && (
            <StatCard
              size="compact"
              label={<FormattedMessage defaultMessage="Active device" />}
              value={activeDeviceModel}
            />
          )}
          {hardware?.gpuName && (
            <StatCard
              size="compact"
              label={<FormattedMessage defaultMessage="GPU" />}
              value={hardware.gpuName}
            />
          )}
          {hardware && (
            <StatCard
              size="compact"
              label={<FormattedMessage defaultMessage="CPU cores" />}
              value={hardware.cpuCores}
            />
          )}
          {hardware && (
            <StatCard
              size="compact"
              label={<FormattedMessage defaultMessage="RAM" />}
              value={
                <FormattedMessage
                  defaultMessage="{ram} GB"
                  values={{ ram: hardware.ramGb }}
                />
              }
            />
          )}
        </Stack>
      </Stack>
    </Stack>
  );
};
