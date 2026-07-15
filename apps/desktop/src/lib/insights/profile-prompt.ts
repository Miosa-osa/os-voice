import { UsageStats, VoiceProfile, WordAnalysis } from "./compute";
import { AiVoiceProfile } from "./profile.types";

export const buildProfileSystemPrompt = (): string =>
  "You are an insightful, warm analyst that profiles a person from samples of what they dictated by voice. Be specific and honest, base everything ONLY on the provided samples and stats, and never invent facts. Respond with ONLY a JSON object, no prose or markdown.";

export const buildProfileUserPrompt = (args: {
  usage: UsageStats;
  profile: VoiceProfile;
  words: WordAnalysis;
  samples: string[];
}): string => {
  const { usage, profile, words, samples } = args;
  const sample = samples
    .slice(0, 40)
    .map((s, i) => `${i + 1}. ${s.slice(0, 280)}`)
    .join("\n");

  return `Analyze this person's voice-dictation history and produce a profile of them.

STATS:
- Total words dictated: ${usage.totalWords}
- Speaking pace: ${usage.wpm} words/min
- Peak time: ${profile.peakHourLabel ?? "unknown"}; busiest day: ${profile.peakWeekday ?? "unknown"}
- Main context/app: ${profile.topApp ?? "unknown"}
- Catchphrase: ${profile.catchphrase ?? "n/a"}
- Most-used word: ${profile.mostUsedWord ?? "n/a"}
- Vocabulary size: ${words.vocabularySize} distinct words
- Filler rate: ${words.fillerRate} per 100 words
- Avg sentence length: ${words.avgSentenceLength} words
- Questions: ${words.questionRatio}% of sentences

SAMPLES (verbatim things they said):
${sample}

Return a JSON object with exactly these keys:
{
  "name": "a short evocative persona name that captures them (e.g. The Late-Night Builder)",
  "identity": "2-3 sentences addressed to them, e.g. 'You communicate like... You frequently...'",
  "traits": ["3-5 short trait phrases"],
  "topics": ["3-6 recurring topics/themes actually visible in the samples"],
  "style": "one sentence describing their communication style",
  "quirks": ["2-4 notable speech quirks or habits you actually observe"]
}`;
};

export const parseProfileResponse = (text: string): AiVoiceProfile | null => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const p = JSON.parse(match[0]) as Record<string, unknown>;
    if (typeof p.name !== "string" || typeof p.identity !== "string") {
      return null;
    }
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
    return {
      name: p.name,
      identity: p.identity,
      traits: arr(p.traits),
      topics: arr(p.topics),
      style: typeof p.style === "string" ? p.style : "",
      quirks: arr(p.quirks),
      generated: true,
    };
  } catch {
    return null;
  }
};
