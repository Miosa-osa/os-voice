import { invoke } from "@tauri-apps/api/core";
import { getAppState, produceAppState } from "../store";
import {
  DeviceCapability,
  TranscriptionRecommendation,
  liteModelFor,
  recommendTranscription,
} from "../lib/hardware/recommend";
import { getMyUserPreferences } from "../utils/user.utils";
import { VERBATIM_TONE_ID } from "../utils/tone.utils";
import { getLogger } from "../utils/log.utils";
import { showSnackbar } from "./app.actions";
import { setSelectedToneId, updateUserPreferences } from "./user.actions";

export const getDeviceCapability = (): Promise<DeviceCapability> =>
  invoke<DeviceCapability>("get_device_capability");

export const detectAndRecommend = async (): Promise<{
  cap: DeviceCapability;
  rec: TranscriptionRecommendation;
}> => {
  const cap = await getDeviceCapability();
  return { cap, rec: recommendTranscription(cap) };
};

export const applyRecommendedTranscription = async (
  rec: TranscriptionRecommendation,
): Promise<void> => {
  produceAppState((draft) => {
    draft.settings.aiTranscription.mode = rec.mode;
  });
  await updateUserPreferences((preferences) => {
    preferences.transcriptionMode = rec.mode;
    preferences.transcriptionDevice = rec.device;
    preferences.transcriptionModelSize = rec.modelSize;
  });
};

export const setLiteMode = async (enabled: boolean): Promise<void> => {
  produceAppState((draft) => {
    draft.local.liteMode = enabled;
  });

  if (!enabled) {
    return;
  }

  const cap = await getDeviceCapability();
  produceAppState((draft) => {
    draft.settings.aiTranscription.mode = "local";
  });
  await updateUserPreferences((preferences) => {
    preferences.transcriptionMode = "local";
    preferences.transcriptionDevice = cap.hasUsableGpu ? "gpu:0" : "cpu";
    preferences.transcriptionModelSize = liteModelFor(cap);
  });
  await setSelectedToneId(VERBATIM_TONE_ID);
};

// Only a genuinely GPU/device-related failure should trigger the downgrade —
// not a network/IPC/timeout/audio error, which would wrongly strand a working
// GPU user on the slow CPU model.
const isGpuError = (error: unknown): boolean => {
  const text = (
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? "")
  ).toLowerCase();
  return /cuda|vulkan|\bgpu\b|device|vram|out of memory|\boom\b|cublas|no kernel image|metal/.test(
    text,
  );
};

// Runtime safety net: if a local GPU transcription fails *with a GPU-specific
// error*, switch to CPU with a size-appropriate model so the user is never stuck
// on an unusable GPU config.
export const fallbackToCpuIfGpuFailed = async (
  error: unknown,
): Promise<boolean> => {
  if (!isGpuError(error)) {
    return false;
  }
  const prefs = getMyUserPreferences(getAppState());
  const device = prefs?.transcriptionDevice ?? "";
  if (prefs?.transcriptionMode !== "local" || !device.startsWith("gpu")) {
    return false;
  }

  try {
    const cap = await getDeviceCapability();
    const modelSize = cap.cpuCores >= 8 && cap.ramGb >= 8 ? "small" : "base";
    await updateUserPreferences((preferences) => {
      preferences.transcriptionDevice = "cpu";
      preferences.transcriptionModelSize = modelSize;
    });
    getLogger().warning("GPU transcription failed — switched to CPU");
    showSnackbar("GPU unavailable — switched to CPU for transcription.");
    return true;
  } catch (error) {
    getLogger().error(`CPU fallback failed: ${error}`);
    return false;
  }
};
