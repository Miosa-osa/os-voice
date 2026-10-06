import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  cpu: { ensureStarted: vi.fn(), transcribe: vi.fn() },
  gpu: { ensureStarted: vi.fn(), transcribe: vi.fn() },
}));
vi.mock("./local-transcription.sidecar", () => ({
  LocalTranscriptionSidecar: class {
    constructor(mode: "cpu" | "gpu") {
      Object.assign(this, mocks[mode]);
    }
  },
  SidecarRequestError: class extends Error {},
}));
vi.mock("../utils/log.utils", () => ({
  getLogger: () => ({ warning: vi.fn() }),
}));
vi.mock("../utils/local-transcription.utils", () => ({
  supportsGpuTranscriptionDevice: () => true,
  LOCAL_WHISPER_MODELS: ["turbo"],
}));
vi.mock("./sidecar.utils", () => ({
  toErrorMessage: (e: unknown) => String(e),
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.cpu.ensureStarted.mockResolvedValue(undefined);
  mocks.gpu.ensureStarted.mockResolvedValue(undefined);
  mocks.cpu.transcribe.mockResolvedValue({ text: "cpu" });
  mocks.gpu.transcribe.mockResolvedValue({ text: "gpu" });
});
it("temporarily falls back after GPU failure, then retries the selected GPU model", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(100000);
  try {
    const { getLocalTranscriptionSidecarManager } = await import("./index");
    const engine = getLocalTranscriptionSidecarManager();
    const input = {
      model: "turbo" as const,
      samples: new Float32Array(160),
      sampleRate: 16000,
      preferGpu: true,
      deviceId: "gpu:0",
    };
    mocks.gpu.ensureStarted.mockRejectedValueOnce(new Error("GPU unavailable"));
    expect((await engine.transcribe(input)).text).toBe("cpu");
    now.mockReturnValue(159999);
    await engine.transcribe(input);
    expect(mocks.gpu.ensureStarted).toHaveBeenCalledTimes(1);
    now.mockReturnValue(160001);
    expect((await engine.transcribe(input)).text).toBe("gpu");
    expect(mocks.gpu.transcribe).toHaveBeenLastCalledWith(input);
  } finally {
    now.mockRestore();
  }
});
