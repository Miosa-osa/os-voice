import { Term } from "@voquill/types";
import dayjs from "dayjs";
import { LearnedWord } from "../../state/vocab.state";

// Turns the intelligent dictionary into a portable JSON snapshot: the learned
// vocabulary (with timestamps, definitions and how often each was heard) plus the
// user's manual corrections and glossary terms.
export const buildVocabJson = (
  learned: LearnedWord[],
  terms: Term[],
): string => {
  const corrections = terms
    .filter((t) => t.isReplacement)
    .map((t) => ({ from: t.sourceValue, to: t.destinationValue }));
  const glossary = terms
    .filter((t) => !t.isReplacement)
    .map((t) => t.sourceValue)
    .filter(Boolean);

  return JSON.stringify(
    {
      exportedAt: dayjs().toISOString(),
      generator: "OS Voice",
      learnedWords: learned.map((w) => ({
        word: w.word,
        category: w.category ?? null,
        definition: w.definition ?? null,
        example: w.example || null,
        timesHeard: w.timesHeard,
        firstLearnedAt: new Date(w.firstLearnedAt).toISOString(),
      })),
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
  terms: Term[],
): string => {
  const lines: string[] = [];
  lines.push("# Your OS Voice Dictionary");
  lines.push("");
  lines.push(`_Exported ${dayjs().format("MMMM D, YYYY")}._`);
  lines.push("");

  if (learned.length > 0) {
    lines.push("## Words you use");
    lines.push("");
    for (const w of learned) {
      const meta = [
        w.category ? `_${w.category}_` : null,
        `heard ${w.timesHeard}×`,
      ]
        .filter(Boolean)
        .join(" · ");
      lines.push(`- **${w.word}** — ${w.definition ?? "—"}  (${meta})`);
      if (w.example) lines.push(`  > ${w.example}`);
    }
    lines.push("");
  }

  const corrections = terms.filter((t) => t.isReplacement);
  if (corrections.length > 0) {
    lines.push("## Corrections you've taught");
    lines.push("");
    for (const t of corrections) {
      lines.push(`- \`${t.sourceValue}\` → **${t.destinationValue}**`);
    }
    lines.push("");
  }

  const glossary = terms.filter((t) => !t.isReplacement && t.sourceValue);
  if (glossary.length > 0) {
    lines.push("## Your dictionary");
    lines.push("");
    for (const t of glossary) {
      lines.push(`- ${t.sourceValue}`);
    }
    lines.push("");
  }

  return lines.join("\n");
};

// Triggers a client-side file download from the webview. Kept dependency-free
// (no Tauri fs/dialog plugin is wired in this app) via an object-URL anchor.
export const downloadTextFile = (
  filename: string,
  content: string,
  mime: string,
): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
