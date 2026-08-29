import {
  AgentMode,
  DEFAULT_PILL_THEME,
  PILL_LOADING_STYLES,
  PILL_POSITIONS,
  DictationPillVisibility,
  Nullable,
  PILL_COMPLETION_EFFECTS,
  PILL_WAVE_STYLES,
  PillCompletionEffect,
  PillLoadingStyle,
  PillPosition,
  PillTheme,
  PillWaveStyle,
  PostProcessingMode,
  TranscriptionMode,
  UserPreferences,
} from "@voquill/types";
import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_DICTATION_LIMIT_MINUTES,
  normalizeDictationLimitMinutes,
} from "../utils/dictation-limit.utils";
import { getEffectivePillVisibility, LOCAL_USER_ID } from "../utils/user.utils";
import { BaseRepo } from "./base.repo";

type LocalUserPreferences = {
  userId: string;
  transcriptionMode: Nullable<TranscriptionMode>;
  transcriptionApiKeyId: Nullable<string>;
  transcriptionDevice: Nullable<string>;
  transcriptionModelSize: Nullable<string>;
  postProcessingMode: Nullable<string>;
  postProcessingApiKeyId: Nullable<string>;
  postProcessingOllamaUrl: Nullable<string>;
  postProcessingOllamaModel: Nullable<string>;
  activeToneId: Nullable<string>;
  gotStartedAt: Nullable<number>;
  gpuEnumerationEnabled: boolean;
  agentMode: Nullable<AgentMode>;
  agentModeApiKeyId: Nullable<string>;
  openclawGatewayUrl: Nullable<string>;
  openclawToken: Nullable<string>;
  lastSeenFeature: Nullable<string>;
  isEnterprise: boolean;
  languageSwitchEnabled: boolean;
  secondaryDictationLanguage: Nullable<string>;
  activeDictationLanguage: Nullable<string>;
  preferredMicrophone: Nullable<string>;
  ignoreUpdateDialog: boolean;
  incognitoModeEnabled: boolean;
  incognitoModeIncludeInStats: boolean;
  dictationLimitMinutes?: Nullable<number>;
  dictationPillVisibility: DictationPillVisibility;
  realtimeOutputEnabled: boolean;
  remoteOutputEnabled: boolean;
  remoteTargetDeviceId: Nullable<string>;
  remoteReceiverPort: Nullable<number>;
  remoteReceiverAutoStart: boolean;
  dictationAudioDim: number;
  pasteKeybind: Nullable<string>;
  useNewBackend: boolean;
  menuBarIconHidden: boolean;
  insertionMethod: Nullable<string>;
  typingSpeedMs: Nullable<number>;
  pillTheme: Nullable<string>;
};

// Normalize post-processing mode for backwards compatibility
// "ollama" mode is no longer supported - treat it as "none" (user needs to re-add Ollama via API keys)
const normalizePostProcessingMode = (
  mode: Nullable<string>,
): Nullable<PostProcessingMode> => {
  if (!mode) return null;
  if (mode === "api" || mode === "cloud" || mode === "none") {
    return mode;
  }
  // "ollama" or any other unknown mode falls back to "none"
  return "none";
};

const parsePillTheme = (raw: Nullable<string>): PillTheme => {
  if (!raw) {
    return DEFAULT_PILL_THEME;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PillTheme>;
    const hex = (value: unknown, fallback: string): string =>
      typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
        ? value
        : fallback;
    const num = (
      value: unknown,
      min: number,
      max: number,
      fallback: number,
    ): number =>
      typeof value === "number" && Number.isFinite(value)
        ? Math.min(max, Math.max(min, value))
        : fallback;
    return {
      waveStyle: PILL_WAVE_STYLES.includes(parsed.waveStyle as PillWaveStyle)
        ? (parsed.waveStyle as PillWaveStyle)
        : DEFAULT_PILL_THEME.waveStyle,
      accentColor: hex(parsed.accentColor, DEFAULT_PILL_THEME.accentColor),
      accentColor2:
        typeof parsed.accentColor2 === "string"
          ? hex(parsed.accentColor2, DEFAULT_PILL_THEME.accentColor)
          : null,
      backgroundColor: hex(
        parsed.backgroundColor,
        DEFAULT_PILL_THEME.backgroundColor,
      ),
      backgroundAlpha: num(parsed.backgroundAlpha, 0.2, 1, 1),
      borderWidth: num(parsed.borderWidth, 0, 4, 1),
      roundness: num(parsed.roundness, 0, 1, 1),
      speed: num(parsed.speed, 0.4, 2.5, 1),
      intensity: num(parsed.intensity, 0.4, 2.5, 1),
      glow: parsed.glow === true,
      scale: num(parsed.scale, 0.75, 1.5, 1),
      position: PILL_POSITIONS.includes(parsed.position as PillPosition)
        ? (parsed.position as PillPosition)
        : "center",
      bottomOffset: num(parsed.bottomOffset, 0, 300, 0),
      idleOpacity: num(parsed.idleOpacity, 0.1, 1, 1),
      idleWidth: num(parsed.idleWidth, 0.5, 2.5, 1),
      idleLabel:
        typeof parsed.idleLabel === "string"
          ? parsed.idleLabel.slice(0, 40)
          : "",
      showTimer: parsed.showTimer === true,
      reactiveGlow: parsed.reactiveGlow === true,
      loadingStyle: PILL_LOADING_STYLES.includes(
        parsed.loadingStyle as PillLoadingStyle,
      )
        ? (parsed.loadingStyle as PillLoadingStyle)
        : "bar",
      shadow: parsed.shadow === true,
      rainbow: parsed.rainbow === true,
      borderColor:
        typeof parsed.borderColor === "string"
          ? hex(parsed.borderColor, DEFAULT_PILL_THEME.accentColor)
          : null,
      effect: PILL_COMPLETION_EFFECTS.includes(
        parsed.effect as PillCompletionEffect,
      )
        ? (parsed.effect as PillCompletionEffect)
        : DEFAULT_PILL_THEME.effect,
    };
  } catch {
    return DEFAULT_PILL_THEME;
  }
};

const fromLocalPreferences = (
  preferences: LocalUserPreferences,
): UserPreferences => ({
  userId: preferences.userId,
  transcriptionMode: preferences.transcriptionMode,
  transcriptionApiKeyId: preferences.transcriptionApiKeyId,
  transcriptionDevice: preferences.transcriptionDevice,
  transcriptionModelSize: preferences.transcriptionModelSize,
  postProcessingMode: normalizePostProcessingMode(
    preferences.postProcessingMode,
  ),
  postProcessingApiKeyId: preferences.postProcessingApiKeyId,
  postProcessingOllamaUrl: preferences.postProcessingOllamaUrl,
  postProcessingOllamaModel: preferences.postProcessingOllamaModel,
  activeToneId: preferences.activeToneId,
  gotStartedAt: preferences.gotStartedAt,
  gpuEnumerationEnabled: preferences.gpuEnumerationEnabled,
  agentMode: preferences.agentMode,
  agentModeApiKeyId: preferences.agentModeApiKeyId,
  openclawGatewayUrl: preferences.openclawGatewayUrl ?? null,
  openclawToken: preferences.openclawToken ?? null,
  lastSeenFeature: preferences.lastSeenFeature,
  isEnterprise: preferences.isEnterprise,
  preferredMicrophone: preferences.preferredMicrophone ?? null,
  ignoreUpdateDialog: preferences.ignoreUpdateDialog ?? false,
  incognitoModeEnabled: preferences.incognitoModeEnabled ?? false,
  incognitoModeIncludeInStats: preferences.incognitoModeIncludeInStats ?? false,
  dictationLimitMinutes: normalizeDictationLimitMinutes(
    preferences.dictationLimitMinutes,
  ),
  dictationPillVisibility: getEffectivePillVisibility(
    preferences.dictationPillVisibility,
  ),
  realtimeOutputEnabled: preferences.realtimeOutputEnabled ?? false,
  remoteOutputEnabled: preferences.remoteOutputEnabled ?? false,
  remoteTargetDeviceId: preferences.remoteTargetDeviceId ?? null,
  remoteReceiverPort: preferences.remoteReceiverPort ?? null,
  remoteReceiverAutoStart: preferences.remoteReceiverAutoStart ?? false,
  dictationAudioDim: preferences.dictationAudioDim ?? 1.0,
  pasteKeybind: preferences.pasteKeybind ?? null,
  menuBarIconHidden: preferences.menuBarIconHidden ?? false,
  insertionMethod: preferences.insertionMethod ?? null,
  typingSpeedMs: preferences.typingSpeedMs ?? null,
  pillTheme: parsePillTheme(preferences.pillTheme),
});

const toLocalPreferences = (
  preferences: UserPreferences,
): LocalUserPreferences => ({
  userId: LOCAL_USER_ID,
  transcriptionMode: preferences.transcriptionMode ?? null,
  transcriptionApiKeyId: preferences.transcriptionApiKeyId ?? null,
  transcriptionDevice: preferences.transcriptionDevice ?? null,
  transcriptionModelSize: preferences.transcriptionModelSize ?? null,
  postProcessingMode: preferences.postProcessingMode ?? null,
  postProcessingApiKeyId: preferences.postProcessingApiKeyId ?? null,
  postProcessingOllamaUrl: preferences.postProcessingOllamaUrl ?? null,
  postProcessingOllamaModel: preferences.postProcessingOllamaModel ?? null,
  activeToneId: preferences.activeToneId ?? null,
  gotStartedAt: preferences.gotStartedAt ?? null,
  gpuEnumerationEnabled: preferences.gpuEnumerationEnabled,
  agentMode: preferences.agentMode ?? null,
  agentModeApiKeyId: preferences.agentModeApiKeyId ?? null,
  openclawGatewayUrl: preferences.openclawGatewayUrl ?? null,
  openclawToken: preferences.openclawToken ?? null,
  lastSeenFeature: preferences.lastSeenFeature ?? null,
  isEnterprise: preferences.isEnterprise,
  languageSwitchEnabled: false,
  secondaryDictationLanguage: null,
  activeDictationLanguage: "primary",
  preferredMicrophone: preferences.preferredMicrophone ?? null,
  ignoreUpdateDialog: preferences.ignoreUpdateDialog ?? false,
  incognitoModeEnabled: preferences.incognitoModeEnabled ?? false,
  incognitoModeIncludeInStats: preferences.incognitoModeIncludeInStats ?? false,
  dictationLimitMinutes: normalizeDictationLimitMinutes(
    preferences.dictationLimitMinutes ?? DEFAULT_DICTATION_LIMIT_MINUTES,
  ),
  dictationPillVisibility: getEffectivePillVisibility(
    preferences.dictationPillVisibility,
  ),
  realtimeOutputEnabled: preferences.realtimeOutputEnabled ?? false,
  remoteOutputEnabled: preferences.remoteOutputEnabled ?? false,
  remoteTargetDeviceId: preferences.remoteTargetDeviceId ?? null,
  remoteReceiverPort: preferences.remoteReceiverPort ?? null,
  remoteReceiverAutoStart: preferences.remoteReceiverAutoStart ?? false,
  dictationAudioDim: preferences.dictationAudioDim ?? 1.0,
  pasteKeybind: preferences.pasteKeybind ?? null,
  useNewBackend: true,
  menuBarIconHidden: preferences.menuBarIconHidden ?? false,
  insertionMethod: preferences.insertionMethod ?? null,
  typingSpeedMs: preferences.typingSpeedMs ?? null,
  pillTheme: JSON.stringify(preferences.pillTheme),
});

export abstract class BaseUserPreferencesRepo extends BaseRepo {
  abstract setUserPreferences(
    preferences: UserPreferences,
  ): Promise<UserPreferences>;
  abstract getUserPreferences(): Promise<Nullable<UserPreferences>>;
}

export class LocalUserPreferencesRepo extends BaseUserPreferencesRepo {
  async setUserPreferences(
    preferences: UserPreferences,
  ): Promise<UserPreferences> {
    const saved = await invoke<LocalUserPreferences>("user_preferences_set", {
      preferences: toLocalPreferences(preferences),
    });

    return fromLocalPreferences(saved);
  }

  async getUserPreferences(): Promise<Nullable<UserPreferences>> {
    const result = await invoke<Nullable<LocalUserPreferences>>(
      "user_preferences_get",
      {
        args: { userId: LOCAL_USER_ID },
      },
    );

    return result ? fromLocalPreferences(result) : null;
  }
}
