import { useEffect, useState } from "react";
import { Card, LinearProgress, Stack, Typography } from "@mui/material";
import { FormattedMessage } from "react-intl";
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
export const SystemDiagnostics = ({
  performance,
  compact = false,
}: SystemDiagnosticsProps) => {
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

  const activeDeviceModel =
    performance?.activeDevice && performance?.activeModel
      ? `${performance.activeDevice} · ${performance.activeModel}`
      : (performance?.activeDevice ?? performance?.activeModel ?? null);

  const gpuName = live?.gpuName ?? hardware?.gpuName ?? null;
  const vramTotalMb = live?.vramTotalMb ?? hardware?.vramTotalMb ?? null;
  const showGpuUtil =
    live?.gpuUtilPct !== null && live?.gpuUtilPct !== undefined;
  const showVram =
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
            {(activeDeviceModel || gpuName) && (
              <StatCard
                size="compact"
                label={<FormattedMessage defaultMessage="Engine" />}
                value={activeDeviceModel ?? gpuName ?? "—"}
              />
            )}
            {performance && performance.sampleSize > 0 && (
              <StatCard
                size="compact"
                label={<FormattedMessage defaultMessage="Real-time factor" />}
                value={
                  <FormattedMessage
                    defaultMessage="{factor}x"
                    values={{ factor: performance.realtimeFactor }}
                  />
                }
              />
            )}
            {performance && performance.sampleSize > 0 && (
              <StatCard
                size="compact"
                label={<FormattedMessage defaultMessage="Avg transcribe" />}
                value={formatSeconds(performance.avgTranscribeMs)}
              />
            )}
          </Stack>

          <Stack spacing={1}>
            {live && (
              <Stack spacing={0.25}>
                <Typography variant="caption" color="text.secondary">
                  <FormattedMessage
                    defaultMessage="RAM: {used} of {total} GB"
                    values={{
                      used: mbToGb(live.ramUsedMb),
                      total: mbToGb(live.ramTotalMb),
                    }}
                  />
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
                    defaultMessage="VRAM: {used} of {total} GB"
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
            {!live && vramTotalMb !== null && (
              <Typography variant="caption" color="text.secondary">
                <FormattedMessage
                  defaultMessage="VRAM: {total} GB total"
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
        {gpuName && (
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="GPU" />}
            value={gpuName}
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
        {!live && vramTotalMb !== null && (
          <StatCard
            size="compact"
            label={<FormattedMessage defaultMessage="VRAM" />}
            value={
              <FormattedMessage
                defaultMessage="{vram} GB"
                values={{ vram: mbToGb(vramTotalMb) }}
              />
            }
          />
        )}
      </Stack>

      {live ? (
        <Stack spacing={1.25}>
          <Typography variant="caption" color="text.secondary">
            <FormattedMessage defaultMessage="Live resource usage" />
          </Typography>

          <Stack spacing={0.5}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">
                <FormattedMessage defaultMessage="CPU load" />
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
                <FormattedMessage defaultMessage="RAM" />
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
                  <FormattedMessage defaultMessage="GPU utilization" />
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
                  <FormattedMessage defaultMessage="VRAM" />
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
