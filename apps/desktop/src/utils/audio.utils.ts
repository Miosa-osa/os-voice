import { invoke } from "@tauri-apps/api/core";
import { getAppState } from "../store";
import { AudioSamples } from "../types/audio.types";
import { isLinux, isMacOS, isWindows11 } from "./env.utils";
import { getMyUser } from "./user.utils";

const writeString = (view: DataView, offset: number, text: string) => {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
};

const floatTo16BitPCM = (
  view: DataView,
  offset: number,
  input: Float32Array,
) => {
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0));
    const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset + index * 2, value, true);
  }
};

export const ensureFloat32Array = (samples: AudioSamples): Float32Array =>
  samples ?? new Float32Array(0);

export type AudioPayload = {
  samples: Float32Array;
  sampleRate: number;
};

// Audio crosses the Tauri IPC boundary as raw bytes: a little-endian u32
// sample rate followed by little-endian f32 samples (see commands.rs).
export const decodeAudioPayload = (buffer: ArrayBuffer): AudioPayload => {
  if (buffer.byteLength < 4) {
    return { samples: new Float32Array(0), sampleRate: 0 };
  }
  const sampleRate = new DataView(buffer).getUint32(0, true);
  return { samples: new Float32Array(buffer, 4), sampleRate };
};

export const encodeAudioSamples = (samples: Float32Array): Uint8Array =>
  new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);

export const stopRecording = async (): Promise<AudioPayload> =>
  decodeAudioPayload(await invoke<ArrayBuffer>("stop_recording"));

export const buildWaveFile = (
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer => {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  floatTo16BitPCM(view, 44, samples);
  return buffer;
};

export type AudioClip =
  | "start_recording_clip"
  | "stop_recording_clip"
  | "alert_linux_clip"
  | "alert_macos_clip"
  | "alert_windows_10_clip"
  | "alert_windows_11_clip";

export function tryPlayAudioChime(clip: AudioClip): void {
  const state = getAppState();
  const user = getMyUser(state);
  const playInteractionChime = user?.playInteractionChime ?? true;

  if (!playInteractionChime) {
    return;
  }

  invoke<void>("play_audio", { clip }).catch(console.error);
}

function getAlertClip(): AudioClip {
  if (isMacOS()) {
    return "alert_macos_clip";
  }
  if (isLinux()) {
    return "alert_linux_clip";
  }
  if (isWindows11()) {
    return "alert_windows_11_clip";
  }
  return "alert_windows_10_clip";
}

export function playAlertSound(): void {
  const clip = getAlertClip();
  tryPlayAudioChime(clip);
}
