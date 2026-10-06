import { afterEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { fetchWithTimeout } from "./sidecar.utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: async () => Response.json({ text: "Ready." }),
}));

afterEach(() => vi.resetAllMocks());

it("transfers an audio chunk and its response in one native call", async () => {
  vi.mocked(invoke).mockResolvedValue({
    status: 200,
    body: '{"text":"Ready."}',
  });
  const response = await fetchWithTimeout(
    "http://127.0.0.1:7772/v1/transcriptions/sessions/one/chunks",
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array([0, 128, 63, 255]).buffer,
    },
    2000,
  );
  expect(await response.json()).toEqual({ text: "Ready." });
  expect(invoke).toHaveBeenCalledExactlyOnceWith("local_sidecar_request", {
    url: "http://127.0.0.1:7772/v1/transcriptions/sessions/one/chunks",
    method: "POST",
    contentType: "application/octet-stream",
    body: [0, 128, 63, 255],
    timeoutMs: 2000,
  });
});

it("preserves HTTP errors for the sidecar retry policy", async () => {
  vi.mocked(invoke).mockResolvedValue({
    status: 404,
    body: '{"code":"session_not_found"}',
  });
  const response = await fetchWithTimeout(
    "http://127.0.0.1:7772/v1/transcriptions/sessions/missing",
    undefined,
    500,
  );
  expect(response.status).toBe(404);
  expect(response.ok).toBe(false);
  expect(await response.json()).toEqual({ code: "session_not_found" });
});
