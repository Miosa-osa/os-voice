import {
  DEFAULT_PILL_THEME,
  PILL_COMPLETION_EFFECTS,
  PILL_IDLE_SHAPES,
  PILL_LOADING_STYLES,
  PILL_POSITIONS,
  PILL_WAVE_STYLES,
  type PillTheme,
} from "@voquill/types";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const oneOf = <T extends string>(
  options: readonly T[],
  value: unknown,
  fallback: T,
): T => (options.includes(value as T) ? (value as T) : fallback);

const hex = (value: unknown, fallback: string): string =>
  typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;

const optionalHex = (value: unknown): string | null =>
  typeof value === "string" && HEX_COLOR.test(value) ? value : null;

const num = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

export const normalizePillTheme = (
  input: Partial<PillTheme> | null | undefined,
): PillTheme => {
  const parsed = input ?? {};
  const d = DEFAULT_PILL_THEME;
  return {
    waveStyle: oneOf(PILL_WAVE_STYLES, parsed.waveStyle, d.waveStyle),
    accentColor: hex(parsed.accentColor, d.accentColor),
    accentColor2: optionalHex(parsed.accentColor2),
    backgroundColor: hex(parsed.backgroundColor, d.backgroundColor),
    backgroundAlpha: num(parsed.backgroundAlpha, 0.2, 1, d.backgroundAlpha),
    borderWidth: num(parsed.borderWidth, 0, 4, d.borderWidth),
    roundness: num(parsed.roundness, 0, 1, d.roundness),
    speed: num(parsed.speed, 0.4, 2.5, d.speed),
    intensity: num(parsed.intensity, 0.4, 2.5, d.intensity),
    glow: parsed.glow === true,
    scale: num(parsed.scale, 0.75, 1.5, d.scale),
    effect: oneOf(PILL_COMPLETION_EFFECTS, parsed.effect, d.effect),
    position: oneOf(PILL_POSITIONS, parsed.position, d.position),
    bottomOffset: num(parsed.bottomOffset, 0, 300, d.bottomOffset),
    idleOpacity: num(parsed.idleOpacity, 0.1, 1, d.idleOpacity),
    idleWidth: num(parsed.idleWidth, 0.5, 2.5, d.idleWidth),
    idleLabel:
      typeof parsed.idleLabel === "string" ? parsed.idleLabel.slice(0, 40) : "",
    showTimer: parsed.showTimer === true,
    reactiveGlow: parsed.reactiveGlow === true,
    loadingStyle: oneOf(
      PILL_LOADING_STYLES,
      parsed.loadingStyle,
      d.loadingStyle,
    ),
    shadow: parsed.shadow === true,
    rainbow: parsed.rainbow === true,
    borderColor: optionalHex(parsed.borderColor),
    recIndicator: parsed.recIndicator === true,
    idleShape: oneOf(PILL_IDLE_SHAPES, parsed.idleShape, d.idleShape),
    strokeWidth: num(parsed.strokeWidth, 0.5, 4, d.strokeWidth),
    waveOpacity: num(parsed.waveOpacity, 0.2, 1, d.waveOpacity),
  };
};

export const parsePillThemeJson = (
  raw: string | null | undefined,
): PillTheme => {
  if (!raw) {
    return DEFAULT_PILL_THEME;
  }
  try {
    return normalizePillTheme(JSON.parse(raw) as Partial<PillTheme>);
  } catch {
    return DEFAULT_PILL_THEME;
  }
};

const SHARE_PREFIX = "osvoice-pill:";

export const encodePillTheme = (theme: PillTheme): string =>
  SHARE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(theme))));

export const decodePillTheme = (code: string): PillTheme | null => {
  const trimmed = code.trim();
  if (!trimmed.startsWith(SHARE_PREFIX)) {
    return null;
  }
  try {
    const json = decodeURIComponent(
      escape(atob(trimmed.slice(SHARE_PREFIX.length))),
    );
    return normalizePillTheme(JSON.parse(json) as Partial<PillTheme>);
  } catch {
    return null;
  }
};

const pick = <T>(options: readonly T[]): T =>
  options[Math.floor(Math.random() * options.length)] as T;

const randomHex = (): string =>
  `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")
    .toUpperCase()}`;

const randomBetween = (min: number, max: number, step: number): number =>
  Math.round((min + Math.random() * (max - min)) / step) * step;

export const randomPillTheme = (): PillTheme =>
  normalizePillTheme({
    ...DEFAULT_PILL_THEME,
    waveStyle: pick(PILL_WAVE_STYLES),
    accentColor: randomHex(),
    accentColor2: Math.random() < 0.6 ? randomHex() : null,
    backgroundColor: Math.random() < 0.5 ? "#000000" : randomHex(),
    backgroundAlpha: randomBetween(0.6, 1, 0.05),
    borderWidth: randomBetween(0, 2, 0.5),
    roundness: randomBetween(0.3, 1, 0.05),
    speed: randomBetween(0.7, 1.6, 0.1),
    intensity: randomBetween(0.8, 1.6, 0.1),
    glow: Math.random() < 0.6,
    reactiveGlow: Math.random() < 0.5,
    shadow: Math.random() < 0.4,
    rainbow: Math.random() < 0.15,
    scale: randomBetween(0.9, 1.3, 0.05),
    effect: pick(PILL_COMPLETION_EFFECTS),
    loadingStyle: pick(PILL_LOADING_STYLES),
    strokeWidth: randomBetween(1, 3, 0.5),
    waveOpacity: randomBetween(0.7, 1, 0.05),
  });
