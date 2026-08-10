import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl, type IntlShape } from "react-intl";
import {
  refreshLocalTranscriptionDevices,
  deleteLocalTranscriptionModel,
  downloadLocalTranscriptionModel,
  refreshLocalTranscriptionModelStatuses,
} from "../../actions/settings-local-transcription.actions";
import { showErrorSnackbar } from "../../actions/app.actions";
import { detectAndRecommend } from "../../actions/hardware.actions";
import {
  setPreferredTranscriptionApiKeyId,
  setPreferredTranscriptionDevice,
  setPreferredTranscriptionMode,
  setPreferredTranscriptionModelSize,
} from "../../actions/user.actions";
import type {
  DeviceCapability,
  TranscriptionRecommendation,
} from "../../lib/hardware/recommend";
import {
  isLocalTranscriptionModelDownloadInProgress,
  isLocalTranscriptionModelSelectable,
} from "../../state/settings.state";
import { useAppStore } from "../../store";
import { CPU_DEVICE_VALUE, type TranscriptionMode } from "../../types/ai.types";
import { getAllowsChangeTranscription } from "../../utils/enterprise.utils";
import { getEffectiveTranscriptionMode } from "../../utils/user.utils";
import { formatSize } from "../../utils/format.utils";
import { getLogger } from "../../utils/log.utils";
import { type LocalSidecarDownloadSnapshot } from "../../sidecars";
import {
  type LocalWhisperModel,
  normalizeLocalWhisperModel,
} from "../../utils/local-transcription.utils";
import { computeTranscriptionPerformance } from "../../lib/insights/compute";
import { ManagedByOrgNotice } from "../common/ManagedByOrgNotice";
import {
  SegmentedControl,
  SegmentedControlOption,
} from "../common/SegmentedControl";
import { SystemDiagnostics } from "../common/SystemDiagnostics";
import { useInsightsSources } from "../insights/useInsightsData";
import { maybeArrayElements } from "./AIPostProcessingConfiguration";
import { ApiKeyList } from "./ApiKeyList";
import { VoquillCloudSetting } from "./VoquillCloudSetting";

type ModelOption = {
  value: LocalWhisperModel;
  label: string;
  helper: string;
};

const MODEL_OPTIONS: ModelOption[] = [
  {
    value: "tiny",
    label: "Whisper Tiny (77 MB)",
    helper: "Fastest, lowest accuracy",
  },
  {
    value: "base",
    label: "Whisper Base (148 MB)",
    helper: "Great balance of speed and accuracy",
  },
  {
    value: "small",
    label: "Whisper Small (488 MB)",
    helper: "Recommended with GPU acceleration",
  },
  {
    value: "medium",
    label: "Whisper Medium (1.53 GB)",
    helper: "Balanced quality and speed",
  },
  {
    value: "turbo",
    label: "Whisper Large v3 Turbo (1.6 GB)",
    helper: "Fast large model, great accuracy",
  },
  {
    value: "large",
    label: "Whisper Large v3 (3.1 GB)",
    helper: "Highest accuracy, requires GPU",
  },
  {
    value: "hindi2hinglish",
    label: "Whisper Hindi2Hinglish Apex (595 MB)",
    helper: "Hindi speech transcribed as Hinglish (Latin script)",
  },
];

// Relative compute weight of the standard Whisper size ladder, lightest to
// heaviest. Used only to warn when a user picks something heavier than what
// recommendTranscription() already deemed comfortable for their hardware.
// hindi2hinglish is a specialty language model outside this ladder and is
// intentionally excluded from the guardrail.
const MODEL_WEIGHT: Partial<Record<LocalWhisperModel, number>> = {
  tiny: 0,
  base: 1,
  small: 2,
  medium: 3,
  turbo: 4,
  large: 5,
};

const shortModelLabel = (label: string): string =>
  label.replace(/\s*\([^)]*\)\s*$/, "");

// Grounded in recommendTranscription()'s tiers only (see lib/hardware/recommend.ts) —
// no hardware numbers are invented here.
const getHardwareHint = (
  intl: IntlShape,
  rec: TranscriptionRecommendation,
  cap: DeviceCapability,
  modelLabel: string,
): string => {
  switch (rec.tier) {
    case "gpu-turbo":
      return intl.formatMessage(
        {
          defaultMessage: "GPU detected ({gpu}) — {model} runs fast.",
        },
        { gpu: cap.gpuName ?? "GPU", model: modelLabel },
      );
    case "cpu-small":
      return intl.formatMessage(
        {
          defaultMessage:
            "Capable CPU detected — {model} balances speed and accuracy.",
        },
        { model: modelLabel },
      );
    case "cpu-base":
      return intl.formatMessage(
        {
          defaultMessage: "CPU only — {model} is the fastest good fit.",
        },
        { model: modelLabel },
      );
    case "cpu-tiny":
    default:
      return intl.formatMessage(
        {
          defaultMessage:
            "Limited hardware detected — {model} is fastest on your CPU.",
        },
        { model: modelLabel },
      );
  }
};

const formatDownloadProgress = (
  snapshot: LocalSidecarDownloadSnapshot | undefined,
): string | null => {
  if (!snapshot) {
    return null;
  }

  const progressPart =
    snapshot.progress != null
      ? `${Math.round(Math.max(0, Math.min(1, snapshot.progress)) * 100)}%`
      : null;

  const bytesPart =
    snapshot.totalBytes != null && snapshot.totalBytes > 0
      ? `${formatSize(snapshot.bytesDownloaded)} of ${formatSize(snapshot.totalBytes)}`
      : snapshot.bytesDownloaded > 0
        ? formatSize(snapshot.bytesDownloaded)
        : null;

  if (progressPart && bytesPart) {
    return `${progressPart} • ${bytesPart}`;
  }

  return progressPart || bytesPart;
};

export type AITranscriptionConfigurationProps = {
  hideCloudOption?: boolean;
};

export const AITranscriptionConfiguration = ({
  hideCloudOption,
}: AITranscriptionConfigurationProps) => {
  const intl = useIntl();
  const transcription = useAppStore((state) => state.settings.aiTranscription);
  const effectiveMode = useAppStore(getEffectiveTranscriptionMode);
  const allowChange = useAppStore(getAllowsChangeTranscription);
  const localTranscriptionConfig = transcription.localModelManagement;

  // Real, measured speed data (when any exists locally) for the compact
  // "Your system & performance" diagnostics card below.
  const { events, transcriptions } = useInsightsSources();
  const transcriptionPerformance = useMemo(
    () => computeTranscriptionPerformance(transcriptions, events),
    [transcriptions, events],
  );

  const hasSelectedDevice = transcription.availableDevices.some(
    (device) => device.id === transcription.device,
  );
  const deviceValue = hasSelectedDevice
    ? transcription.device
    : (transcription.availableDevices[0]?.id ?? CPU_DEVICE_VALUE);
  const modelValue = normalizeLocalWhisperModel(transcription.modelSize);
  const modelDownloadSnapshot =
    localTranscriptionConfig.modelDownloads[modelValue];
  const modelDownloading = isLocalTranscriptionModelDownloadInProgress(
    modelDownloadSnapshot,
  );
  const modelSelectable = isLocalTranscriptionModelSelectable(
    transcription,
    modelValue,
  );
  const showInlineModelDownloadAction = !modelSelectable;

  // Hardware-aware recommendation, sourced entirely from the existing
  // get_device_capability command + recommendTranscription() helper.
  const [hardware, setHardware] = useState<{
    cap: DeviceCapability;
    rec: TranscriptionRecommendation;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void detectAndRecommend()
      .then((result) => {
        if (!cancelled) {
          setHardware(result);
        }
      })
      .catch((error) => {
        getLogger().verbose(`Failed to detect hardware capability: ${error}`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recommendedModel = hardware
    ? normalizeLocalWhisperModel(hardware.rec.modelSize)
    : null;

  // First-run / never-chosen default: point the selection at the recommended
  // model instead of the hardcoded DEFAULT_MODEL_SIZE ("tiny").
  const rawModelSizePref = useAppStore(
    (state) => state.userPrefs?.transcriptionModelSize ?? null,
  );

  useEffect(() => {
    if (effectiveMode !== "local" || !recommendedModel || rawModelSizePref) {
      return;
    }
    void setPreferredTranscriptionModelSize(recommendedModel);
  }, [effectiveMode, recommendedModel, rawModelSizePref]);

  // Gentle, non-blocking guardrail: only meaningful on CPU-only tiers, where
  // recommendTranscription() has already picked the heaviest comfortable
  // model. GPU tiers aren't guarded since the helper has no VRAM-per-model
  // data to warn against.
  const showGuardrailWarning =
    effectiveMode === "local" &&
    !!hardware &&
    !hardware.cap.hasUsableGpu &&
    !!recommendedModel &&
    MODEL_WEIGHT[modelValue] !== undefined &&
    MODEL_WEIGHT[recommendedModel] !== undefined &&
    MODEL_WEIGHT[modelValue]! > MODEL_WEIGHT[recommendedModel]!;

  const recommendedModelLabel = recommendedModel
    ? shortModelLabel(
        MODEL_OPTIONS.find((option) => option.value === recommendedModel)
          ?.label ?? recommendedModel,
      )
    : null;

  const hardwareHint =
    hardware && recommendedModelLabel
      ? getHardwareHint(intl, hardware.rec, hardware.cap, recommendedModelLabel)
      : null;

  useEffect(() => {
    if (effectiveMode !== "local") {
      return;
    }

    void refreshLocalTranscriptionDevices();
  }, [effectiveMode]);

  useEffect(() => {
    if (effectiveMode !== "local") {
      return;
    }

    void refreshLocalTranscriptionModelStatuses();
  }, [effectiveMode, transcription.device]);

  useEffect(() => {
    if (
      effectiveMode !== "local" ||
      !localTranscriptionConfig.modelStatusesLoaded
    ) {
      return;
    }

    if (isLocalTranscriptionModelSelectable(transcription, modelValue)) {
      return;
    }

    const fallbackModel = MODEL_OPTIONS.find((option) =>
      isLocalTranscriptionModelSelectable(transcription, option.value),
    )?.value;

    if (!fallbackModel || fallbackModel === modelValue) {
      return;
    }

    void setPreferredTranscriptionModelSize(fallbackModel);
  }, [
    transcription,
    localTranscriptionConfig.modelStatusesLoaded,
    modelValue,
    effectiveMode,
  ]);

  const handleModeChange = useCallback((mode: TranscriptionMode) => {
    void setPreferredTranscriptionMode(mode);
  }, []);

  const handleDeviceChange = useCallback((device: string) => {
    void setPreferredTranscriptionDevice(device);
  }, []);

  const handleModelSizeChange = useCallback(
    (rawModelSize: string) => {
      const modelSize = normalizeLocalWhisperModel(rawModelSize);
      if (!isLocalTranscriptionModelSelectable(transcription, modelSize)) {
        showErrorSnackbar("Download this model before selecting it.");
        return;
      }

      void setPreferredTranscriptionModelSize(modelSize);
    },
    [transcription],
  );

  const handleApiKeyChange = useCallback((id: string | null) => {
    void setPreferredTranscriptionApiKeyId(id);
  }, []);

  const handleDownloadModel = useCallback(
    (model: LocalWhisperModel) => {
      if (
        isLocalTranscriptionModelDownloadInProgress(
          localTranscriptionConfig.modelDownloads[model],
        )
      ) {
        return;
      }

      void downloadLocalTranscriptionModel(model);
    },
    [localTranscriptionConfig.modelDownloads],
  );

  const handleDeleteModel = useCallback(
    (model: LocalWhisperModel) => {
      if (localTranscriptionConfig.modelDeletes[model]) {
        return;
      }

      void (async () => {
        const statuses = await deleteLocalTranscriptionModel(model);
        if (modelValue !== model || !statuses) {
          return;
        }

        const fallbackModel = MODEL_OPTIONS.find(
          (option) =>
            statuses[option.value]?.downloaded && statuses[option.value]?.valid,
        )?.value;

        if (fallbackModel) {
          await setPreferredTranscriptionModelSize(fallbackModel);
        }
      })();
    },
    [localTranscriptionConfig.modelDeletes, modelValue],
  );

  if (!allowChange) {
    return <ManagedByOrgNotice />;
  }

  return (
    <Stack spacing={3} alignItems="flex-start" sx={{ width: "100%" }}>
      <SegmentedControl<TranscriptionMode>
        value={effectiveMode}
        onChange={handleModeChange}
        options={[
          ...maybeArrayElements<SegmentedControlOption<TranscriptionMode>>(
            !hideCloudOption,
            [
              {
                value: "cloud",
                label: "OS Voice",
              },
            ],
          ),
          { value: "api", label: "API" },
          { value: "local", label: "Local" },
        ]}
        ariaLabel="Processing mode"
      />

      {effectiveMode === "local" && (
        <Stack spacing={3} sx={{ width: "100%" }}>
          <FormControl
            fullWidth
            size="small"
            sx={{ position: "relative" }}
            disabled={transcription.availableDevicesLoading}
          >
            <InputLabel id="processing-device-label">
              <FormattedMessage defaultMessage="Processing device" />
            </InputLabel>
            <Select
              labelId="processing-device-label"
              label={<FormattedMessage defaultMessage="Processing device" />}
              value={deviceValue}
              onChange={(event) =>
                handleDeviceChange(String(event.target.value))
              }
            >
              {transcription.availableDevices.length === 0 ? (
                <MenuItem value={CPU_DEVICE_VALUE} disabled>
                  {transcription.availableDevicesLoading
                    ? intl.formatMessage({
                        defaultMessage: "Loading devices...",
                      })
                    : intl.formatMessage({
                        defaultMessage: "No devices available",
                      })}
                </MenuItem>
              ) : (
                transcription.availableDevices.map((device) => {
                  const modeLabel =
                    device.mode === "gpu"
                      ? intl.formatMessage({ defaultMessage: "GPU" })
                      : intl.formatMessage({ defaultMessage: "CPU" });

                  return (
                    <MenuItem key={device.id} value={device.id}>
                      {`${modeLabel} • ${device.name}`}
                    </MenuItem>
                  );
                })
              )}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel id="model-size-label">
              <FormattedMessage defaultMessage="Model size" />
            </InputLabel>
            <Select
              labelId="model-size-label"
              label={<FormattedMessage defaultMessage="Model size" />}
              value={modelValue}
              onChange={(event) =>
                handleModelSizeChange(String(event.target.value))
              }
              renderValue={(value) => {
                const model = normalizeLocalWhisperModel(String(value));
                const option = MODEL_OPTIONS.find(
                  (item) => item.value === model,
                );
                return option?.label ?? model;
              }}
              sx={
                showInlineModelDownloadAction
                  ? {
                      "& .MuiSelect-select": {
                        pr: "132px !important",
                      },
                    }
                  : undefined
              }
            >
              {MODEL_OPTIONS.map(({ value, label, helper }) => {
                const status = localTranscriptionConfig.modelStatuses[value];
                const downloadSnapshot =
                  localTranscriptionConfig.modelDownloads[value];
                const downloading =
                  isLocalTranscriptionModelDownloadInProgress(downloadSnapshot);
                const deleting = !!localTranscriptionConfig.modelDeletes[value];
                const selectable = isLocalTranscriptionModelSelectable(
                  transcription,
                  value,
                );
                const progressLabel = formatDownloadProgress(downloadSnapshot);

                return (
                  <MenuItem key={value} value={value}>
                    <Stack spacing={0.75} sx={{ width: "100%" }}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={1}
                        sx={{ width: "100%" }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.75}
                            flexWrap="wrap"
                          >
                            <Typography variant="body2" fontWeight={600}>
                              {label}
                            </Typography>
                            {recommendedModel === value && (
                              <Chip
                                label={intl.formatMessage({
                                  defaultMessage:
                                    "Recommended for your hardware",
                                })}
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ height: 20, fontSize: 11 }}
                              />
                            )}
                          </Stack>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            {helper}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {selectable
                              ? intl.formatMessage({
                                  defaultMessage: "Downloaded",
                                })
                              : status?.validationError || null}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="contained"
                          color={selectable ? "error" : "primary"}
                          disabled={downloading || deleting}
                          sx={{
                            minWidth: 0,
                            minHeight: 24,
                            px: 1.25,
                            borderRadius: 999,
                            boxShadow: "none",
                            textTransform: "none",
                            fontSize: 12,
                            lineHeight: 1.2,
                            alignSelf: "center",
                            "&:hover": {
                              boxShadow: "none",
                            },
                          }}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (selectable) {
                              handleDeleteModel(value);
                              return;
                            }
                            handleDownloadModel(value);
                          }}
                        >
                          {downloading
                            ? intl.formatMessage({
                                defaultMessage: "Downloading...",
                              })
                            : deleting
                              ? intl.formatMessage({
                                  defaultMessage: "Deleting...",
                                })
                              : selectable
                                ? intl.formatMessage({
                                    defaultMessage: "Delete",
                                  })
                                : intl.formatMessage({
                                    defaultMessage: "Download",
                                  })}
                        </Button>
                      </Stack>

                      {downloading && (
                        <LinearProgress
                          variant={
                            downloadSnapshot?.progress != null
                              ? "determinate"
                              : "indeterminate"
                          }
                          value={
                            downloadSnapshot?.progress != null
                              ? Math.max(
                                  0,
                                  Math.min(1, downloadSnapshot.progress),
                                ) * 100
                              : undefined
                          }
                        />
                      )}

                      {downloading && progressLabel && (
                        <Typography variant="caption" color="text.secondary">
                          {progressLabel}
                        </Typography>
                      )}
                    </Stack>
                  </MenuItem>
                );
              })}
            </Select>
            {showInlineModelDownloadAction && (
              <Box
                sx={{
                  position: "absolute",
                  right: 36,
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: 1,
                }}
              >
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  sx={{
                    minWidth: 0,
                    minHeight: 24,
                    px: 1.25,
                    borderRadius: 999,
                    boxShadow: "none",
                    textTransform: "none",
                    fontSize: 12,
                    lineHeight: 1.2,
                    "&:hover": {
                      boxShadow: "none",
                    },
                  }}
                  disabled={modelDownloading}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDownloadModel(modelValue);
                  }}
                >
                  {modelDownloading
                    ? intl.formatMessage({ defaultMessage: "Downloading..." })
                    : intl.formatMessage({ defaultMessage: "Download" })}
                </Button>
              </Box>
            )}
          </FormControl>

          {hardwareHint && (
            <Typography variant="caption" color="text.secondary">
              {hardwareHint}
            </Typography>
          )}

          {showGuardrailWarning && recommendedModelLabel && (
            <Alert severity="warning" variant="outlined" sx={{ width: "100%" }}>
              <FormattedMessage
                defaultMessage="This model may be slow on your hardware; {recommended} is recommended."
                values={{ recommended: recommendedModelLabel }}
              />
            </Alert>
          )}

          {localTranscriptionConfig.modelStatusesLoading && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                <FormattedMessage defaultMessage="Refreshing model status..." />
              </Typography>
            </Stack>
          )}
        </Stack>
      )}

      {effectiveMode === "api" && (
        <ApiKeyList
          selectedApiKeyId={transcription.selectedApiKeyId}
          onChange={handleApiKeyChange}
          context="transcription"
        />
      )}

      {effectiveMode === "cloud" && <VoquillCloudSetting />}

      <SystemDiagnostics compact performance={transcriptionPerformance} />
    </Stack>
  );
};
