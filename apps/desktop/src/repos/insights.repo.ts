import { invoke } from "@tauri-apps/api/core";

export type LocalDictationEvent = {
  id: string;
  timestamp: number;
  wordCount: number;
  charCount: number;
  appName: string | null;
  appTargetId: string | null;
  toneId: string | null;
  correctionCount: number;
  transcriptionDurationMs: number | null;
  postprocessDurationMs: number | null;
};

export class InsightsRepo {
  async recordEvent(event: LocalDictationEvent): Promise<void> {
    await invoke<void>("insights_record_event", { event });
  }

  async listEvents(): Promise<LocalDictationEvent[]> {
    return invoke<LocalDictationEvent[]>("insights_list_events");
  }
}
