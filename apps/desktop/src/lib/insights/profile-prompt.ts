import { LocalDictationEvent } from "../../repos/insights.repo";
import {
  categorizeApp,
  UsageStats,
  VoiceProfile,
  WordAnalysis,
} from "./compute";
import { AiVoiceProfile } from "./profile.types";

export const buildProfileSystemPrompt = (): string =>
  "You are an insightful, warm analyst that profiles a person from samples of what they dictated by voice. Be specific and honest, base everything ONLY on the provided samples and stats, and never invent facts. Respond with ONLY a JSON object, no prose or markdown.";

// A compact "words by app category" / "words by tone" breakdown so the model
// can segment the user's voice by context (e.g. terse in Coding, expansive in
// Writing) instead of treating all samples as one undifferentiated blob.
const buildContextBreakdown = (events: LocalDictationEvent[]): string => {
  const byCategory = new Map<string, number>();
  const byTone = new Map<string, number>();
  for (const e of events) {
    const category = categorizeApp(e.appName);
    byCategory.set(category, (byCategory.get(category) ?? 0) + e.wordCount);
    const tone = e.toneId ?? "untagged";
    byTone.set(tone, (byTone.get(tone) ?? 0) + e.wordCount);
  }
  const fmt = (m: Map<string, number>): string =>
    Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => `${k} ${v.toLocaleString()}w`)
      .join(" · ");
  const categoryLine = fmt(byCategory);
  const toneLine = fmt(byTone);
  const lines: string[] = [];
  if (categoryLine) lines.push(`- By app context: ${categoryLine}`);
  if (toneLine) lines.push(`- By tone: ${toneLine}`);
  return lines.join("\n");
};

export const buildProfileUserPrompt = (args: {
  usage: UsageStats;
  profile: VoiceProfile;
  words: WordAnalysis;
  samples: string[];
  events: LocalDictationEvent[];
  previousIdentity?: string | null;
}): string => {
  const { usage, profile, words, samples, events, previousIdentity } = args;
  const sample = samples
    .slice(0, 100)
    .map((s, i) => `${i + 1}. ${s.slice(0, 500)}`)
    .join("\n");
  const recent = samples
    .slice(0, 15)
    .map((s) => s.slice(0, 200))
    .join(" / ");
  const contextBreakdown = buildContextBreakdown(events);

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
${contextBreakdown ? `${contextBreakdown}\n` : ""}
SAMPLES (verbatim things they said):
${sample}

Go DEEP. This should read like a perceptive person who has listened to hours of them talking and genuinely *gets* who they are — their mind, their drives, how they come across — not a stats readout. Read between the lines of the samples: infer personality, motivations and thinking style from HOW they say things, not just what. Be specific and grounded in the evidence, warm but honest. Use the app-context and tone breakdown to notice if they speak differently in different contexts (terser while coding, more expansive while writing) and reflect that where it's visible. Return a JSON object with exactly these keys:
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
  "portrait": "a rich 4-6 sentence portrait of this person addressed to them ('You are someone who...') — weave together who they are, how their mind works, what they're building toward and how they come across. This is the centerpiece; make it feel uncannily accurate and specific to THEM, grounded in the samples.",
  "personality": ["4-6 personality traits/dispositions inferred from how they speak (e.g. driven, impatient with fluff, playful, big-picture, detail-obsessed) — not speech mechanics, actual character"],
  "motivations": ["3-5 things that clearly drive them — goals, ambitions, what they're chasing or trying to build, evidenced by the samples"],
  "communicationSuperpower": "one sentence naming the single most distinctive strength in how they communicate",
  "blindSpots": ["2-4 patterns that may quietly hold them back or trip up listeners — honest but kind, grounded in what you actually see"],
  "howOthersExperienceYou": "2-3 sentences on how they likely come across to the people on the other end — the impression they make",
  "mindsetPatterns": ["3-5 recurring mental/cognitive patterns — how they frame problems, jump between ideas, revisit themes, or reason under pressure"],
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
      portrait: str(p.portrait),
      personality: arr(p.personality),
      motivations: arr(p.motivations),
      communicationSuperpower: str(p.communicationSuperpower),
      blindSpots: arr(p.blindSpots),
      howOthersExperienceYou: str(p.howOthersExperienceYou),
      mindsetPatterns: arr(p.mindsetPatterns),
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
