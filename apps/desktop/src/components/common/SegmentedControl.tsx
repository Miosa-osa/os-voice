import { Box, Tab, Tabs, type Theme } from "@mui/material";
import { SyntheticEvent } from "react";

export type SegmentedControlOption<Value extends string> = {
  value: Value;
  label: string;
  disabled?: boolean;
};

export type SegmentedControlProps<Value extends string> = {
  value: Value;
  options: SegmentedControlOption<Value>[];
  onChange: (value: Value) => void;
  ariaLabel?: string;
};

// Mode-aware: uses the theme's `shadow` token (which itself is already
// tuned per light/dark scheme) and `level2` for hover, so both states stay
// visible in either mode instead of only showing up on dark backgrounds.
const tabSx = (theme: Theme) => ({
  textTransform: "none",
  minHeight: "unset",
  py: 1.25,
  px: 2.5,
  borderRadius: 1.5,
  fontWeight: 600,
  transition: "all 0.2s ease",
  color: "text.secondary",
  "&.Mui-selected": {
    color: "text.primary",
    bgcolor: "background.paper",
    boxShadow: `inset 0 1px 3px ${theme.vars?.palette.shadow}, 0 1px 2px ${theme.vars?.palette.shadow}`,
  },
  "&:hover:not(.Mui-selected)": {
    color: "text.primary",
    bgcolor: theme.vars?.palette.level2,
  },
});

export const SegmentedControl = <Value extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: SegmentedControlProps<Value>) => {
  const activeIndexCandidate = options.findIndex(
    (option) => option.value === value && !option.disabled,
  );
  const fallbackIndex = options.findIndex((option) => !option.disabled);
  const activeIndex =
    activeIndexCandidate >= 0
      ? activeIndexCandidate
      : Math.max(0, fallbackIndex);

  const handleChange = (_event: SyntheticEvent, index: number) => {
    const option = options[index];
    if (!option) {
      return;
    }

    if (option.disabled) {
      return;
    }

    if (option.value !== value) {
      onChange(option.value);
    }
  };

  return (
    <Box
      sx={{
        display: "inline-flex",
        bgcolor: "action.hover",
        borderRadius: 2,
        p: 0.5,
        border: 1,
        borderColor: "divider",
        maxWidth: "100%",
      }}
    >
      <Tabs
        value={activeIndex}
        onChange={handleChange}
        aria-label={ariaLabel}
        sx={{
          minHeight: "unset",
          "& .MuiTabs-indicator": {
            display: "none",
          },
        }}
      >
        {options.map((option) => (
          <Tab
            key={option.value}
            label={option.label}
            sx={tabSx}
            disabled={option.disabled}
          />
        ))}
      </Tabs>
    </Box>
  );
};
