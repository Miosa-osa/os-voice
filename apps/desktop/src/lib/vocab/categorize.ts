// Lightweight, offline categorization of a learned vocabulary item. Kept purely
// string-derivable (no LLM, no network) so it's cheap to run on every render and
// stays honest — we only claim what the token itself actually tells us.
export type WordCategory =
  | "acronym"
  | "technical"
  | "proper"
  | "phrase"
  | "word";

const TECH_HINT = /[._/]|(?:js|ts|api|sdk|db|css|html|http|cli|ui|ux|ai|ml)$/i;

export const categorizeWord = (raw: string): WordCategory => {
  const word = raw.trim();
  if (!word) return "word";
  if (/\s/.test(word)) return "phrase";
  // ACME, SDK, NASA — short all-caps runs read as acronyms.
  if (/^[A-Z0-9]{2,6}$/.test(word) && /[A-Z]/.test(word)) return "acronym";
  // camelCase / PascalCase / has a digit or separator — reads as technical.
  if (TECH_HINT.test(word) || /[a-z][A-Z]/.test(word) || /\d/.test(word)) {
    return "technical";
  }
  // Leading capital with lowercase tail — a name, place, or brand.
  if (/^[A-Z][a-z]+$/.test(word)) return "proper";
  return "word";
};

export const CATEGORY_ORDER: WordCategory[] = [
  "proper",
  "technical",
  "acronym",
  "phrase",
  "word",
];
