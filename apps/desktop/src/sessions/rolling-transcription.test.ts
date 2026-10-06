import { expect, it, vi } from "vitest";
import type {
  LocalSidecarStreamingSession,
  LocalSidecarTranscribeOutput,
} from "../sidecars/local-transcription.sidecar";
import { createRollingTranscriptionSession } from "./rolling-transcription";

const output = (text: string): LocalSidecarTranscribeOutput => ({
  text,
  model: "turbo",
  inferenceDevice: "GPU",
  durationMs: 1,
  mode: "gpu",
});

const fakeSession = (text: string) => ({
  writeAudioChunk: vi.fn(),
  finalize: vi.fn(async () => output(text)),
  cleanup: vi.fn(),
});

it("recognizes completed sections before recording stops and retains boundary audio", async () => {
  const sessions = [
    fakeSession("We need a fast application"),
    fakeSession("a fast application for long talks"),
    fakeSession("for long talks too."),
  ];
  let index = 0;
  const factory = vi.fn(async () => sessions[index++]);
  const rolling = await createRollingTranscriptionSession(factory, 1);
  rolling.writeAudioChunk(Float32Array.from({ length: 60 }, (_, i) => i));
  await vi.waitFor(() => expect(sessions[1].finalize).toHaveBeenCalledOnce());
  expect(sessions[2].finalize).not.toHaveBeenCalled();
  const result = await rolling.finalize();
  expect(result.text).toBe("We need a fast application for long talks too.");
  const audio = sessions.map((session) =>
    session.writeAudioChunk.mock.calls.flatMap(([samples]) =>
      Array.from(samples),
    ),
  );
  expect(audio).toEqual([
    Array.from({ length: 30 }, (_, i) => i),
    Array.from({ length: 30 }, (_, i) => i + 27),
    [54, 55, 56, 57, 58, 59],
  ]);
  expect(await rolling.finalize()).toBe(result);
});

it("does not transcribe an overlap-only tail at an exact section boundary", async () => {
  const session = fakeSession("The complete sentence.");
  const factory = vi.fn(async () => session);
  const rolling = await createRollingTranscriptionSession(factory, 1);
  rolling.writeAudioChunk(new Float32Array(30).fill(1));
  expect((await rolling.finalize()).text).toBe("The complete sentence.");
  expect(factory).toHaveBeenCalledOnce();
  expect(session.finalize).toHaveBeenCalledOnce();
});

it("ends a section at a speech pause instead of cutting through the next phrase", async () => {
  const first = fakeSession("The first sentence.");
  const second = fakeSession("The first sentence. Next phrase.");
  const factory = vi
    .fn()
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(second);
  const rolling = await createRollingTranscriptionSession(factory, 100);
  const audio = new Float32Array(2120).fill(1);
  audio.fill(0, 2000, 2020);
  rolling.writeAudioChunk(audio);
  expect((await rolling.finalize()).text).toBe(
    "The first sentence. Next phrase.",
  );
  const firstAudio = first.writeAudioChunk.mock.calls.flatMap(([samples]) =>
    Array.from(samples),
  );
  const secondAudio = second.writeAudioChunk.mock.calls.flatMap(([samples]) =>
    Array.from(samples),
  );
  expect(firstAudio).toEqual(Array.from(audio.subarray(0, 2020)));
  expect(secondAudio).toEqual(Array.from(audio.subarray(1720)));
});

it("keeps accepting audio while an earlier section is still being recognized", async () => {
  const first = fakeSession("We are still talking");
  const second = fakeSession("still talking here.");
  let resolve!: (result: LocalSidecarTranscribeOutput) => void;
  first.finalize.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const factory = vi
    .fn()
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(second);
  const rolling = await createRollingTranscriptionSession(factory, 1);
  rolling.writeAudioChunk(new Float32Array(31).fill(1));
  await vi.waitFor(() =>
    expect(second.writeAudioChunk).toHaveBeenCalledTimes(2),
  );
  const result = rolling.finalize();
  resolve(output("We are still talking"));
  expect((await result).text).toBe("We are still talking here.");
});

it("propagates a section failure so the caller can retry the entire recording", async () => {
  const session = fakeSession("unused");
  session.finalize.mockRejectedValue(new Error("engine stopped"));
  const rolling = await createRollingTranscriptionSession(
    async () => session,
    1,
  );
  rolling.writeAudioChunk(new Float32Array(30).fill(1));
  await expect(rolling.finalize()).rejects.toThrow("engine stopped");
  expect(session.cleanup).toHaveBeenCalled();
});

it("requests a full-recording retry when overlapping sections cannot be reconciled", async () => {
  const factory = vi
    .fn()
    .mockResolvedValueOnce(fakeSession("The first sentence."))
    .mockResolvedValueOnce(
      fakeSession("Unrelated words with no matching boundary."),
    );
  const rolling = await createRollingTranscriptionSession(factory, 1);
  rolling.writeAudioChunk(new Float32Array(31).fill(1));
  await expect(rolling.finalize()).rejects.toThrow("Unable to reconcile");
});

it("cleans up a new section that finishes opening after cancellation", async () => {
  const first = fakeSession("first");
  const second = fakeSession("second");
  let resolve!: (session: LocalSidecarStreamingSession) => void;
  const pending = new Promise<LocalSidecarStreamingSession>((done) => {
    resolve = done;
  });
  const factory = vi
    .fn()
    .mockResolvedValueOnce(first)
    .mockReturnValueOnce(pending);
  const rolling = await createRollingTranscriptionSession(factory, 1);
  rolling.writeAudioChunk(new Float32Array(31).fill(1));
  await vi.waitFor(() => expect(factory).toHaveBeenCalledTimes(2));
  rolling.cleanup();
  resolve(second);
  await expect(rolling.finalize()).rejects.toThrow("cancelled");
  expect(second.cleanup).toHaveBeenCalledOnce();
  expect(second.writeAudioChunk).not.toHaveBeenCalled();
});
