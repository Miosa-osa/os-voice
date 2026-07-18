import { AppsOutlined } from "@mui/icons-material";
import { Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { FormattedMessage } from "react-intl";
import { loadInsights } from "../../actions/insights.actions";
import { loadTones } from "../../actions/tone.actions";
import { useAsyncEffect } from "../../hooks/async.hooks";
import { useAppStore } from "../../store";
import { ScrollListPage } from "../common/ScrollListPage";
import { AppUsageCard } from "./AppUsageCard";
import { computeAppUsageSummaries } from "./appUsage.utils";

export default function AppsPage() {
  useAsyncEffect(async () => {
    await Promise.all([loadInsights(), loadTones()]);
  }, []);

  const events = useAppStore((state) => state.insights.events);
  const appTargetById = useAppStore((state) => state.appTargetById);

  const summaries = useMemo(
    () => computeAppUsageSummaries(events, appTargetById),
    [events, appTargetById],
  );

  return (
    <ScrollListPage
      title={<FormattedMessage defaultMessage="Per-App" />}
      subtitle={
        <FormattedMessage defaultMessage="See how much you dictate in each app, and which writing style it uses." />
      }
      items={summaries}
      computeItemKey={(summary) => summary.id}
      renderItem={(summary) => <AppUsageCard summary={summary} />}
      emptyState={
        <Stack
          spacing={1.5}
          alignItems="center"
          width={320}
          alignSelf="center"
          mx="auto"
          textAlign="center"
        >
          <AppsOutlined sx={{ fontSize: 40, color: "text.secondary" }} />
          <Typography variant="h6">
            <FormattedMessage defaultMessage="No apps yet" />
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <FormattedMessage defaultMessage="Once you dictate into an app, it will show up here with its usage and writing style." />
          </Typography>
        </Stack>
      }
    />
  );
}
