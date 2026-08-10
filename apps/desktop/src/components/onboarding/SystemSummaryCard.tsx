import { Bolt, Memory, Speed } from "@mui/icons-material";
import { CircularProgress, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { detectAndRecommend } from "../../actions/hardware.actions";
import type {
  DeviceCapability,
  RecommendationTier,
  TranscriptionRecommendation,
} from "../../lib/hardware/recommend";
import { getLogger } from "../../utils/log.utils";

type HardwareSnapshot = {
  cap: DeviceCapability;
  rec: TranscriptionRecommendation;
};

// Grounded purely in recommendTranscription()'s tiers (see lib/hardware/recommend.ts) —
// these are friendly, labeled estimates, never a fabricated exact benchmark number.
const expectedSpeedMessageForTier = (tier: RecommendationTier) => {
  switch (tier) {
    case "gpu-turbo":
      return (
        <FormattedMessage defaultMessage="Near-instant — roughly 10–15x faster than real-time" />
      );
    case "cpu-small":
      return (
        <FormattedMessage defaultMessage="Fast — a second or two per dictation" />
      );
    case "cpu-base":
      return <FormattedMessage defaultMessage="A few seconds per dictation" />;
    case "cpu-tiny":
    default:
      return (
        <FormattedMessage defaultMessage="Usable on CPU; a cloud model is suggested for speed" />
      );
  }
};

const SummaryRow = ({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Stack direction="row" spacing={1} alignItems="flex-start">
    {icon}
    <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
      {children}
    </Typography>
  </Stack>
);

export const SystemSummaryCard = () => {
  const intl = useIntl();
  const [hardware, setHardware] = useState<HardwareSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void detectAndRecommend()
      .then((result) => {
        if (!cancelled) {
          setHardware(result);
        }
      })
      .catch((error) => {
        getLogger().verbose(`Failed to detect hardware capability: ${error}`);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const iconSx = { fontSize: 18, color: "var(--app-palette-blue)", mt: 0.25 };

  return (
    <Stack
      spacing={1.5}
      sx={{
        width: "100%",
        p: 2,
        borderRadius: 2,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        backgroundColor: (theme) =>
          theme.vars?.palette.level1 ?? theme.palette.background.paper,
      }}
    >
      <Typography variant="subtitle2" fontWeight={600}>
        <FormattedMessage defaultMessage="Your system & expected performance" />
      </Typography>

      {loading && !hardware ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            <FormattedMessage defaultMessage="Detecting your hardware..." />
          </Typography>
        </Stack>
      ) : hardware ? (
        <Stack spacing={1}>
          <SummaryRow icon={<Memory sx={iconSx} />}>
            {[
              hardware.cap.gpuName ??
                intl.formatMessage({
                  defaultMessage: "No dedicated GPU / CPU only",
                }),
              hardware.cap.ramGb
                ? intl.formatMessage(
                    { defaultMessage: "{ram} GB RAM" },
                    { ram: hardware.cap.ramGb },
                  )
                : null,
              hardware.cap.cpuCores
                ? intl.formatMessage(
                    { defaultMessage: "{cores} CPU cores" },
                    { cores: hardware.cap.cpuCores },
                  )
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </SummaryRow>

          <SummaryRow icon={<Bolt sx={iconSx} />}>
            {intl.formatMessage(
              {
                defaultMessage: "Recommended: {device} · {model}",
              },
              {
                device: hardware.cap.hasUsableGpu
                  ? intl.formatMessage({ defaultMessage: "GPU" })
                  : intl.formatMessage({ defaultMessage: "CPU" }),
                model: hardware.rec.modelSize,
              },
            )}
          </SummaryRow>

          <SummaryRow icon={<Speed sx={iconSx} />}>
            <FormattedMessage
              defaultMessage="Expected speed: {speed}"
              values={{ speed: expectedSpeedMessageForTier(hardware.rec.tier) }}
            />
          </SummaryRow>

          {hardware.rec.suggestCloud && (
            <Typography variant="caption" color="text.secondary">
              <FormattedMessage defaultMessage="For the fastest experience on this machine, a cloud or API model is worth considering." />
            </Typography>
          )}
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary">
          <FormattedMessage defaultMessage="We couldn't detect your hardware, but you can still choose a model below." />
        </Typography>
      )}
    </Stack>
  );
};
