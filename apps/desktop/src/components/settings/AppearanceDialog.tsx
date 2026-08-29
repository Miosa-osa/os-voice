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
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import {
  DEFAULT_PILL_THEME,
  PILL_COMPLETION_EFFECTS,
  PILL_IDLE_SHAPES,
  PILL_LOADING_STYLES,
  PILL_POSITIONS,
  PILL_THEME_PRESETS,
  PILL_WAVE_STYLES,
  type PillCompletionEffect,
  type PillIdleShape,
  type PillLoadingStyle,
  type PillPosition,
  type PillTheme,
  type PillWaveStyle,
} from "@voquill/types";
import { ChangeEvent, ReactNode, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { showErrorSnackbar } from "../../actions/app.actions";
import { setPillTheme } from "../../actions/user.actions";
import { produceAppState, useAppStore } from "../../store";
import {
  decodePillTheme,
  encodePillTheme,
  randomPillTheme,
} from "../../utils/pill-theme.utils";
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
  heartbeat: "Heartbeat",
  particles: "Particles",
  liquid: "Liquid",
};

const LOADING_LABELS: Record<PillLoadingStyle, string> = {
  bar: "Progress bar",
  spinner: "Spinner",
  dots: "Pulsing dots",
};

const POSITION_LABELS: Record<PillPosition, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
};

const IDLE_SHAPE_LABELS: Record<PillIdleShape, string> = {
  bar: "Bar",
  dot: "Dot",
};

const EFFECT_LABELS: Record<PillCompletionEffect, string> = {
  none: "None",
  sparkle: "Sparkle",
  fireworks: "Fireworks",
};

const TABS = [
  "presets",
  "style",
  "colors",
  "shape",
  "position",
  "effects",
] as const;
type TabKey = (typeof TABS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  presets: "Presets",
  style: "Style",
  colors: "Colors",
  shape: "Shape",
  position: "Position",
  effects: "Effects & share",
};

const themesEqual = (a: PillTheme, b: PillTheme) =>
  JSON.stringify(a) === JSON.stringify(b);

const percent = (value: number) => `${Math.round(value * 100)}%`;
const times = (value: number) => `${value.toFixed(1)}×`;
const px = (value: number) => `${value}px`;

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

type OptionalColorProps = {
  value: string | null;
  label: string;
  defaultColor: string;
  onChange: (color: string | null) => void;
};

const OptionalColor = ({
  value,
  label,
  defaultColor,
  onChange,
}: OptionalColorProps) => (
  <Stack direction="row" spacing={1} alignItems="center">
    <Switch
      edge="end"
      checked={value !== null}
      onChange={(event) => onChange(event.target.checked ? defaultColor : null)}
      inputProps={{ "aria-label": label }}
    />
    {value !== null && (
      <ColorPicker value={value} label={label} onChange={onChange} />
    )}
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

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const Toggle = ({ checked, onChange }: ToggleProps) => (
  <Switch
    edge="end"
    checked={checked}
    onChange={(event) => onChange(event.target.checked)}
  />
);

type ChoiceProps<T extends string> = {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
};

const Choice = <T extends string>({
  value,
  options,
  labels,
  onChange,
}: ChoiceProps<T>) => (
  <Select<T>
    size="small"
    value={value}
    onChange={(event: SelectChangeEvent<T>) =>
      onChange(event.target.value as T)
    }
    sx={{ minWidth: 160 }}
  >
    {options.map((option) => (
      <MenuItem key={option} value={option}>
        {labels[option]}
      </MenuItem>
    ))}
  </Select>
);

export const AppearanceDialog = () => {
  const intl = useIntl();
  const [tab, setTab] = useState<TabKey>("presets");
  const [shareInput, setShareInput] = useState("");
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

  const shareCode = encodePillTheme(theme);

  const handleCopyShareCode = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
    } catch {
      showErrorSnackbar("Couldn't copy. Select the code and copy it manually.");
    }
  };

  const handleApplyShareCode = () => {
    const decoded = decodePillTheme(shareInput);
    if (!decoded) {
      showErrorSnackbar("That doesn't look like a pill theme code.");
      return;
    }
    void setPillTheme(decoded);
    setShareInput("");
  };

  const presets = (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        <FormattedMessage defaultMessage="Pick a starting point, then fine-tune it in the other tabs." />
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {PILL_THEME_PRESETS.map((preset) => (
          <Chip
            key={preset.name}
            label={preset.name}
            color={themesEqual(preset.theme, theme) ? "primary" : "default"}
            variant={themesEqual(preset.theme, theme) ? "filled" : "outlined"}
            onClick={() => void setPillTheme(preset.theme)}
          />
        ))}
        <Chip
          label={intl.formatMessage({ defaultMessage: "Surprise me" })}
          variant="outlined"
          onClick={() => void setPillTheme(randomPillTheme())}
        />
      </Stack>
    </Stack>
  );

  const style = (
    <Stack spacing={1}>
      {section(
        <FormattedMessage defaultMessage="Wave style" />,
        <FormattedMessage defaultMessage="How the pill animates while you speak." />,
        <Choice
          value={theme.waveStyle}
          options={PILL_WAVE_STYLES}
          labels={WAVE_STYLE_LABELS}
          onChange={(waveStyle) => update({ waveStyle })}
        />,
      )}
      {section(
        <FormattedMessage defaultMessage="Line thickness" />,
        <FormattedMessage defaultMessage="Stroke width for line-based styles." />,
        <Range
          value={theme.strokeWidth}
          min={0.5}
          max={4}
          step={0.5}
          format={px}
          onChange={(strokeWidth) => update({ strokeWidth })}
        />,
      )}
      {section(
        <FormattedMessage defaultMessage="Wave opacity" />,
        <FormattedMessage defaultMessage="How solid the waves are drawn." />,
        <Range
          value={theme.waveOpacity}
          min={0.2}
          max={1}
          step={0.05}
          format={percent}
          onChange={(waveOpacity) => update({ waveOpacity })}
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
        <FormattedMessage defaultMessage="Recording indicator" />,
        <FormattedMessage defaultMessage="Blinking REC dot while recording." />,
        <Toggle
          checked={theme.recIndicator}
          onChange={(recIndicator) => update({ recIndicator })}
        />,
      )}
      {section(
        <FormattedMessage defaultMessage="Recording timer" />,
        <FormattedMessage defaultMessage="Elapsed time above the pill while recording." />,
        <Toggle
          checked={theme.showTimer}
          onChange={(showTimer) => update({ showTimer })}
        />,
      )}
      {section(
        <FormattedMessage defaultMessage="Processing style" />,
        <FormattedMessage defaultMessage="Shown while your dictation is being transcribed." />,
        <Choice
          value={theme.loadingStyle}
          options={PILL_LOADING_STYLES}
          labels={LOADING_LABELS}
          onChange={(loadingStyle) => update({ loadingStyle })}
        />,
      )}
    </Stack>
  );

  const colors = (
    <Stack spacing={1}>
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
        <OptionalColor
          value={theme.accentColor2}
          defaultColor="#5EEAD4"
          label={intl.formatMessage({ defaultMessage: "Second accent color" })}
          onChange={(accentColor2) => update({ accentColor2 })}
        />,
      )}
      {section(
        <FormattedMessage defaultMessage="Rainbow" />,
        <FormattedMessage defaultMessage="Cycle the accent through every hue over time." />,
        <Toggle
          checked={theme.rainbow}
          onChange={(rainbow) => update({ rainbow })}
        />,
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
        <FormattedMessage defaultMessage="Border color" />,
        <FormattedMessage defaultMessage="Use a color other than the accent for the outline." />,
        <OptionalColor
          value={theme.borderColor}
          defaultColor="#FFFFFF"
          label={intl.formatMessage({ defaultMessage: "Border color" })}
          onChange={(borderColor) => update({ borderColor })}
        />,
      )}
    </Stack>
  );

  const shape = (
    <Stack spacing={1}>
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
        <FormattedMessage defaultMessage="Border thickness" />,
        <FormattedMessage defaultMessage="Zero removes the outline." />,
        <Range
          value={theme.borderWidth}
          min={0}
          max={4}
          step={0.5}
          format={px}
          onChange={(borderWidth) => update({ borderWidth })}
        />,
      )}
      {section(
        <FormattedMessage defaultMessage="Glow" />,
        <FormattedMessage defaultMessage="Soft accent-colored halo while active." />,
        <Toggle checked={theme.glow} onChange={(glow) => update({ glow })} />,
      )}
      {section(
        <FormattedMessage defaultMessage="Reactive glow" />,
        <FormattedMessage defaultMessage="Glow brightness follows your voice." />,
        <Toggle
          checked={theme.reactiveGlow}
          onChange={(reactiveGlow) => update({ reactiveGlow })}
        />,
      )}
      {section(
        <FormattedMessage defaultMessage="Shadow" />,
        <FormattedMessage defaultMessage="Soft drop shadow under the pill." />,
        <Toggle
          checked={theme.shadow}
          onChange={(shadow) => update({ shadow })}
        />,
      )}
      {section(
        <FormattedMessage defaultMessage="Idle shape" />,
        <FormattedMessage defaultMessage="The resting pill when nothing is happening." />,
        <Choice
          value={theme.idleShape}
          options={PILL_IDLE_SHAPES}
          labels={IDLE_SHAPE_LABELS}
          onChange={(idleShape) => update({ idleShape })}
        />,
      )}
      {section(
        <FormattedMessage defaultMessage="Idle opacity" />,
        <FormattedMessage defaultMessage="How visible the resting pill is." />,
        <Range
          value={theme.idleOpacity}
          min={0.1}
          max={1}
          step={0.05}
          format={percent}
          onChange={(idleOpacity) => update({ idleOpacity })}
        />,
      )}
      {section(
        <FormattedMessage defaultMessage="Idle width" />,
        <FormattedMessage defaultMessage="Width of the resting pill." />,
        <Range
          value={theme.idleWidth}
          min={0.5}
          max={2.5}
          step={0.1}
          format={times}
          onChange={(idleWidth) => update({ idleWidth })}
        />,
      )}
      {section(
        <FormattedMessage defaultMessage="Hover text" />,
        <FormattedMessage defaultMessage="Shown when you hover the resting pill." />,
        <TextField
          size="small"
          placeholder="Click to dictate"
          value={theme.idleLabel}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            update({ idleLabel: event.target.value.slice(0, 40) })
          }
          sx={{ width: 160 }}
        />,
      )}
    </Stack>
  );

  const position = (
    <Stack spacing={1}>
      {section(
        <FormattedMessage defaultMessage="Horizontal position" />,
        <FormattedMessage defaultMessage="Where the pill sits along the bottom of the screen." />,
        <ToggleButtonGroup
          size="small"
          exclusive
          value={theme.position}
          onChange={(_, value: PillPosition | null) => {
            if (value) update({ position: value });
          }}
        >
          {PILL_POSITIONS.map((option) => (
            <ToggleButton key={option} value={option}>
              {POSITION_LABELS[option]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>,
      )}
      {section(
        <FormattedMessage defaultMessage="Distance from bottom" />,
        <FormattedMessage defaultMessage="Raise the pill above the bottom edge (and dock)." />,
        <Range
          value={theme.bottomOffset}
          min={0}
          max={300}
          step={10}
          format={px}
          onChange={(bottomOffset) => update({ bottomOffset })}
        />,
      )}
    </Stack>
  );

  const effects = (
    <Stack spacing={1}>
      {section(
        <FormattedMessage defaultMessage="Completion effect" />,
        <FormattedMessage defaultMessage="A little celebration when your dictation is pasted." />,
        <Choice
          value={theme.effect}
          options={PILL_COMPLETION_EFFECTS}
          labels={EFFECT_LABELS}
          onChange={(effect) => update({ effect })}
        />,
      )}
      {section(
        <FormattedMessage defaultMessage="Share this look" />,
        <FormattedMessage defaultMessage="Copy the code to reuse this theme on another machine or send it to someone." />,
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            value={shareCode}
            inputProps={{ readOnly: true }}
            onFocus={(event) => event.target.select()}
            sx={{ width: 180 }}
          />
          <Button size="small" onClick={() => void handleCopyShareCode()}>
            <FormattedMessage defaultMessage="Copy" />
          </Button>
        </Stack>,
      )}
      {section(
        <FormattedMessage defaultMessage="Apply a shared look" />,
        <FormattedMessage defaultMessage="Paste a pill theme code here." />,
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder="osvoice-pill:…"
            value={shareInput}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setShareInput(event.target.value)
            }
            sx={{ width: 180 }}
          />
          <Button
            size="small"
            disabled={!shareInput.trim()}
            onClick={handleApplyShareCode}
          >
            <FormattedMessage defaultMessage="Apply" />
          </Button>
        </Stack>,
      )}
    </Stack>
  );

  const panels: Record<TabKey, ReactNode> = {
    presets,
    style,
    colors,
    shape,
    position,
    effects,
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <FormattedMessage defaultMessage="Pill appearance" />
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            <FormattedMessage defaultMessage="The pill previews every change live while this window is open." />
          </Typography>
          <Tabs
            value={tab}
            onChange={(_, value: TabKey) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {TABS.map((key) => (
              <Tab key={key} value={key} label={TAB_LABELS[key]} />
            ))}
          </Tabs>
          <Box sx={{ minHeight: 320 }}>{panels[tab]}</Box>
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
