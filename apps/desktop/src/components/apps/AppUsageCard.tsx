import { AppsOutlined } from "@mui/icons-material";
import { Box, Card, Stack, Typography } from "@mui/material";
import { useCallback } from "react";
import { FormattedMessage } from "react-intl";
import { setAppTargetTone } from "../../actions/app-target.actions";
import { useAppStore } from "../../store";
import { getGenerativePrefs } from "../../utils/user.utils";
import { StorageImage } from "../common/StorageImage";
import { PostProcessingDisabledTooltip } from "../styling/PostProcessingDisabledTooltip";
import { ToneSelect } from "../tones/ToneSelect";
import type { AppUsageSummary } from "./appUsage.utils";

export type AppUsageCardProps = {
  summary: AppUsageSummary;
};

export const AppUsageCard = ({ summary }: AppUsageCardProps) => {
  const isPostProcessingDisabled = useAppStore(
    (state) => getGenerativePrefs(state).mode === "none",
  );

  const handleToneChange = useCallback(
    (toneId: string | null) => {
      void setAppTargetTone(summary.id, toneId);
    },
    [summary.id],
  );

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
            {summary.iconPath ? (
              <StorageImage
                path={summary.iconPath}
                alt={summary.name}
                size={40}
              />
            ) : (
              <AppsOutlined sx={{ color: "text.secondary" }} />
            )}
          </Box>
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {summary.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              <FormattedMessage
                defaultMessage="{words} words · {count, plural, one {# dictation} other {# dictations}} · {avg} words/dictation avg"
                values={{
                  words: summary.totalWords.toLocaleString(),
                  count: summary.dictationCount,
                  avg: summary.avgWordsPerDictation.toLocaleString(),
                }}
              />
            </Typography>
          </Stack>
        </Stack>

        {summary.isRegistered ? (
          <PostProcessingDisabledTooltip disabled={isPostProcessingDisabled}>
            <ToneSelect
              value={summary.toneId}
              onToneChange={handleToneChange}
              addToneTargetId={summary.id}
              disabled={isPostProcessingDisabled}
              formControlSx={{ minWidth: 170 }}
            />
          </PostProcessingDisabledTooltip>
        ) : (
          <Typography variant="body2" color="text.secondary">
            <FormattedMessage defaultMessage="Default" />
          </Typography>
        )}
      </Stack>
    </Card>
  );
};
