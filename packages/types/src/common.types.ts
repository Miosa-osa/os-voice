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
  "dots",
  "spectrum",
  "orb",
] as const;
export type PillWaveStyle = (typeof PILL_WAVE_STYLES)[number];

export const PILL_COMPLETION_EFFECTS = ["none", "sparkle", "fireworks"] as const;
export type PillCompletionEffect = (typeof PILL_COMPLETION_EFFECTS)[number];

export type PillTheme = {
  waveStyle: PillWaveStyle;
  accentColor: string;
  accentColor2: string | null;
  backgroundColor: string;
  backgroundAlpha: number;
  borderWidth: number;
  roundness: number;
  speed: number;
  intensity: number;
  glow: boolean;
  scale: number;
  effect: PillCompletionEffect;
};

export const DEFAULT_PILL_THEME: PillTheme = {
  waveStyle: "classic",
  accentColor: "#FFFFFF",
  accentColor2: null,
  backgroundColor: "#000000",
  backgroundAlpha: 1,
  borderWidth: 1,
  roundness: 1,
  speed: 1,
  intensity: 1,
  glow: false,
  scale: 1,
  effect: "none",
};

export type PillThemePreset = { name: string; theme: PillTheme };

export const PILL_THEME_PRESETS: PillThemePreset[] = [
  { name: "Mono", theme: DEFAULT_PILL_THEME },
  {
    name: "Midnight",
    theme: {
      ...DEFAULT_PILL_THEME,
      waveStyle: "ribbon",
      accentColor: "#7C9CFF",
      accentColor2: "#5EEAD4",
      backgroundColor: "#0B1020",
      glow: true,
    },
  },
  {
    name: "Neon",
    theme: {
      ...DEFAULT_PILL_THEME,
      waveStyle: "bars",
      accentColor: "#FF2D95",
      accentColor2: "#00F0FF",
      backgroundColor: "#050505",
      glow: true,
      speed: 1.3,
      intensity: 1.3,
      effect: "sparkle",
    },
  },
  {
    name: "Ocean",
    theme: {
      ...DEFAULT_PILL_THEME,
      waveStyle: "pulse",
      accentColor: "#5EEAD4",
      accentColor2: "#3B82F6",
      backgroundColor: "#06212B",
      backgroundAlpha: 0.9,
      roundness: 1,
    },
  },
  {
    name: "Sunset",
    theme: {
      ...DEFAULT_PILL_THEME,
      waveStyle: "orb",
      accentColor: "#FBBF24",
      accentColor2: "#FB7185",
      backgroundColor: "#2A0F1E",
      glow: true,
      borderWidth: 0,
    },
  },
  {
    name: "Forest",
    theme: {
      ...DEFAULT_PILL_THEME,
      waveStyle: "spectrum",
      accentColor: "#34D399",
      accentColor2: "#A3E635",
      backgroundColor: "#0B1F14",
      roundness: 0.4,
      borderWidth: 1.5,
    },
  },
];

export type PullStatus = "in_progress" | "error" | "complete";

export const STYLING_MODES = ["app", "manual"] as const;
export type StylingMode = (typeof STYLING_MODES)[number];
export const StylingModeZod = z.enum(STYLING_MODES);
