import { useEffect } from "react";
import { Stack, Typography } from "@mui/material";
import { FormattedMessage, useIntl } from "react-intl";
import { loadInsights } from "../../actions/insights.actions";
import { InsightsTab } from "../../state/insights.state";
import { produceAppState, useAppStore } from "../../store";
import { SegmentedControl } from "../common/SegmentedControl";
import { DashboardEntryLayout } from "../dashboard/DashboardEntryLayout";
import { LeaderboardTab } from "./LeaderboardTab";
import { YourUsageTab } from "./YourUsageTab";
import { YourVoiceTab } from "./YourVoiceTab";

export default function InsightsPage() {
  const intl = useIntl();
  const selectedTab = useAppStore((s) => s.insights.selectedTab);

  useEffect(() => {
    void loadInsights();
    // Live updates already arrive via the debounced on-dictation refresh
    // (scheduleInsightsRefresh), so this is just a slow fallback poll. Each run
    // refetches ~5k transcriptions and rebuilds array refs, re-triggering every
    // memoized compute in the tabs — so keep it infrequent (was 20s).
    const interval = setInterval(() => void loadInsights(), 120000);
    return () => clearInterval(interval);
  }, []);

  const setTab = (tab: InsightsTab) =>
    produceAppState((draft) => {
      draft.insights.selectedTab = tab;
    });

  return (
    <DashboardEntryLayout maxWidth="md">
      <Stack spacing={3}>
        <Typography variant="h4" fontWeight={700}>
          <FormattedMessage defaultMessage="Insights" />
        </Typography>

        <SegmentedControl<InsightsTab>
          value={selectedTab}
          onChange={setTab}
          options={[
            {
              value: "usage",
              label: intl.formatMessage({ defaultMessage: "Your Usage" }),
            },
            {
              value: "voice",
              label: intl.formatMessage({ defaultMessage: "Your Voice" }),
            },
            {
              value: "leaderboard",
              label: intl.formatMessage({ defaultMessage: "Leaderboard" }),
            },
          ]}
        />

        {selectedTab === "usage" && <YourUsageTab />}
        {selectedTab === "voice" && <YourVoiceTab />}
        {selectedTab === "leaderboard" && <LeaderboardTab />}
      </Stack>
    </DashboardEntryLayout>
  );
}
