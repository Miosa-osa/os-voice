import { WordCategory, categorizeWord } from "../lib/vocab/categorize";
import { learnVocabularyDetailed } from "../lib/vocab/learn-vocab";
import { OllamaGenerateTextRepo } from "../repos/generate-text.repo";
import { getGenerateTextRepo, getTranscriptionRepo } from "../repos";
import { LearnedWord } from "../state/vocab.state";
import { getAppState, produceAppState } from "../store";
import { getLogger } from "../utils/log.utils";
import { getMyUser, getMyUserPreferences } from "../utils/user.utils";

const MAX_TRANSCRIPTS = 500;

// The big model, served via the local Ollama endpoint (which routes `*-cloud`
// models to Ollama's cloud). Used to categorize + define learned words in one
// batched call. Falls back offline to a string heuristic.
const VOCAB_MODEL = "gpt-oss:120b-cloud";
const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const MAX_ENRICH_PER_RUN = 40;

const VALID_CATEGORIES: ReadonlySet<string> = new Set<WordCategory>([
  "acronym",
  "technical",
  "proper",
  "phrase",
  "word",
]);

export const refreshLearnedVocabulary = async (): Promise<void> => {
  try {
    const transcriptions = await getTranscriptionRepo().listTranscriptions({
      limit: MAX_TRANSCRIPTS,
    });
    const transcripts = transcriptions
      .map((transcription) => transcription.transcript)
      .filter((text): text is string => Boolean(text));

    const state = getAppState();
    const excluded = new Set<string>();
    for (const termId of state.dictionary.termIds) {
      const term = state.termById[termId];
      if (term?.sourceValue) excluded.add(term.sourceValue);
      if (term?.destinationValue) excluded.add(term.destinationValue);
    }
    // learnVocabulary excludes per-token, so add each word of a multi-word name.
    const name = getMyUser(state)?.name;
    if (name) {
      for (const part of name.split(/\s+/)) {
        if (part) excluded.add(part);
      }
    }

    const dismissed = new Set(
      (state.local.dismissedVocab ?? []).map((w) => w.toLowerCase()),
    );
    const detailed = learnVocabularyDetailed(transcripts, { excluded });

    // Merge onto the persisted dictionary: keep first-learned timestamps,
    // categories and definitions from prior runs; refresh counts/examples; and
    // never re-surface a word the user has dismissed.
    const now = Date.now();
    const byKey = new Map<string, LearnedWord>();
    for (const existing of state.local.learnedVocab ?? []) {
      const key = existing.word.toLowerCase();
      if (dismissed.has(key)) continue;
      byKey.set(key, existing);
    }
    for (const item of detailed) {
      const key = item.word.toLowerCase();
      if (dismissed.has(key)) continue;
      const existing = byKey.get(key);
      if (existing) {
        byKey.set(key, {
          ...existing,
          timesHeard: Math.max(existing.timesHeard, item.count),
          example: existing.example || item.example,
        });
      } else {
        byKey.set(key, {
          word: item.word,
          example: item.example,
          firstLearnedAt: now,
          timesHeard: item.count,
        });
      }
    }

    const merged = Array.from(byKey.values()).sort(
      (a, b) =>
        b.timesHeard - a.timesHeard || b.firstLearnedAt - a.firstLearnedAt,
    );

    produceAppState((draft) => {
      draft.local.learnedVocab = merged;
      // Keep the legacy in-memory list populated for any older readers.
      draft.vocab.learnedWords = merged.map((w) => w.word);
    });

    await enrichLearnedVocabulary();
  } catch (error) {
    getLogger().error(`Failed to refresh learned vocabulary: ${error}`);
  }
};

// Batched, cached LLM enrichment: categorize + define only the words that don't
// already have both, in ONE model call. Degrades gracefully — on any failure we
// fall back to the offline categorizer and simply leave definitions empty.
export const enrichLearnedVocabulary = async (): Promise<void> => {
  const state = getAppState();
  if (state.local.liteMode === true) return;

  const words = state.local.learnedVocab ?? [];
  const pending = words
    .filter((w) => !w.definition || !w.category)
    .slice(0, MAX_ENRICH_PER_RUN);
  if (pending.length === 0) return;

  const system =
    "You are a precise lexicographer for a voice-dictation app. Given a list of words and phrases a user frequently says, classify and briefly define each. Respond with ONLY a JSON array, no prose or markdown.";
  const list = pending.map((w, i) => `${i + 1}. ${w.word}`).join("\n");
  const prompt = `For each of these words/phrases the user dictates often, return an object with:
- "word": the exact word/phrase, copied verbatim
- "category": one of "acronym" | "technical" | "proper" | "phrase" | "word"
- "definition": one short, plain-language sentence explaining what it means (in the user's domain if it's a term). Keep it under 20 words.

WORDS:
${list}

Return ONLY a JSON array like:
[{"word":"Kubernetes","category":"technical","definition":"An open-source system for automating deployment and scaling of containerized apps."}]`;
  const input = { system, prompt };

  const ollamaUrl =
    getMyUserPreferences(state)?.postProcessingOllamaUrl ?? DEFAULT_OLLAMA_URL;

  let raw: string | null = null;
  try {
    const deep = new OllamaGenerateTextRepo(ollamaUrl, VOCAB_MODEL);
    raw = (await deep.generateText(input)).text;
  } catch (deepError) {
    getLogger().warning(`Vocab enrich model unavailable: ${deepError}`);
    const gen = getGenerateTextRepo();
    if (gen.repo) {
      try {
        raw = (await gen.repo.generateText(input)).text;
      } catch (fallbackError) {
        getLogger().warning(`Vocab enrich fallback failed: ${fallbackError}`);
      }
    }
  }

  const enriched = new Map<
    string,
    { category?: WordCategory; definition?: string }
  >();
  if (raw) {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as unknown;
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            if (!entry || typeof entry !== "object") continue;
            const rec = entry as Record<string, unknown>;
            const word = typeof rec.word === "string" ? rec.word.trim() : "";
            if (!word) continue;
            const category =
              typeof rec.category === "string" &&
              VALID_CATEGORIES.has(rec.category)
                ? (rec.category as WordCategory)
                : undefined;
            const definition =
              typeof rec.definition === "string" && rec.definition.trim()
                ? rec.definition.trim()
                : undefined;
            enriched.set(word.toLowerCase(), { category, definition });
          }
        }
      } catch (parseError) {
        getLogger().warning(`Vocab enrich parse failed: ${parseError}`);
      }
    }
  }

  produceAppState((draft) => {
    const current = draft.local.learnedVocab ?? [];
    for (const w of current) {
      if (w.definition && w.category) continue;
      const hit = enriched.get(w.word.toLowerCase());
      // Always at least assign an offline category so the UI can group; only set
      // a definition when the model actually returned one (graceful degrade).
      w.category = hit?.category ?? w.category ?? categorizeWord(w.word);
      if (!w.definition && hit?.definition) w.definition = hit.definition;
    }
  });
};

// Remove a learned word and remember the choice so it never comes back.
export const dismissLearnedWord = (word: string): void => {
  const key = word.toLowerCase();
  produceAppState((draft) => {
    draft.local.learnedVocab = (draft.local.learnedVocab ?? []).filter(
      (w) => w.word.toLowerCase() !== key,
    );
    const dismissed = draft.local.dismissedVocab ?? [];
    if (!dismissed.some((w) => w.toLowerCase() === key)) {
      draft.local.dismissedVocab = [...dismissed, word];
    }
    draft.vocab.learnedWords = (draft.local.learnedVocab ?? []).map(
      (w) => w.word,
    );
  });
};
