import { expect, it } from "vitest";
import { DEFAULT_PILL_THEME, PILL_THEME_PRESETS } from "@voquill/types";
import {
  decodePillTheme,
  encodePillTheme,
  normalizePillTheme,
} from "./pill-theme.utils";
it("round trips every preset and Unicode labels through share codes", () => {
  for (const preset of PILL_THEME_PRESETS) {
    const theme = { ...preset.theme, idleLabel: "Habla 日本語 🎙️" };
    expect(decodePillTheme(encodePillTheme(theme))).toEqual(
      normalizePillTheme(theme),
    );
  }
});
it("normalizes invalid appearance values without losing valid choices", () => {
  expect(
    normalizePillTheme({
      ...DEFAULT_PILL_THEME,
      scale: 99,
      speed: NaN,
      accentColor: "你你",
      borderColor: null,
    }),
  ).toMatchObject({
    scale: 1.5,
    speed: DEFAULT_PILL_THEME.speed,
    accentColor: DEFAULT_PILL_THEME.accentColor,
    borderColor: null,
  });
});
