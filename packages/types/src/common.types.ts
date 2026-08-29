import z from "zod";

export type Nullable<T> = T | null;

export type EmptyObject = Record<string, never>;

export type Replace<T, S, D> = {
  [K in keyof T]: T[K] extends S
    ? D
    : T[K] extends S | null
      ? D | null
      : T[K] extends S | undefined
        ? D | undefined
        : T[K] extends S | null | undefined
          ? D | null | undefined
          : T[K];
};

export type JsonResponse = {
  name: string;
  description?: string;
  schema: Record<string, unknown>;
};

export type TranscriptionMode = "local" | "api" | "cloud";

export type PostProcessingMode = "none" | "api" | "cloud";

export type AgentMode = PostProcessingMode | "openclaw";

export type DictationPillVisibility = "hidden" | "while_active" | "persistent";

export const PILL_WAVE_STYLES = [
  "classic",
  "ribbon",
  "bars",
  "pulse",
  "minimal",
] as const;
export type PillWaveStyle = (typeof PILL_WAVE_STYLES)[number];

export const PILL_COMPLETION_EFFECTS = ["none", "sparkle", "fireworks"] as const;
export type PillCompletionEffect = (typeof PILL_COMPLETION_EFFECTS)[number];

export type PillTheme = {
  waveStyle: PillWaveStyle;
  accentColor: string;
  glow: boolean;
  scale: number;
  effect: PillCompletionEffect;
};

export const DEFAULT_PILL_THEME: PillTheme = {
  waveStyle: "classic",
  accentColor: "#FFFFFF",
  glow: false,
  scale: 1,
  effect: "none",
};

export type PullStatus = "in_progress" | "error" | "complete";

export const STYLING_MODES = ["app", "manual"] as const;
export type StylingMode = (typeof STYLING_MODES)[number];
export const StylingModeZod = z.enum(STYLING_MODES);
