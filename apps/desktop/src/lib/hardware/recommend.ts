export type DeviceCapability = {
  hasUsableGpu: boolean;
  gpuName: string | null;
  cpuCores: number;
  ramGb: number;
};

export type RecommendationTier =
  | "gpu-turbo"
  | "cpu-small"
  | "cpu-base"
  | "cpu-tiny";

export type TranscriptionRecommendation = {
  mode: "local" | "cloud";
  device: string;
  modelSize: string;
  tier: RecommendationTier;
  suggestCloud: boolean;
};

// Maps raw hardware facts to the fastest usable local model+device.
// Benchmarks (no GPU, CPU only): tiny ~15xRT, base ~7x, small ~2x, turbo ~0.3x (unusable).
export const recommendTranscription = (
  cap: DeviceCapability,
): TranscriptionRecommendation => {
  if (cap.hasUsableGpu) {
    return {
      mode: "local",
      device: "gpu:0",
      modelSize: "large-v3-turbo",
      tier: "gpu-turbo",
      suggestCloud: false,
    };
  }
  if (cap.cpuCores >= 8 && cap.ramGb >= 8) {
    return {
      mode: "local",
      device: "cpu",
      modelSize: "small",
      tier: "cpu-small",
      suggestCloud: false,
    };
  }
  if (cap.cpuCores >= 4 && cap.ramGb >= 4) {
    return {
      mode: "local",
      device: "cpu",
      modelSize: "base",
      tier: "cpu-base",
      suggestCloud: false,
    };
  }
  return {
    mode: "local",
    device: "cpu",
    modelSize: "tiny",
    tier: "cpu-tiny",
    suggestCloud: true,
  };
};

// Smallest viable local model for a given machine (used by Lite mode).
export const liteModelFor = (cap: DeviceCapability): string =>
  cap.hasUsableGpu ? "base" : "tiny";
