import { invoke } from "@tauri-apps/api/core";

export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, ms));

export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

export const isTauriEnvironment = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const tauriWindow = window as typeof window & Record<string, unknown>;
  return (
    "__TAURI_INTERNALS__" in tauriWindow ||
    "__TAURI__" in tauriWindow ||
    "__TAURI_IPC__" in tauriWindow
  );
};

export const fetchWithTimeout = async (
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> => {
  const bytes =
    init?.body == null
      ? undefined
      : new Uint8Array(await new Response(init.body).arrayBuffer());
  const response = await invoke<{ status: number; body: string }>(
    "local_sidecar_request",
    {
      url,
      method: init?.method ?? "GET",
      contentType: new Headers(init?.headers).get("content-type") ?? undefined,
      body: bytes ? Array.from(bytes) : undefined,
      timeoutMs,
    },
  );
  return new Response(
    [204, 205, 304].includes(response.status) ? null : response.body,
    {
      status: response.status,
    },
  );
};
