import {
  supportsGpuTranscriptionDevice,
  type LocalWhisperModel,
  LOCAL_WHISPER_MODELS,
} from "../utils/local-transcription.utils";
import { getLogger } from "../utils/log.utils";
import {
  LocalTranscriptionSidecar,
  SidecarRequestError,
  type LocalSidecarDevice,
  type LocalSidecarDownloadSnapshot,
  type LocalSidecarModelStatus,
  type LocalSidecarStreamingSession,
  type LocalSidecarStreamingSessionInput,
  type LocalSidecarTranscribeInput,
  type LocalSidecarTranscribeOutput,
} from "./local-transcription.sidecar";
import { toErrorMessage } from "./sidecar.utils";

// Pre-warm uses a short silent buffer purely to force the whisper model context
// to load into the engine's in-process cache. Length barely matters for cost
// (whisper pads to a 30s mel and runs a single encode pass regardless), so 1s
// @ 16kHz is comfortably above any minimum-input quirk while staying cheap.
const WARMUP_SAMPLE_RATE = 16_000;
const WARMUP_SAMPLE_COUNT = 16_000;

export type {
  LocalSidecarDevice,
  LocalSidecarDownloadSnapshot,
  LocalSidecarModelStatus,
  LocalSidecarStreamingSession,
  LocalSidecarStreamingSessionInput,
  LocalSidecarTranscribeInput,
  LocalSidecarTranscribeOutput,
} from "./local-transcription.sidecar";

class LocalTranscriptionSidecarFacade {
  private cpuSidecar = new LocalTranscriptionSidecar("cpu");
  private gpuSidecar = new LocalTranscriptionSidecar("gpu");
  private gpuUnavailable = false;

  async listAvailableDevices(): Promise<LocalSidecarDevice[]> {
    await this.cpuSidecar.ensureStarted();
    const cpuDevices = await this.cpuSidecar.listDevices();
    const devices = [...cpuDevices];

    if (supportsGpuTranscriptionDevice() && !this.gpuUnavailable) {
      try {
        await this.gpuSidecar.ensureStarted();
        const gpuDevices = await this.gpuSidecar.listDevices();
        devices.push(...gpuDevices);
      } catch (error) {
        this.markGpuUnavailable(error);
      }
    }

    return devices;
  }

  async listModelStatuses({
    preferGpu,
    validate = true,
    models = LOCAL_WHISPER_MODELS,
  }: {
    preferGpu: boolean;
    validate?: boolean;
    models?: LocalWhisperModel[];
  }): Promise<Record<LocalWhisperModel, LocalSidecarModelStatus>> {
    const sidecar = await this.resolveRuntime(preferGpu);
    return await sidecar.listModelStatuses(models, validate);
  }

  async getModelStatus({
    model,
    preferGpu,
    validate = true,
  }: {
    model: LocalWhisperModel;
    preferGpu: boolean;
    validate?: boolean;
  }): Promise<LocalSidecarModelStatus> {
    const sidecar = await this.resolveRuntime(preferGpu);
    return await sidecar.getModelStatus(model, validate);
  }

  async downloadModel({
    model,
    preferGpu,
    onProgress,
  }: {
    model: LocalWhisperModel;
    preferGpu: boolean;
    onProgress?: (snapshot: LocalSidecarDownloadSnapshot) => void;
  }): Promise<LocalSidecarModelStatus> {
    const sidecar = await this.resolveRuntime(preferGpu);
    return await sidecar.downloadModel(model, onProgress);
  }

  async deleteModel({
    model,
    preferGpu,
  }: {
    model: LocalWhisperModel;
    preferGpu: boolean;
  }): Promise<LocalSidecarModelStatus> {
    const sidecar = await this.resolveRuntime(preferGpu);
    const result = await sidecar.deleteModel(model);
    this.cpuSidecar.invalidateModelReadiness(model);
    this.gpuSidecar.invalidateModelReadiness(model);
    return result;
  }

  async transcribe(
    input: LocalSidecarTranscribeInput,
  ): Promise<LocalSidecarTranscribeOutput> {
    const sidecar = await this.resolveRuntime(input.preferGpu);

    try {
      return await sidecar.transcribe(input);
    } catch (error) {
      if (
        input.preferGpu &&
        sidecar === this.gpuSidecar &&
        this.shouldFallbackToCpu(error)
      ) {
        this.markGpuUnavailable(error);
        return await this.cpuSidecar.transcribe({
          ...input,
          deviceId: undefined,
        });
      }

      throw error;
    }
  }

  async createStreamingSession(
    input: LocalSidecarStreamingSessionInput,
  ): Promise<LocalSidecarStreamingSession> {
    const sidecar = await this.resolveRuntime(input.preferGpu);

    try {
      return await sidecar.createStreamingSession(input);
    } catch (error) {
      if (
        input.preferGpu &&
        sidecar === this.gpuSidecar &&
        this.shouldFallbackToCpu(error)
      ) {
        this.markGpuUnavailable(error);
        return await this.cpuSidecar.createStreamingSession({
          ...input,
          deviceId: undefined,
        });
      }

      throw error;
    }
  }

  /**
   * Best-effort pre-warm: eagerly spawn the preferred local sidecar process and
   * load the whisper model context into its in-process cache, so the FIRST
   * dictation starts transcribing immediately instead of paying the
   * spawn + model-load cold start.
   *
   * Safe by construction:
   * - Never triggers a model download (bails if the model is not on disk).
   * - Only touches the preferred sidecar and never flips the shared GPU->CPU
   *   fallback flag, so a warmup failure can never degrade real dictations.
   * - Mirrors the exact request path (same model + device cache key) a real
   *   dictation uses, so the next dictation is a guaranteed cache hit.
   * - Caller wraps this non-fatally; a throw here must never block a dictation.
   *
   * Returns true if the model context was warmed, false if it was skipped
   * (e.g. the model is not downloaded yet).
   */
  async warmUp({
    model,
    preferGpu,
    deviceId,
  }: {
    model: LocalWhisperModel;
    preferGpu: boolean;
    deviceId?: string;
  }): Promise<boolean> {
    const useGpu = preferGpu && !this.gpuUnavailable;
    const sidecar = useGpu ? this.gpuSidecar : this.cpuSidecar;

    // Eagerly start the sidecar process (spawn warm).
    await sidecar.ensureStarted();

    // Never kick off a background download during pre-warm; only warm models
    // that are already present on disk.
    const status = await sidecar.getModelStatus(model, false);
    if (!status.downloaded) {
      return false;
    }

    // Load + cache the whisper context by running a tiny silent transcription.
    await sidecar.transcribe({
      model,
      samples: new Float32Array(WARMUP_SAMPLE_COUNT),
      sampleRate: WARMUP_SAMPLE_RATE,
      preferGpu: useGpu,
      deviceId,
    });

    return true;
  }

  private async resolveRuntime(
    preferGpu: boolean,
  ): Promise<LocalTranscriptionSidecar> {
    if (preferGpu && !this.gpuUnavailable) {
      try {
        await this.gpuSidecar.ensureStarted();
        return this.gpuSidecar;
      } catch (error) {
        this.markGpuUnavailable(error);
      }
    }

    await this.cpuSidecar.ensureStarted();
    return this.cpuSidecar;
  }

  private shouldFallbackToCpu(error: unknown): boolean {
    if (error instanceof SidecarRequestError) {
      return error.status === undefined;
    }

    const message = toErrorMessage(error).toLowerCase();
    return message.includes("sidecar") || message.includes("request failed");
  }

  private markGpuUnavailable(error: unknown): void {
    this.gpuUnavailable = true;
    getLogger().warning(
      `[local-sidecar:gpu] unavailable, falling back to CPU (${toErrorMessage(error)})`,
    );
  }
}

let localTranscriptionFacade: LocalTranscriptionSidecarFacade | null = null;

export const getLocalTranscriptionSidecarManager =
  (): LocalTranscriptionSidecarFacade => {
    localTranscriptionFacade ??= new LocalTranscriptionSidecarFacade();
    return localTranscriptionFacade;
  };
