import {
  Box,
  Button,
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
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import {
  DEFAULT_PILL_THEME,
  PILL_COMPLETION_EFFECTS,
  PILL_WAVE_STYLES,
  type PillCompletionEffect,
  type PillTheme,
  type PillWaveStyle,
} from "@voquill/types";
import { ChangeEvent } from "react";
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
};

const EFFECT_LABELS: Record<PillCompletionEffect, string> = {
  none: "None",
  sparkle: "Sparkle",
  fireworks: "Fireworks",
};

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

  const handleWaveStyleChange = (event: SelectChangeEvent<PillWaveStyle>) => {
    update({ waveStyle: event.target.value as PillWaveStyle });
  };

  const handleEffectChange = (
    event: SelectChangeEvent<PillCompletionEffect>,
  ) => {
    update({ effect: event.target.value as PillCompletionEffect });
  };

  const handleAccentInput = (event: ChangeEvent<HTMLInputElement>) => {
    update({ accentColor: event.target.value.toUpperCase() });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <FormattedMessage defaultMessage="Pill appearance" />
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <SettingSection
            title={<FormattedMessage defaultMessage="Wave style" />}
            description={
              <FormattedMessage defaultMessage="How the pill animates while you speak." />
            }
            action={
              <Select<PillWaveStyle>
                size="small"
                value={theme.waveStyle}
                onChange={handleWaveStyleChange}
                sx={{ minWidth: 160 }}
              >
                {PILL_WAVE_STYLES.map((style) => (
                  <MenuItem key={style} value={style}>
                    {WAVE_STYLE_LABELS[style]}
                  </MenuItem>
                ))}
              </Select>
            }
          />

          <SettingSection
            title={<FormattedMessage defaultMessage="Accent color" />}
            description={
              <FormattedMessage defaultMessage="Color of the waves, border, and effects." />
            }
            action={
              <Stack direction="row" spacing={1} alignItems="center">
                <Stack direction="row" spacing={0.5}>
                  {ACCENT_PRESETS.map((color) => (
                    <Box
                      key={color}
                      role="button"
                      aria-label={intl.formatMessage(
                        { defaultMessage: "Use accent color {color}" },
                        { color },
                      )}
                      onClick={() => update({ accentColor: color })}
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        bgcolor: color,
                        cursor: "pointer",
                        border: 2,
                        borderColor:
                          theme.accentColor.toUpperCase() === color
                            ? "primary.main"
                            : "divider",
                      }}
                    />
                  ))}
                </Stack>
                <TextField
                  type="color"
                  size="small"
                  value={theme.accentColor}
                  onChange={handleAccentInput}
                  inputProps={{
                    "aria-label": intl.formatMessage({
                      defaultMessage: "Custom accent color",
                    }),
                  }}
                  sx={{ width: 56 }}
                />
              </Stack>
            }
          />

          <SettingSection
            title={<FormattedMessage defaultMessage="Glow" />}
            description={
              <FormattedMessage defaultMessage="Soft accent-colored halo around the pill while active." />
            }
            action={
              <Switch
                edge="end"
                checked={theme.glow}
                onChange={(event) => update({ glow: event.target.checked })}
              />
            }
          />

          <SettingSection
            title={<FormattedMessage defaultMessage="Size" />}
            description={
              <FormattedMessage defaultMessage="How large the pill grows while active." />
            }
            action={
              <Slider
                size="small"
                min={0.75}
                max={1.5}
                step={0.05}
                value={theme.scale}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                onChangeCommitted={(_, value) =>
                  update({ scale: Array.isArray(value) ? value[0] : value })
                }
                sx={{ width: 160 }}
              />
            }
          />

          <SettingSection
            title={<FormattedMessage defaultMessage="Completion effect" />}
            description={
              <FormattedMessage defaultMessage="A little celebration when your dictation is pasted." />
            }
            action={
              <Select<PillCompletionEffect>
                size="small"
                value={theme.effect}
                onChange={handleEffectChange}
                sx={{ minWidth: 160 }}
              >
                {PILL_COMPLETION_EFFECTS.map((effect) => (
                  <MenuItem key={effect} value={effect}>
                    {EFFECT_LABELS[effect]}
                  </MenuItem>
                ))}
              </Select>
            }
          />
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
