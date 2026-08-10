import { useEffect, useState } from "react";
import {
  Card,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { FormattedMessage, useIntl } from "react-intl";
import {
  getDeviceCapability,
  getLiveSystemStats,
} from "../../actions/hardware.actions";
import {
  DeviceCapability,
  LiveSystemStats,
} from "../../lib/hardware/recommend";
import { TranscriptionPerformance } from "../../lib/insights/compute";
import { getLogger } from "../../utils/log.utils";
import { StatCard } from "../insights/StatCard";

const LIVE_POLL_INTERVAL_MS = 2500;

const formatSeconds = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

const mbToGb = (mb: number): number => Math.round((mb / 1024) * 10) / 10;

export type SystemDiagnosticsProps = {
  /** Real, measured speed data from computeTranscriptionPerformance, when available. */
  performance?: TranscriptionPerformance;
  /**
   * Compact renders a single tidy card suited for settings/onboarding
   * surfaces. Full renders the richer live-resource breakdown used in the
   * Insights panel.
   */
  compact?: boolean;
};

// Live CPU/RAM/GPU/VRAM usage plus the active local transcription engine.
// Every number here is either polled straight from the OS/GPU driver or
// measured from real timing data — nothing is estimated or invented. GPU and
// VRAM fields are simply omitted when the machine has no usable NVIDIA GPU.
// Labels are written in plain English (no "VRAM"/"p95"-style jargon) so a
// non-technical person can understand what's happening at a glance.
export const SystemDiagnostics = ({
  performance,
  compact = false,
}: SystemDiagnosticsProps) => {
  const intl = useIntl();
  const [hardware, setHardware] = useState<DeviceCapability | null>(null);
  const [live, setLive] = useState<LiveSystemStats | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      void getLiveSystemStats()
        .then((stats) => {
          if (!cancelled) {
            setLive(stats);
          }
        })
        .catch((error) => {
          getLogger().verbose(`Failed to read live system stats: ${error}`);
        });
    };
    poll();
    const intervalId = window.setInterval(poll, LIVE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  // Apple Silicon has unified memory: the GPU shares system RAM, so there is no
  // separate VRAM to show and no unprivileged GPU-utilization source.
  const unifiedMemory = live?.unifiedMemory ?? hardware?.unifiedMemory ?? false;

  const onGpu = performance?.activeDevice === "GPU";
  const engineLabel = performance?.activeDevice
    ? intl.formatMessage(
        onGpu
          ? unifiedMemory
            ? { defaultMessage: "Running on your Mac's GPU (fast)" }
            : { defaultMessage: "Running on your GPU (fast)" }
          : { defaultMessage: "Running on your CPU" },
      )
    : null;
  const engineValue = performance?.activeModel
    ? `${engineLabel ?? ""}${engineLabel && performance.activeModel ? " · " : ""}${performance.activeModel}`
    : engineLabel;

  const gpuName = live?.gpuName ?? hardware?.gpuName ?? null;
  const vramTotalMb = live?.vramTotalMb ?? hardware?.vramTotalMb ?? null;
  const showGpuUtil =
    live?.gpuUtilPct !== null && live?.gpuUtilPct !== undefined;
  // On unified-memory machines VRAM equals RAM, so the dedicated VRAM readouts
  // are suppressed in favour of a single "Unified memory" bar below.
  const showVram =
    !unifiedMemory &&
    live?.vramUsedMb !== null &&
    live?.vramUsedMb !== undefined &&
    vramTotalMb !== null;

  if (compact) {
    return (
      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" fontWeight={700}>
            <FormattedMessage defaultMessage="Your system & performance" />
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {(engineValue || gpuName) && (
              <StatCard
                size="compact"
                label={<FormattedMessage defaultMessage="How it's running" />}
                value={engineValue ?? gpuName ?? "—"}
              />
            )}
            {performance && performance.sampleSize > 0 && (
              <Tooltip
                title={intl.formatMessage(
                  {
                    defaultMessage:
                      "For every second of processing, it handles about {factor} seconds of your speech.",
                  },
                  { factor: performance.realtimeFactor.toFixed(1) },
                )}
              >
                <StatCard
                  size="compact"
                  label={<FormattedMessage defaultMessage="Speed" />}
                  value={
                    <FormattedMessage
                      defaultMessage="{factor}x real-time"
                      values={{ factor: performance.realtimeFactor.toFixed(1) }}
                    />
                  }
                />
              </Tooltip>
            )}
            {performance && performance.sampleSize > 0 && (
              <StatCard
                size="compact"
                label={<FormattedMessage defaultMessage="Typical wait" />}
                value={formatSeconds(performance.avgTranscribeMs)}
              />
            )}
          </Stack>

          <Stack spacing={1}>
            {live && (
              <Stack spacing={0.25}>
                <Typography variant="caption" color="text.secondary">
                  {unifiedMemory ? (
                    <FormattedMessage
                      defaultMessage="Unified memory (shared with GPU): {used} of {total} GB"
                      values={{
                        used: mbToGb(live.ramUsedMb),
                        total: mbToGb(live.ramTotalMb),
                      }}
                    />
                  ) : (
                    <FormattedMessage
                      defaultMessage="Memory (RAM) in use: {used} of {total} GB"
                      values={{
                        used: mbToGb(live.ramUsedMb),
                        total: mbToGb(live.ramTotalMb),
                      }}
                    />
                  )}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(
                    100,
                    (live.ramUsedMb / Math.max(1, live.ramTotalMb)) * 100,
                  )}
                />
              </Stack>
            )}
            {showVram && (
              <Stack spacing={0.25}>
                <Typography variant="caption" color="text.secondary">
                  <FormattedMessage
                    defaultMessage="Video memory (VRAM) in use: {used} of {total} GB"
                    values={{
                      used: mbToGb(live!.vramUsedMb!),
                      total: mbToGb(vramTotalMb!),
                    }}
                  />
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(
                    100,
                    (live!.vramUsedMb! / Math.max(1, vramTotalMb!)) * 100,
                  )}
                />
              </Stack>
            )}
            {!live && !unifiedMemory && vramTotalMb !== null && (
              <Typography variant="caption" color="text.secondary">
                <FormattedMessage
                  defaultMessage="Video memory (VRAM) available: {total} GB"
                  values={{ total: mbToGb(vramTotalMb) }}
                />
              </Typography>
            )}
          </Stack>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="textSecondary">
        <FormattedMessage defaultMessage="Your computer" />
      </Typography>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {engineValue && (
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="How it's running" />}
            value={engineValue}
            hint={
              <FormattedMessage defaultMessage="The hardware and model currently doing the transcribing." />
            }
          />
        )}
        {gpuName && (
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="Graphics card" />}
            value={gpuName}
          />
        )}
        {hardware && (
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="Processor cores" />}
            value={hardware.cpuCores}
            hint={
              <FormattedMessage defaultMessage="More cores generally means more work can happen at once." />
            }
          />
        )}
        {hardware && (
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="Memory (RAM)" />}
            value={
              <FormattedMessage
                defaultMessage="{ram} GB"
                values={{ ram: hardware.ramGb }}
              />
            }
          />
        )}
        {!live && !unifiedMemory && vramTotalMb !== null && (
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="Video memory (VRAM)" />}
            value={
              <FormattedMessage
                defaultMessage="{vram} GB"
                values={{ vram: mbToGb(vramTotalMb) }}
              />
            }
            hint={
              <FormattedMessage defaultMessage="Memory on your graphics card, used when transcribing on the GPU." />
            }
          />
        )}
      </Stack>

      {live ? (
        <Stack spacing={1.25}>
          <Typography variant="caption" color="text.secondary">
            <FormattedMessage defaultMessage="What your computer is doing right now" />
          </Typography>

          <Stack spacing={0.5}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">
                <FormattedMessage defaultMessage="Processor load" />
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {`${Math.round(live.cpuLoadPct)}%`}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, live.cpuLoadPct))}
            />
          </Stack>

          <Stack spacing={0.5}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">
                {unifiedMemory ? (
                  <FormattedMessage defaultMessage="Unified memory (shared with GPU)" />
                ) : (
                  <FormattedMessage defaultMessage="Memory (RAM) in use" />
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                <FormattedMessage
                  defaultMessage="{used} of {total} GB"
                  values={{
                    used: mbToGb(live.ramUsedMb),
                    total: mbToGb(live.ramTotalMb),
                  }}
                />
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(
                100,
                (live.ramUsedMb / Math.max(1, live.ramTotalMb)) * 100,
              )}
            />
          </Stack>

          {showGpuUtil && (
            <Stack spacing={0.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">
                  <FormattedMessage defaultMessage="GPU in use" />
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {`${Math.round(live.gpuUtilPct!)}%`}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, live.gpuUtilPct!))}
              />
            </Stack>
          )}

          {showVram && (
            <Stack spacing={0.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">
                  <FormattedMessage defaultMessage="Video memory (VRAM) in use" />
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  <FormattedMessage
                    defaultMessage="{used} of {total} GB"
                    values={{
                      used: mbToGb(live.vramUsedMb!),
                      total: mbToGb(vramTotalMb!),
                    }}
                  />
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={Math.min(
                  100,
                  (live.vramUsedMb! / Math.max(1, vramTotalMb!)) * 100,
                )}
              />
            </Stack>
          )}
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary">
          <FormattedMessage defaultMessage="Reading live system stats…" />
        </Typography>
      )}
    </Stack>
  );
};
