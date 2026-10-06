import { beforeEach, expect, it, vi } from "vitest";
import { LocalTranscriptionSession } from "./local-transcription-session";
import { transcribeAudio } from "../actions/transcribe.actions";

const control = vi.hoisted(() => ({
  listener: null as
    | null
    | ((event: { payload: { samples: number[] } }) => void),
  createSession: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: async (_name: string, listener: typeof control.listener) => {
    control.listener = listener;
    return vi.fn();
  },
}));
vi.mock("../store", () => ({
  getAppState: () => ({
    settings: { aiTranscription: { device: "gpu:0", modelSize: "turbo" } },
  }),
}));
vi.mock("../sidecars", () => ({
  getLocalTranscriptionSidecarManager: () => ({
    createStreamingSession: control.createSession,
  }),
}));
vi.mock("../utils/local-transcription.utils", () => ({
  getTranscriptionSidecarDeviceId: () => "gpu:0",
  isGpuPreferredTranscriptionDevice: () => true,
  normalizeLocalWhisperModel: () => "turbo",
}));
vi.mock("../utils/log.utils", () => ({
  getLogger: () => ({ info: vi.fn(), warning: vi.fn() }),
}));
vi.mock("../utils/prompt.utils", () => ({
  buildLocalizedTranscriptionPrompt: () => "",
  collectDictionaryEntries: () => [],
}));
vi.mock("../utils/language.utils", () => ({
  mapDictationLanguageToWhisperLanguage: () => "en",
}));
vi.mock("../utils/user.utils", () => ({
  loadMyEffectiveDictationLanguage: async () => "en",
}));
vi.mock("../actions/transcribe.actions", () => ({ transcribeAudio: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  control.listener = null;
});

const sidecarSession = (text: string) => ({
  writeAudioChunk: vi.fn(),
  finalize: vi.fn(async () => ({
    text,
    model: "turbo",
    inferenceDevice: "GPU",
    mode: "gpu",
    durationMs: 1,
  })),
  cleanup: vi.fn(),
});

it("recognizes audio events in the background before the recording is finalized", async () => {
  const first = sidecarSession("We are talking");
  const second = sidecarSession("are talking now.");
  control.createSession
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(second);
  const session = new LocalTranscriptionSession();
  await session.onRecordingStart(1);
  const samples = new Float32Array(31).fill(1);
  control.listener?.({ payload: { samples: Array.from(samples) } });
  await vi.waitFor(() => expect(first.finalize).toHaveBeenCalledOnce());
  const result = await session.finalize({ samples, sampleRate: 1 });
  expect(result.rawTranscript).toBe("We are talking now.");
  expect(transcribeAudio).not.toHaveBeenCalled();
});

it("retries all original audio when a background section fails", async () => {
  const failed = sidecarSession("unused");
  failed.finalize.mockRejectedValue(new Error("engine connection lost"));
  control.createSession.mockResolvedValue(failed);
  vi.mocked(transcribeAudio).mockResolvedValue({
    rawTranscript: "The complete recording.",
    metadata: {},
    warnings: [],
  });
  const session = new LocalTranscriptionSession();
  await session.onRecordingStart(1);
  const samples = new Float32Array(31).fill(1);
  control.listener?.({ payload: { samples: Array.from(samples) } });
  const result = await session.finalize({ samples, sampleRate: 1 });
  expect(transcribeAudio).toHaveBeenCalledExactlyOnceWith({
    samples,
    sampleRate: 1,
  });
  expect(result.rawTranscript).toBe("The complete recording.");
  expect(result.warnings.join(" ")).toContain("falling back to batch mode");
});
