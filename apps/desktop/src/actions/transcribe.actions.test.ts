import { expect, it, vi } from "vitest";
vi.mock("../repos", () => ({
  getGenerateTextRepo: () => ({
    repo: {
      generateText: async () => {
        throw new Error("model unavailable");
      },
    },
    apiKeyId: "test",
    warnings: [],
  }),
}));
vi.mock("../store", () => ({
  getAppState: () => ({ enterpriseConfig: null }),
}));
vi.mock("../utils/tone.utils", () => ({
  getToneById: () => null,
  getToneConfig: () => ({}),
}));
vi.mock("../utils/user.utils", () => ({ getMyUserName: () => "Roberto" }));
vi.mock("../utils/prompt.utils", () => ({
  buildSystemPostProcessingTonePrompt: () => "system",
  buildPostProcessingPrompt: () => "prompt",
  PROCESSED_TRANSCRIPTION_JSON_SCHEMA: {},
}));
vi.mock("../utils/log.utils", () => ({
  getLogger: () => ({ info: vi.fn(), verbose: vi.fn(), warning: vi.fn() }),
}));
vi.mock("./user.actions", () => ({}));
vi.mock("./app.actions", () => ({}));
import { postProcessTranscript } from "./transcribe.actions";
it("retains the entire raw transcript when the polishing provider fails", async () => {
  const text = "Keep every word.\n\n日本語もそのまま。";
  const result = await postProcessTranscript({
    rawTranscript: text,
    toneId: null,
    dictationLanguage: "en",
  });
  expect(result.transcript).toBe(text);
  expect(result.warnings).toHaveLength(1);
  expect(result.metadata.postProcessMode).toBe("none");
});
