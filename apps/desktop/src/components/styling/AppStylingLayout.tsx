import { Box, Stack, Typography } from "@mui/material";
import { useCallback } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { loadTones, setActiveTone } from "../../actions/tone.actions";
import { useAsyncEffect } from "../../hooks/async.hooks";
import { useAppStore } from "../../store";
import { getGenerativePrefs } from "../../utils/user.utils";
import { ScrollListPage } from "../common/ScrollListPage";
import { ToneSelect } from "../tones/ToneSelect";
import { PostProcessingDisabledTooltip } from "./PostProcessingDisabledTooltip";
import { AppStylingRow } from "./AppStylingRow";

function HowItWorksStep({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box
        sx={{
          width: 22,
          height: 22,
          flexShrink: 0,
          mt: 0.25,
          borderRadius: "50%",
          bgcolor: "level2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "text.secondary",
        }}
      >
        {index}
      </Box>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: "left" }}
      >
        {children}
      </Typography>
    </Stack>
  );
}

export function AppStylingLayout() {
  const intl = useIntl();

  useAsyncEffect(async () => {
    await loadTones();
  }, []);

  const sortedAppTargetIds = useAppStore((state) =>
    Object.values(state.appTargetById)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((target) => target.id),
  );

  const activeToneId = useAppStore((state) => {
    return state.userPrefs?.activeToneId ?? null;
  });

  const handleActiveToneChange = useCallback((toneId: string | null) => {
    void setActiveTone(toneId);
  }, []);

  const isPostProcessingDisabled = useAppStore(
    (state) => getGenerativePrefs(state).mode === "none",
  );

  return (
    <ScrollListPage
      title={<FormattedMessage defaultMessage="Writing Styles" />}
      subtitle={
        <FormattedMessage defaultMessage="Choose how you want to sound based on what app you're using." />
      }
      action={
        <PostProcessingDisabledTooltip disabled={isPostProcessingDisabled}>
          <ToneSelect
            value={activeToneId}
            trueDefault={true}
            onToneChange={handleActiveToneChange}
            formControlSx={{ minWidth: 200 }}
            label={intl.formatMessage({ defaultMessage: "Default style" })}
            disabled={isPostProcessingDisabled}
          />
        </PostProcessingDisabledTooltip>
      }
      items={sortedAppTargetIds}
      computeItemKey={(id) => id}
      renderItem={(id) => <AppStylingRow key={id} id={id} />}
      emptyState={
        <Stack
          spacing={2}
          alignItems="center"
          sx={{ maxWidth: 340, mx: "auto" }}
        >
          <Typography variant="h6" color="text.secondary">
            <FormattedMessage defaultMessage="How it works" />
          </Typography>
          <Stack spacing={1.5} sx={{ width: "100%" }}>
            <HowItWorksStep index={1}>
              <FormattedMessage defaultMessage="Open up the app you want to style (like Slack or Chrome)." />
            </HowItWorksStep>
            <HowItWorksStep index={2}>
              <FormattedMessage defaultMessage='Click on the OS Voice icon in the menu bar, and click "Register this app".' />
            </HowItWorksStep>
            <HowItWorksStep index={3}>
              <FormattedMessage defaultMessage="Go back to OS Voice, and select a writing style for that app." />
            </HowItWorksStep>
          </Stack>
        </Stack>
      }
    />
  );
}
