import { LocalDictationEvent } from "../repos/insights.repo";
import { ActionStatus } from "../types/state.types";

export type InsightsTab = "usage" | "voice" | "leaderboard";

export type InsightsState = {
  selectedTab: InsightsTab;
  events: LocalDictationEvent[];
  status: ActionStatus;
};

export const INITIAL_INSIGHTS_STATE: InsightsState = {
  selectedTab: "usage",
  events: [],
  status: "idle",
};
