import { useMemo } from "react";
import { useAppStore } from "../../store";

export const useInsightsSources = () => {
  const events = useAppStore((s) => s.insights.events);
  const status = useAppStore((s) => s.insights.status);
  const transcriptionById = useAppStore((s) => s.transcriptionById);
  const termById = useAppStore((s) => s.termById);

  const transcriptions = useMemo(
    () => Object.values(transcriptionById),
    [transcriptionById],
  );
  const terms = useMemo(() => Object.values(termById), [termById]);

  return { events, transcriptions, terms, status };
};
