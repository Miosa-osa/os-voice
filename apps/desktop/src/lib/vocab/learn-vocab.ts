const COMMON_WORDS = new Set<string>([
  "the",
  "be",
  "to",
  "of",
  "and",
  "in",
  "that",
  "have",
  "it",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  "do",
  "at",
  "this",
  "but",
  "his",
  "by",
  "from",
  "they",
  "we",
  "say",
  "her",
  "she",
  "or",
  "an",
  "will",
  "my",
  "one",
  "all",
  "would",
  "there",
  "their",
  "what",
  "so",
  "up",
  "out",
  "if",
  "about",
  "who",
  "get",
  "which",
  "go",
  "me",
  "when",
  "make",
  "can",
  "like",
  "time",
  "no",
  "just",
  "him",
  "know",
  "take",
  "people",
  "into",
  "year",
  "your",
  "good",
  "some",
  "could",
  "them",
  "see",
  "other",
  "than",
  "then",
  "now",
  "look",
  "only",
  "come",
  "its",
  "over",
  "think",
  "also",
  "back",
  "after",
  "use",
  "two",
  "how",
  "our",
  "work",
  "first",
  "well",
  "way",
  "even",
  "new",
  "want",
  "because",
  "any",
  "these",
  "give",
  "day",
  "most",
  "are",
  "was",
  "were",
  "been",
  "has",
  "had",
  "did",
  "got",
  "going",
  "really",
  "actually",
  "thing",
  "things",
  "something",
  "someone",
  "okay",
  "yeah",
  "yes",
  "kind",
  "right",
  "let",
  "need",
  "gonna",
  "stuff",
  "lot",
  "little",
  "much",
  "many",
  "very",
  "too",
  "here",
  "where",
  "why",
  "every",
  "should",
  "must",
  "might",
  "may",
  "shall",
  "being",
  "doing",
  "does",
  "done",
  "made",
  "making",
  "said",
  "says",
  "went",
  "goes",
  "gone",
  "came",
  "comes",
  "took",
  "takes",
  "taken",
  "saw",
  "seen",
  "seeing",
  "put",
  "puts",
  "set",
  "sets",
  "keep",
  "kept",
  "find",
  "found",
  "tell",
  "told",
  "ask",
  "asked",
  "try",
  "tried",
  "call",
  "called",
  "feel",
  "felt",
  "seem",
  "seemed",
  "leave",
  "move",
  "moved",
  "turn",
  "turned",
  "start",
  "started",
  "show",
  "showed",
  "hear",
  "heard",
  "play",
  "played",
  "run",
  "ran",
  "bring",
  "brought",
  "begin",
  "began",
  "old",
  "great",
  "big",
  "high",
  "small",
  "large",
  "long",
  "own",
  "same",
  "able",
  "few",
  "last",
  "next",
  "early",
  "young",
  "important",
  "different",
  "following",
  "without",
  "again",
  "against",
  "between",
  "through",
  "during",
  "before",
  "under",
  "around",
  "among",
  "off",
  "down",
  "upon",
  "above",
  "below",
  "near",
  "along",
  "across",
  "behind",
  "beyond",
  "within",
  "toward",
  "hers",
  "ours",
  "yours",
  "theirs",
  "mine",
  "myself",
  "yourself",
  "himself",
  "herself",
  "itself",
  "ourselves",
  "themselves",
  "whom",
  "whose",
  "whoever",
  "whatever",
  "whenever",
  "wherever",
  "nor",
  "yet",
  "although",
  "though",
  "unless",
  "until",
  "while",
  "whereas",
  "since",
  "whether",
  "either",
  "neither",
  "both",
  "each",
  "more",
  "less",
  "least",
  "enough",
  "quite",
  "rather",
  "almost",
  "already",
  "always",
  "never",
  "sometimes",
  "often",
  "usually",
  "maybe",
  "perhaps",
  "probably",
  "definitely",
  "basically",
  "literally",
  "honestly",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "second",
  "third",
  "hundred",
  "thousand",
  "million",
  "zero",
  "none",
  "half",
  "couple",
  "dont",
  "cant",
  "wont",
  "im",
  "ive",
  "youre",
  "thats",
  "were",
  "its",
  "alright",
  "hey",
  "hi",
  "hello",
  "thanks",
  "thank",
  "oh",
  "um",
  "uh",
  "hmm",
  "wow",
  "bye",
  "cool",
  "nice",
  "sure",
  "cause",
  "anything",
  "everything",
  "nothing",
  "everyone",
  "anyone",
  "somebody",
  "anybody",
  "everybody",
]);

const TOKEN_RE = /[A-Za-z][A-Za-z0-9'’-]*[A-Za-z0-9]|[A-Za-z]/g;

const isCapitalizedWord = (token: string): boolean =>
  /^[A-Z][a-z]+$/.test(token);

const strongDistinctiveness = (token: string): number => {
  if (/^[A-Z0-9]{2,}$/.test(token) && /[A-Z]/.test(token)) return 3;
  if (/[a-z][A-Z]/.test(token)) return 3;
  if (/[A-Za-z]/.test(token) && /[0-9]/.test(token)) return 3;
  return 0;
};

const sentencesOf = (text: string): string[] => text.split(/[.!?\n]+/);

export type LearnVocabOptions = { excluded?: Set<string>; max?: number };

type Entry = { display: string; count: number; weight: number };

export const learnVocabulary = (
  transcripts: string[],
  opts: LearnVocabOptions = {},
): string[] => {
  const max = opts.max ?? 40;
  const excluded = new Set(
    Array.from(opts.excluded ?? []).map((word) => word.toLowerCase()),
  );
  excluded.add("os");
  excluded.add("voice");

  // A capitalized word only counts as a name if it appears capitalized away
  // from the start of a sentence — start-of-sentence caps are just grammar.
  const properNouns = new Set<string>();
  for (const text of transcripts) {
    if (!text) continue;
    for (const sentence of sentencesOf(text)) {
      const tokens = sentence.match(TOKEN_RE) ?? [];
      tokens.forEach((token, index) => {
        if (index > 0 && isCapitalizedWord(token)) {
          properNouns.add(token.toLowerCase());
        }
      });
    }
  }

  const weightOf = (token: string): number => {
    const strong = strongDistinctiveness(token);
    if (strong > 0) return strong;
    if (isCapitalizedWord(token) && properNouns.has(token.toLowerCase())) {
      return 2;
    }
    return 0;
  };

  const unigrams = new Map<string, Entry>();
  const bigrams = new Map<string, Entry>();

  const isCandidate = (token: string): boolean => {
    const lower = token.toLowerCase();
    if (lower.length < 3) return false;
    if (/^\d+$/.test(token)) return false;
    if (COMMON_WORDS.has(lower)) return false;
    if (excluded.has(lower)) return false;
    return weightOf(token) > 0;
  };

  for (const text of transcripts) {
    if (!text) continue;
    for (const sentence of sentencesOf(text)) {
      const tokens = sentence.match(TOKEN_RE) ?? [];
      let prev: string | null = null;

      for (const token of tokens) {
        if (isCandidate(token)) {
          const key = token.toLowerCase();
          const weight = weightOf(token);
          const existing = unigrams.get(key);
          if (existing) {
            existing.count += 1;
            if (weight > existing.weight) {
              existing.weight = weight;
              existing.display = token;
            }
          } else {
            unigrams.set(key, { display: token, count: 1, weight });
          }

          if (prev && /^[A-Z]/.test(prev) && /^[A-Z]/.test(token)) {
            const phrase = `${prev} ${token}`;
            const bkey = phrase.toLowerCase();
            const bexisting = bigrams.get(bkey);
            if (bexisting) bexisting.count += 1;
            else bigrams.set(bkey, { display: phrase, count: 1, weight: 4 });
          }
          prev = token;
        } else {
          prev = null;
        }
      }
    }
  }

  const THRESHOLD = 3;
  const score = (entry: Entry): number =>
    entry.weight * Math.log(1 + entry.count);

  const candidates = [...bigrams.values(), ...unigrams.values()].filter(
    (entry) => entry.count >= THRESHOLD,
  );
  candidates.sort((a, b) => score(b) - score(a) || b.count - a.count);

  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of candidates) {
    const key = entry.display.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry.display);
    if (result.length >= max) break;
  }
  return result;
};
