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
          // Prefer the freshest example so definitions reflect current usage.
          example: item.example || existing.example,
          lastHeardAt: now,
        });
      } else {
        byKey.set(key, {
          word: item.word,
          example: item.example,
          firstLearnedAt: now,
          lastHeardAt: now,
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

    await syncUbiquitousLanguage();
  } catch (error) {
    getLogger().error(`Failed to refresh learned vocabulary: ${error}`);
  }
};

// D2 bridge: the voice profile identifies the user's "ubiquitous language" — the
// characteristic recurring vocabulary they live in. Fold those terms into the
// dictionary, flagged so the UI can surface them as their own highlighted
// section, then enrich so each gets a real definition. The profile is the source
// of truth, so stale flags are cleared each sync. No-op (beyond enrich) when no
// profile has been generated yet.
export const syncUbiquitousLanguage = async (): Promise<void> => {
  const state = getAppState();
  const terms = (state.insights?.aiProfile?.ubiquitousLanguage ?? [])
    .map((t) => t.trim())
    .filter(Boolean);

  if (terms.length > 0) {
    const now = Date.now();
    const dismissed = new Set(
      (state.local.dismissedVocab ?? []).map((w) => w.toLowerCase()),
    );
    produceAppState((draft) => {
      const list = draft.local.learnedVocab ?? [];
      const byKey = new Map(list.map((w) => [w.word.toLowerCase(), w]));
      for (const w of list) w.isUbiquitous = false;
      for (const term of terms) {
        const key = term.toLowerCase();
        if (dismissed.has(key)) continue;
        const existing = byKey.get(key);
        if (existing) {
          existing.isUbiquitous = true;
        } else {
          const added: LearnedWord = {
            word: term,
            example: "",
            firstLearnedAt: now,
            lastHeardAt: now,
            timesHeard: 0,
            isUbiquitous: true,
          };
          list.push(added);
          byKey.set(key, added);
        }
      }
      draft.local.learnedVocab = list;
      draft.vocab.learnedWords = list.map((w) => w.word);
    });
  }

  await enrichLearnedVocabulary();
};

// Batched, cached LLM enrichment: categorize + define only the words that don't
// already have both, in ONE model call. Degrades gracefully — on any failure we
// fall back to the offline categorizer and simply leave definitions empty.
export const enrichLearnedVocabulary = async (): Promise<void> => {
  const state = getAppState();
  if (state.local.liteMode === true) return;

  const words = state.local.learnedVocab ?? [];
  const pending = words
    .filter(
      (w) =>
        !w.verified && (!w.definition || !w.category || w.isTerm === undefined),
    )
    .slice(0, MAX_ENRICH_PER_RUN);
  if (pending.length === 0) return;

  const system =
    "You are a precise lexicographer AND a strict quality filter for a voice-dictation app's learned-word dictionary. For each word or phrase the user frequently says you are given a real sentence where they used it. Infer the meaning FROM HOW THEY ACTUALLY USE IT and write a good, specific definition — even from a single spoken example, commit to the most likely meaning in their domain rather than hedging. You must ALSO judge whether the candidate is a genuine, dictionary-worthy word/term/name at all, since these candidates are auto-extracted from raw speech transcripts and some are transcription noise. Respond with ONLY a JSON array, no prose or markdown.";
  const list = pending
    .map((w, i) => {
      const ctx = w.example?.trim();
      return ctx
        ? `${i + 1}. "${w.word}" — heard in: "${ctx}"`
        : `${i + 1}. "${w.word}"`;
    })
    .join("\n");
  const prompt = `For each of these words/phrases the user dictates often, return an object with:
- "word": the exact word/phrase, copied verbatim
- "category": one of "acronym" | "technical" | "proper" | "phrase" | "word"
- "definition": one plain-language sentence (under 25 words) explaining what THIS user means by it, grounded in the example sentence provided. If it's a domain term, define it in that domain. Do not say "unclear" or restate the word — always produce a useful definition.
- "isTerm": true if this is a genuine, dictionary-worthy word/term/name — a real word, a proper name, an acronym, a technical term, or a meaningful domain phrase. false if it's transcription noise, a filler phrase, or a random run of words stitched together from speech (e.g. "launch 10 to 15 ages"). REJECT (false) anything that: is a multi-word fragment that just reads like a run of ordinary speech rather than a coined term or name; contains a stray number or number-word; or is mostly filler/common words. ACCEPT (true) real words, proper names, acronyms, technical terms, and meaningful multi-word domain phrases.
- "confidence": one of "high" | "medium" | "low" — how sure you are about the "isTerm" judgment.

WORDS (with the context they were heard in):
${list}

Return ONLY a JSON array like:
[{"word":"Kubernetes","category":"technical","definition":"An open-source system for automating deployment and scaling of containerized apps.","isTerm":true,"confidence":"high"}]`;
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

  const VALID_CONFIDENCE: ReadonlySet<string> = new Set([
    "high",
    "medium",
    "low",
  ]);

  const enriched = new Map<
    string,
    {
      category?: WordCategory;
      definition?: string;
      isTerm?: boolean;
      confidence?: "high" | "medium" | "low";
    }
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
            const isTerm =
              typeof rec.isTerm === "boolean" ? rec.isTerm : undefined;
            const confidence =
              typeof rec.confidence === "string" &&
              VALID_CONFIDENCE.has(rec.confidence)
                ? (rec.confidence as "high" | "medium" | "low")
                : undefined;
            enriched.set(word.toLowerCase(), {
              category,
              definition,
              isTerm,
              confidence,
            });
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
      if (w.verified) continue;
      if (w.definition && w.category && w.isTerm !== undefined) continue;
      const hit = enriched.get(w.word.toLowerCase());
      // Always at least assign an offline category so the UI can group; only set
      // a definition when the model actually returned one (graceful degrade).
      w.category = hit?.category ?? w.category ?? categorizeWord(w.word);
      if (!w.definition && hit?.definition) w.definition = hit.definition;
      // Only overwrite the verification signal when the model actually
      // returned one — a failed/degraded call should never mark a word
      // questionable by leaving isTerm unset forever; it just retries next run.
      if (hit?.isTerm !== undefined) w.isTerm = hit.isTerm;
      if (hit?.confidence) w.confidence = hit.confidence;
    }
  });
};

// User-driven "keep": the user has looked at a questionable entry and
// confirmed it's a real term. Marks it verified so it always shows a check
// and is never re-questioned by future enrichment runs.
export const confirmLearnedWord = (word: string): void => {
  const key = word.toLowerCase();
  produceAppState((draft) => {
    const target = (draft.local.learnedVocab ?? []).find(
      (w) => w.word.toLowerCase() === key,
    );
    if (target) {
      target.verified = true;
      target.isTerm = true;
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
