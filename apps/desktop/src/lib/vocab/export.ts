import { invoke } from "@tauri-apps/api/core";
import { Term } from "@voquill/types";
import dayjs from "dayjs";
import { LearnedWord } from "../../state/vocab.state";

// The native `Term` row can now carry an on-demand definition + category (see
// DictionaryRow.tsx), but `@voquill/types` doesn't declare those fields yet.
// Extend locally so exports can include them when present.
export type ExportableTerm = Term & {
  definition?: string | null;
  category?: string | null;
};

// Turns the intelligent dictionary into a portable JSON snapshot: the learned
// vocabulary (with timestamps, definitions and how often each was heard) —
// including the user's ubiquitous language — plus their manual corrections
// and glossary terms.
export const buildVocabJson = (
  learned: LearnedWord[],
  terms: ExportableTerm[],
): string => {
  const ubiquitous = learned.filter((w) => w.isUbiquitous);
  const rest = learned.filter((w) => !w.isUbiquitous);
  const toWordEntry = (w: LearnedWord) => ({
    word: w.word,
    category: w.category ?? null,
    definition: w.definition ?? null,
    example: w.example || null,
    timesHeard: w.timesHeard,
    firstLearnedAt: new Date(w.firstLearnedAt).toISOString(),
    lastHeardAt: w.lastHeardAt ? new Date(w.lastHeardAt).toISOString() : null,
  });
  const corrections = terms
    .filter((t) => t.isReplacement)
    .map((t) => ({
      from: t.sourceValue,
      to: t.destinationValue,
      category: t.category ?? null,
      definition: t.definition ?? null,
    }));
  const glossary = terms
    .filter((t) => !t.isReplacement)
    .filter((t) => t.sourceValue)
    .map((t) => ({
      term: t.sourceValue,
      category: t.category ?? null,
      definition: t.definition ?? null,
    }));

  return JSON.stringify(
    {
      exportedAt: dayjs().toISOString(),
      generator: "OS Voice",
      ubiquitousLanguage: ubiquitous.map(toWordEntry),
      learnedWords: rest.map(toWordEntry),
      corrections,
      glossary,
    },
    null,
    2,
  );
};

// Renders the same data as a human-readable Markdown glossary.
export const buildVocabMarkdown = (
  learned: LearnedWord[],
  terms: ExportableTerm[],
): string => {
  const lines: string[] = [];
  lines.push("# Your OS Voice Dictionary");
  lines.push("");
  lines.push(`_Exported ${dayjs().format("MMMM D, YYYY")}._`);
  lines.push("");

  const describeWord = (w: LearnedWord) => {
    const meta = [
      w.category ? `_${w.category}_` : null,
      `heard ${w.timesHeard}×`,
      `learned ${dayjs(w.firstLearnedAt).format("MMM D, YYYY")}`,
      w.lastHeardAt
        ? `last heard ${dayjs(w.lastHeardAt).format("MMM D, YYYY")}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
    lines.push(`- **${w.word}** — ${w.definition ?? "—"}  (${meta})`);
    if (w.example) lines.push(`  > ${w.example}`);
  };

  const ubiquitous = learned.filter((w) => w.isUbiquitous);
  if (ubiquitous.length > 0) {
    lines.push("## Your ubiquitous language");
    lines.push("");
    lines.push("_The words and phrases you live in._");
    lines.push("");
    for (const w of ubiquitous) describeWord(w);
    lines.push("");
  }

  const rest = learned.filter((w) => !w.isUbiquitous);
  if (rest.length > 0) {
    lines.push("## Words you use");
    lines.push("");
    for (const w of rest) describeWord(w);
    lines.push("");
  }

  const corrections = terms.filter((t) => t.isReplacement);
  if (corrections.length > 0) {
    lines.push("## Corrections you've taught");
    lines.push("");
    for (const t of corrections) {
      const suffix = t.definition ? ` — ${t.definition}` : "";
      lines.push(`- \`${t.sourceValue}\` → **${t.destinationValue}**${suffix}`);
    }
    lines.push("");
  }

  const glossary = terms.filter((t) => !t.isReplacement && t.sourceValue);
  if (glossary.length > 0) {
    lines.push("## Your dictionary");
    lines.push("");
    for (const t of glossary) {
      const suffix = t.definition ? ` — ${t.definition}` : "";
      lines.push(`- ${t.sourceValue}${suffix}`);
    }
    lines.push("");
  }

  return lines.join("\n");
};

// Saves dictionary content to disk via the native save dialog (Tauri
// `export_dictionary` command — see `commands.exportDictionary` in
// `@voquill/desktop-native-apis`). Uses the raw `invoke` call directly, the
// same pattern already used for `export_transcription` in TranscriptRow.tsx,
// since the generated bindings package isn't wired as a dependency here.
// Resolves to `false` if the user cancels the save dialog.
export const exportDictionaryFile = async (
  filename: string,
  contents: string,
): Promise<boolean> => {
  return invoke<boolean>("export_dictionary", { filename, contents });
};
