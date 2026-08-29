import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import {
  DEFAULT_PILL_THEME,
  PILL_COMPLETION_EFFECTS,
  PILL_THEME_PRESETS,
  PILL_WAVE_STYLES,
  type PillCompletionEffect,
  type PillTheme,
  type PillWaveStyle,
} from "@voquill/types";
import { ChangeEvent, ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { setPillTheme } from "../../actions/user.actions";
import { produceAppState, useAppStore } from "../../store";
import { getMyUserPreferences } from "../../utils/user.utils";
import { SettingSection } from "../common/SettingSection";

const ACCENT_PRESETS = [
  "#FFFFFF",
  "#7C9CFF",
  "#5EEAD4",
  "#A78BFA",
  "#F472B6",
  "#FBBF24",
  "#34D399",
  "#FB7185",
];

const WAVE_STYLE_LABELS: Record<PillWaveStyle, string> = {
  classic: "Classic waves",
  ribbon: "Ribbon",
  bars: "Bars",
  pulse: "Pulse",
  minimal: "Minimal line",
  dots: "Dots",
  spectrum: "Spectrum",
  orb: "Orb",
};

const EFFECT_LABELS: Record<PillCompletionEffect, string> = {
  none: "None",
  sparkle: "Sparkle",
  fireworks: "Fireworks",
};

const themesEqual = (a: PillTheme, b: PillTheme) =>
  JSON.stringify(a) === JSON.stringify(b);

type ColorPickerProps = {
  value: string;
  label: string;
  onChange: (color: string) => void;
};

const ColorPicker = ({ value, label, onChange }: ColorPickerProps) => (
  <Stack direction="row" spacing={1} alignItems="center">
    <Stack direction="row" spacing={0.5}>
      {ACCENT_PRESETS.map((color) => (
        <Box
          key={color}
          role="button"
          aria-label={`${label} ${color}`}
          onClick={() => onChange(color)}
          sx={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            bgcolor: color,
            cursor: "pointer",
            border: 2,
            borderColor:
              value.toUpperCase() === color ? "primary.main" : "divider",
          }}
        />
      ))}
    </Stack>
    <TextField
      type="color"
      size="small"
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) =>
        onChange(event.target.value.toUpperCase())
      }
      inputProps={{ "aria-label": label }}
      sx={{ width: 52 }}
    />
  </Stack>
);

type RangeProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
};

const Range = ({ value, min, max, step, format, onChange }: RangeProps) => (
  <Slider
    size="small"
    min={min}
    max={max}
    step={step}
    value={value}
    valueLabelDisplay="auto"
    valueLabelFormat={format}
    onChangeCommitted={(_, next) =>
      onChange(Array.isArray(next) ? (next[0] ?? value) : next)
    }
    sx={{ width: 160 }}
  />
);

const percent = (value: number) => `${Math.round(value * 100)}%`;
const times = (value: number) => `${value.toFixed(1)}×`;

export const AppearanceDialog = () => {
  const intl = useIntl();
  const [open, theme] = useAppStore((state) => {
    const prefs = getMyUserPreferences(state);
    return [
      state.settings.appearanceDialogOpen,
      prefs?.pillTheme ?? DEFAULT_PILL_THEME,
    ] as const;
  });

  const update = (patch: Partial<PillTheme>) => {
    void setPillTheme({ ...theme, ...patch });
  };

  const handleClose = () => {
    produceAppState((draft) => {
      draft.settings.appearanceDialogOpen = false;
    });
  };

  const section = (
    title: ReactNode,
    description: ReactNode,
    action: ReactNode,
  ) => (
    <SettingSection title={title} description={description} action={action} />
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <FormattedMessage defaultMessage="Pill appearance" />
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            <FormattedMessage defaultMessage="The pill previews your changes live while this window is open." />
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {PILL_THEME_PRESETS.map((preset) => (
              <Chip
                key={preset.name}
                label={preset.name}
                color={themesEqual(preset.theme, theme) ? "primary" : "default"}
                variant={
                  themesEqual(preset.theme, theme) ? "filled" : "outlined"
                }
                onClick={() => void setPillTheme(preset.theme)}
              />
            ))}
          </Stack>

          {section(
            <FormattedMessage defaultMessage="Wave style" />,
            <FormattedMessage defaultMessage="How the pill animates while you speak." />,
            <Select<PillWaveStyle>
              size="small"
              value={theme.waveStyle}
              onChange={(event: SelectChangeEvent<PillWaveStyle>) =>
                update({ waveStyle: event.target.value as PillWaveStyle })
              }
              sx={{ minWidth: 160 }}
            >
              {PILL_WAVE_STYLES.map((style) => (
                <MenuItem key={style} value={style}>
                  {WAVE_STYLE_LABELS[style]}
                </MenuItem>
              ))}
            </Select>,
          )}

          {section(
            <FormattedMessage defaultMessage="Accent color" />,
            <FormattedMessage defaultMessage="Waves, border, and effects." />,
            <ColorPicker
              value={theme.accentColor}
              label={intl.formatMessage({ defaultMessage: "Accent color" })}
              onChange={(accentColor) => update({ accentColor })}
            />,
          )}

          {section(
            <FormattedMessage defaultMessage="Gradient" />,
            <FormattedMessage defaultMessage="Blend the accent into a second color across the pill." />,
            <Stack direction="row" spacing={1} alignItems="center">
              <Switch
                edge="end"
                checked={theme.accentColor2 !== null}
                onChange={(event) =>
                  update({
                    accentColor2: event.target.checked ? "#5EEAD4" : null,
                  })
                }
              />
              {theme.accentColor2 !== null && (
                <ColorPicker
                  value={theme.accentColor2}
                  label={intl.formatMessage({
                    defaultMessage: "Second accent color",
                  })}
                  onChange={(accentColor2) => update({ accentColor2 })}
                />
              )}
            </Stack>,
          )}

          {section(
            <FormattedMessage defaultMessage="Background" />,
            <FormattedMessage defaultMessage="Pill fill color and how see-through it is." />,
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                type="color"
                size="small"
                value={theme.backgroundColor}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  update({ backgroundColor: event.target.value.toUpperCase() })
                }
                inputProps={{
                  "aria-label": intl.formatMessage({
                    defaultMessage: "Background color",
                  }),
                }}
                sx={{ width: 52 }}
              />
              <Range
                value={theme.backgroundAlpha}
                min={0.2}
                max={1}
                step={0.05}
                format={percent}
                onChange={(backgroundAlpha) => update({ backgroundAlpha })}
              />
            </Stack>,
          )}

          {section(
            <FormattedMessage defaultMessage="Border" />,
            <FormattedMessage defaultMessage="Outline thickness. Zero removes it." />,
            <Range
              value={theme.borderWidth}
              min={0}
              max={4}
              step={0.5}
              format={(value) => `${value}px`}
              onChange={(borderWidth) => update({ borderWidth })}
            />,
          )}

          {section(
            <FormattedMessage defaultMessage="Corners" />,
            <FormattedMessage defaultMessage="From a rounded box to a full pill." />,
            <Range
              value={theme.roundness}
              min={0}
              max={1}
              step={0.05}
              format={percent}
              onChange={(roundness) => update({ roundness })}
            />,
          )}

          {section(
            <FormattedMessage defaultMessage="Glow" />,
            <FormattedMessage defaultMessage="Soft accent-colored halo while active." />,
            <Switch
              edge="end"
              checked={theme.glow}
              onChange={(event) => update({ glow: event.target.checked })}
            />,
          )}

          {section(
            <FormattedMessage defaultMessage="Size" />,
            <FormattedMessage defaultMessage="How large the pill grows while active." />,
            <Range
              value={theme.scale}
              min={0.75}
              max={1.5}
              step={0.05}
              format={percent}
              onChange={(scale) => update({ scale })}
            />,
          )}

          {section(
            <FormattedMessage defaultMessage="Speed" />,
            <FormattedMessage defaultMessage="How fast the animation moves." />,
            <Range
              value={theme.speed}
              min={0.4}
              max={2.5}
              step={0.1}
              format={times}
              onChange={(speed) => update({ speed })}
            />,
          )}

          {section(
            <FormattedMessage defaultMessage="Intensity" />,
            <FormattedMessage defaultMessage="How strongly the pill reacts to your voice." />,
            <Range
              value={theme.intensity}
              min={0.4}
              max={2.5}
              step={0.1}
              format={times}
              onChange={(intensity) => update({ intensity })}
            />,
          )}

          {section(
            <FormattedMessage defaultMessage="Completion effect" />,
            <FormattedMessage defaultMessage="A little celebration when your dictation is pasted." />,
            <Select<PillCompletionEffect>
              size="small"
              value={theme.effect}
              onChange={(event: SelectChangeEvent<PillCompletionEffect>) =>
                update({ effect: event.target.value as PillCompletionEffect })
              }
              sx={{ minWidth: 160 }}
            >
              {PILL_COMPLETION_EFFECTS.map((effect) => (
                <MenuItem key={effect} value={effect}>
                  {EFFECT_LABELS[effect]}
                </MenuItem>
              ))}
            </Select>,
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => void setPillTheme(DEFAULT_PILL_THEME)}>
          <FormattedMessage defaultMessage="Reset" />
        </Button>
        <Button onClick={handleClose} variant="contained">
          <FormattedMessage defaultMessage="Done" />
        </Button>
      </DialogActions>
    </Dialog>
  );
};
