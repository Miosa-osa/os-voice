import { DailyProfile } from "./profile.types";

// Fields the model fills in for a single day's snapshot (everything on
// DailyProfile except the locally-computed bookkeeping fields).
export type DailyProfileFields = Pick<
  DailyProfile,
  | "summary"
  | "mood"
  | "energy"
  | "focus"
  | "notable"
  | "howYouSpokeToday"
  | "comparedToUsual"
>;

export const buildDailySystemPrompt = (): string =>
  "You are an insightful, warm analyst that reads a single day of someone's voice-dictation history and captures how they were that day. Be specific and honest, base everything ONLY on the provided samples from that day, and never invent facts. Respond with ONLY a JSON object, no prose or markdown.";

export const buildDailyPrompt = (args: {
  date: string;
  samples: string[];
  wordsToday: number;
  dictationsToday: number;
  baseline: string;
}): string => {
  const { date, samples, wordsToday, dictationsToday, baseline } = args;
  const sample = samples
    .slice(0, 60)
    .map((s, i) => `${i + 1}. ${s.slice(0, 500)}`)
    .join("\n");

  return `Analyze what this person dictated on ${date}. From ONLY today's samples below, capture their focus, mood, energy, what they worked on, one notable moment, how they spoke today, and how today compares to their usual baseline (${baseline}).

TODAY'S STATS:
- Words dictated today: ${wordsToday}
- Dictations today: ${dictationsToday}

TODAY'S SAMPLES (verbatim things they said on ${date}):
${sample}

Stay grounded in only what's in today's samples — do not invent facts or carry over assumptions beyond the baseline comparison. Return a JSON object with exactly these keys:
{
  "summary": "2-3 sentences: what they focused on today",
  "mood": "a short phrase describing their mood today (e.g. 'Upbeat and energized')",
  "energy": "a short phrase describing their energy today (e.g. 'High, fast-paced')",
  "focus": ["3-6 short items describing what they worked on today"],
  "notable": "one standout moment or quote from today, verbatim or closely paraphrased",
  "howYouSpokeToday": "1-2 sentences of linguistic read specific to today: pace, clarity, tone",
  "comparedToUsual": "one sentence comparing today to their usual baseline"
}`;
};

// Defensive, regex-extract JSON parse of the model's daily response. Returns
// null when the response isn't usable, so the caller can fall back to a
// templated DailyProfile instead of storing garbage.
export const parseDailyResponse = (text: string): DailyProfileFields | null => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const p = JSON.parse(match[0]) as Record<string, unknown>;
    const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
    const arr = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
        : [];

    const summary = str(p.summary);
    const mood = str(p.mood);
    const energy = str(p.energy);
    const focus = arr(p.focus);
    const notable = str(p.notable);
    const howYouSpokeToday = str(p.howYouSpokeToday);
    const comparedToUsual = str(p.comparedToUsual);

    // Require at least the summary to consider this a usable response.
    if (!summary) return null;

    return {
      summary,
      mood,
      energy,
      focus,
      notable,
      howYouSpokeToday,
      comparedToUsual,
    };
  } catch {
    return null;
  }
};
