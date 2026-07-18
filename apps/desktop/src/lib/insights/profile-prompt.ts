import { UsageStats, VoiceProfile, WordAnalysis } from "./compute";
import { AiVoiceProfile } from "./profile.types";

export const buildProfileSystemPrompt = (): string =>
  "You are an insightful, warm analyst that profiles a person from samples of what they dictated by voice. Be specific and honest, base everything ONLY on the provided samples and stats, and never invent facts. Respond with ONLY a JSON object, no prose or markdown.";

export const buildProfileUserPrompt = (args: {
  usage: UsageStats;
  profile: VoiceProfile;
  words: WordAnalysis;
  samples: string[];
  previousIdentity?: string | null;
}): string => {
  const { usage, profile, words, samples, previousIdentity } = args;
  const sample = samples
    .slice(0, 60)
    .map((s, i) => `${i + 1}. ${s.slice(0, 320)}`)
    .join("\n");
  const recent = samples
    .slice(0, 15)
    .map((s) => s.slice(0, 200))
    .join(" / ");

  return `Analyze this person's voice-dictation history and produce a profile of them.

${previousIdentity ? `PREVIOUS PROFILE (for the "whatsChanged" field): ${previousIdentity}\n` : ""}RECENT ACTIVITY (their latest dictations, for "recentActivity"): ${recent}


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

Be deep and specific — this should feel like it genuinely *gets* them. Return a JSON object with exactly these keys:
{
  "name": "a short evocative persona name that captures them (e.g. The Late-Night Builder)",
  "identity": "2-3 sentences addressed to them, e.g. 'You communicate like... You frequently...'",
  "traits": ["3-5 short trait phrases"],
  "topics": ["3-6 recurring topics/themes actually visible in the samples"],
  "style": "one sentence describing their communication style",
  "quirks": ["2-4 notable speech quirks or habits you actually observe"],
  "howYouThink": "2-3 sentences on how they reason and make decisions (e.g. do they think out loud, work top-down, hedge, decide fast)",
  "whatYouCareAbout": ["3-6 things/values/goals they clearly care about, from the samples"],
  "expertise": ["2-5 domains or skills they clearly know well, evidenced by the samples"],
  "howYouSpeak": "2-3 sentences of real linguistic analysis: sentence structure, pacing, directness, formality, energy, filler habits",
  "ubiquitousLanguage": ["6-12 of their CHARACTERISTIC recurring words/phrases/terms — the vocabulary they live in — pulled verbatim from the samples"],
  "recentActivity": "one sentence starting 'Lately you've been...' summarizing their most recent dictations",
  "tone": "1-3 words for their tone/energy (e.g. assertive, measured, enthusiastic)",
  "whatsChanged": "one short sentence on what's shifted since the previous profile, or '' if none/unknown",
  "coaching": {
    "strengths": ["2-4 concrete things they do WELL when they speak — ground each in the stats/samples (e.g. low filler rate of ${words.fillerRate}/100, tight ${words.avgSentenceLength}-word sentences, clear structure)"],
    "growthAreas": ["2-4 specific, kind, actionable things to improve — ground each in the actual numbers (high filler rate, run-on sentences, rambling, too many/few questions at ${words.questionRatio}%)"],
    "suggestions": ["2-4 short practical tips they could try on their next dictation to speak more clearly"]
  }
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
    const str = (v: unknown): string | undefined =>
      typeof v === "string" && v.trim() ? v.trim() : undefined;
    const coachingRaw =
      p.coaching && typeof p.coaching === "object"
        ? (p.coaching as Record<string, unknown>)
        : null;
    const coaching = coachingRaw
      ? {
          strengths: arr(coachingRaw.strengths),
          growthAreas: arr(coachingRaw.growthAreas),
          suggestions: arr(coachingRaw.suggestions),
        }
      : undefined;
    const hasCoaching =
      coaching &&
      (coaching.strengths.length > 0 ||
        coaching.growthAreas.length > 0 ||
        coaching.suggestions.length > 0);
    return {
      name: p.name,
      identity: p.identity,
      traits: arr(p.traits),
      topics: arr(p.topics),
      style: typeof p.style === "string" ? p.style : "",
      quirks: arr(p.quirks),
      howYouThink: str(p.howYouThink),
      whatYouCareAbout: arr(p.whatYouCareAbout),
      expertise: arr(p.expertise),
      howYouSpeak: str(p.howYouSpeak),
      ubiquitousLanguage: arr(p.ubiquitousLanguage),
      recentActivity: str(p.recentActivity),
      tone: str(p.tone),
      whatsChanged: str(p.whatsChanged),
      coaching: hasCoaching ? coaching : undefined,
      generated: true,
    };
  } catch {
    return null;
  }
};
