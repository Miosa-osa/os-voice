import { Check, MoreVert } from "@mui/icons-material";
import { Box, Card, IconButton, Stack, Typography } from "@mui/material";
import { getRec } from "@voquill/utilities";
import { useCallback } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  setAppTargetPasteKeybind,
  setAppTargetTone,
} from "../../actions/app-target.actions";
import { useAppStore } from "../../store";
import { isMacOS } from "../../utils/env.utils";
import { getGenerativePrefs } from "../../utils/user.utils";
import {
  MenuPopoverBuilder,
  type MenuPopoverItem,
} from "../common/MenuPopover";
import { StorageImage } from "../common/StorageImage";
import { ToneSelect } from "../tones/ToneSelect";
import { PostProcessingDisabledTooltip } from "./PostProcessingDisabledTooltip";

export type AppStylingRowProps = {
  id: string;
};

export const AppStylingRow = ({ id }: AppStylingRowProps) => {
  const intl = useIntl();
  const target = useAppStore((state) => getRec(state.appTargetById, id));
  const isPostProcessingDisabled = useAppStore(
    (state) => getGenerativePrefs(state).mode === "none",
  );

  const handleToneChange = useCallback(
    (toneId: string | null) => {
      if (!target) {
        return;
      }

      void setAppTargetTone(target.id, toneId);
    },
    [target],
  );

  const handlePasteKeybindChange = useCallback(
    (value: string) => {
      if (!target) {
        return;
      }

      // Store null for default (ctrl+v) to keep database cleaner
      void setAppTargetPasteKeybind(
        target.id,
        value === "ctrl+v" ? null : value,
      );
    },
    [target],
  );

  const toneValue = target?.toneId ?? null;
  const pasteKeybindValue = target?.pasteKeybind ?? "ctrl+v";

  const pasteKeybindMenuItems: MenuPopoverItem[] = [
    {
      kind: "genericItem",
      builder: () => (
        <Box sx={{ px: 2, py: 1.5, maxWidth: 280 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            <FormattedMessage defaultMessage="Paste Keybind" />
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <FormattedMessage defaultMessage="Different applications use different keyboard shortcuts for pasting. Select the keybind that works best for this app." />
          </Typography>
        </Box>
      ),
    },
    { kind: "divider" },
    {
      kind: "listItem",
      title: <FormattedMessage defaultMessage="Default (Ctrl+V)" />,
      trailing: pasteKeybindValue === "ctrl+v" ? <Check /> : undefined,
      onClick: ({ close }) => {
        handlePasteKeybindChange("ctrl+v");
        close();
      },
    },
    {
      kind: "listItem",
      title: <FormattedMessage defaultMessage="Terminal (Ctrl+Shift+V)" />,
      trailing: pasteKeybindValue === "ctrl+shift+v" ? <Check /> : undefined,
      onClick: ({ close }) => {
        handlePasteKeybindChange("ctrl+shift+v");
        close();
      },
    },
    {
      kind: "listItem",
      title: <FormattedMessage defaultMessage="Shift+Insert" />,
      trailing: pasteKeybindValue === "shift+insert" ? <Check /> : undefined,
      onClick: ({ close }) => {
        handlePasteKeybindChange("shift+insert");
        close();
      },
    },
  ];

  return (
    <Card sx={{ p: 2, mb: 1.5 }}>
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ minWidth: 0 }}
        >
          <Box
            sx={{
              overflow: "hidden",
              borderRadius: 1,
              width: 40,
              height: 40,
              flexShrink: 0,
              bgcolor: "level2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {target?.iconPath && (
              <StorageImage
                path={target.iconPath}
                alt={
                  target?.name ??
                  intl.formatMessage({ defaultMessage: "App icon" })
                }
                size={40}
              />
            )}
          </Box>
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            {target?.name}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <PostProcessingDisabledTooltip disabled={isPostProcessingDisabled}>
            <ToneSelect
              value={toneValue}
              onToneChange={handleToneChange}
              addToneTargetId={target?.id ?? null}
              disabled={!target || isPostProcessingDisabled}
              formControlSx={{ minWidth: 160 }}
            />
          </PostProcessingDisabledTooltip>
          {!isMacOS() && (
            <MenuPopoverBuilder items={pasteKeybindMenuItems}>
              {({ ref, open }) => (
                <IconButton
                  ref={ref}
                  onClick={open}
                  disabled={!target}
                  size="small"
                  sx={{ width: 32, height: 32, p: 0 }}
                >
                  <MoreVert fontSize="small" />
                </IconButton>
              )}
            </MenuPopoverBuilder>
          )}
        </Stack>
      </Stack>
    </Card>
  );
};
