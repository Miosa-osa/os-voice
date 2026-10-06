import { afterEach, expect, it, vi } from "vitest";
import { spawnShellSidecar } from "../utils/tauri-shell.utils";
import { LocalTranscriptionSidecar } from "./local-transcription.sidecar";

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: async () => "/tmp/osvoice-test",
  join: async (...parts: string[]) => parts.join("/"),
}));
vi.mock("../utils/log.utils", () => ({
  getLogger: () => ({ info: vi.fn(), verbose: vi.fn(), warning: vi.fn() }),
}));
vi.mock("../utils/tauri-shell.utils", () => ({ spawnShellSidecar: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (_command: string, args: { url: string; method: string }) => {
    const response = await globalThis.fetch(args.url, { method: args.method });
    return { status: response.status, body: await response.text() };
  },
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it("returns the transcript without waiting for session cleanup", async () => {
  vi.useFakeTimers();
  vi.mocked(spawnShellSidecar).mockImplementation(async ({ onStdout }) => {
    onStdout?.("RUST_TRANSCRIPTION_BOUND_PORT=7772\n");
    return { pid: 123, kill: async () => {}, write: async () => {} };
  });
  let finishCleanup!: (response: Response) => void;
  const cleanup = new Promise<Response>((resolve) => {
    finishCleanup = resolve;
  });
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") return cleanup;
    if (url.endsWith("/health"))
      return Response.json({ status: "ok", mode: "gpu" });
    if (url.includes("/status"))
      return Response.json({ downloaded: true, valid: true });
    if (url.endsWith("/sessions"))
      return Response.json({ sessionId: "test-session" });
    return Response.json({
      text: "Ready now.",
      model: "turbo",
      durationMs: 280,
      inferenceDevice: "GPU",
    });
  });
  vi.stubGlobal("fetch", fetch);
  const sidecar = new LocalTranscriptionSidecar("gpu");
  const session = await sidecar.createStreamingSession({
    model: "turbo",
    sampleRate: 16000,
    preferGpu: true,
  });
  let text: string | undefined;
  const result = session.finalize().then((output) => {
    text = output.text;
  });
  await vi.advanceTimersByTimeAsync(1);
  try {
    expect(text).toBe("Ready now.");
    session.cleanup();
    expect(
      fetch.mock.calls.filter(([, init]) => init?.method === "DELETE"),
    ).toHaveLength(1);
  } finally {
    finishCleanup(Response.json({ deleted: true }));
    await result;
    await sidecar.dispose();
  }
});

it("keeps the speech engine running across a long idle period", async () => {
  vi.useFakeTimers();
  const kill = vi.fn(async () => {});
  vi.mocked(spawnShellSidecar).mockImplementation(async ({ onStdout }) => {
    onStdout?.("RUST_TRANSCRIPTION_BOUND_PORT=7772\n");
    return { pid: 123, kill, write: async () => {} };
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url.endsWith("/health")
          ? { status: "ok", mode: "gpu" }
          : { devices: [{ id: "gpu:0", name: "Test GPU" }] },
      ),
    ),
  );
  const sidecar = new LocalTranscriptionSidecar("gpu");
  await sidecar.listDevices();
  await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
  await sidecar.listDevices();
  expect(kill).not.toHaveBeenCalled();
  expect(spawnShellSidecar).toHaveBeenCalledTimes(1);
  await sidecar.dispose();
  expect(kill).toHaveBeenCalledTimes(1);
});

it("restarts the engine after a transport failure and retries the request", async () => {
  vi.useFakeTimers();
  const kill = vi.fn(async () => {});
  vi.mocked(spawnShellSidecar).mockImplementation(async ({ onStdout }) => {
    onStdout?.("RUST_TRANSCRIPTION_BOUND_PORT=7772\n");
    return { pid: 123, kill, write: async () => {} };
  });
  let requests = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/health"))
        return Response.json({ status: "ok", mode: "gpu" });
      if (requests++ === 0) throw "connection reset";
      return Response.json({ downloaded: true, valid: true });
    }),
  );
  const sidecar = new LocalTranscriptionSidecar("gpu");
  const outcome = sidecar.getModelStatus("turbo").catch(() => null);
  await vi.advanceTimersByTimeAsync(300);
  expect(await outcome).toEqual({ downloaded: true, valid: true });
  expect(spawnShellSidecar).toHaveBeenCalledTimes(2);
  expect(kill).toHaveBeenCalledTimes(1);
  await sidecar.dispose();
});
