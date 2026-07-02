import { Term } from "@voquill/types";
import { describe, expect, it } from "vitest";
import {
  detectDictionarySuggestions,
  filterNewDictionarySuggestions,
} from "./dictionary-suggestion.utils";

describe("detectDictionarySuggestions", () => {
  it("detects a term after 'I said'", () => {
    expect(detectDictionarySuggestions("I said MIOSA.")).toEqual(["MIOSA"]);
  });

  it("detects a term after 'I meant'", () => {
    expect(
      detectDictionarySuggestions("Not that word, I meant Ollama."),
    ).toEqual(["Ollama"]);
  });

  it("detects multi-word proper nouns", () => {
    expect(detectDictionarySuggestions("I said Robert Potter.")).toEqual([
      "Robert Potter",
    ]);
  });

  it("detects multiple distinct corrections in one transcript", () => {
    expect(
      detectDictionarySuggestions(
        "I said MIOSA. Later I meant Agency Miosa as well.",
      ),
    ).toEqual(["MIOSA", "Agency Miosa"]);
  });

  it("dedupes repeated corrections case-insensitively", () => {
    expect(
      detectDictionarySuggestions("I said MIOSA. I said miosa again."),
    ).toEqual(["MIOSA"]);
  });

  it("ignores common filler corrections", () => {
    expect(detectDictionarySuggestions("I said no, not that.")).toEqual([]);
  });

  it("returns an empty array when there is no correction", () => {
    expect(
      detectDictionarySuggestions("This is a normal sentence with no fixes."),
    ).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(detectDictionarySuggestions("")).toEqual([]);
  });
});

describe("filterNewDictionarySuggestions", () => {
  const existingTerms: Term[] = [
    {
      id: "1",
      createdAt: new Date().toISOString(),
      sourceValue: "MIOSA",
      destinationValue: "MIOSA",
      isReplacement: false,
    },
  ];

  it("filters out candidates already in the dictionary", () => {
    expect(
      filterNewDictionarySuggestions(["MIOSA", "Ollama"], existingTerms),
    ).toEqual(["Ollama"]);
  });

  it("filters case-insensitively", () => {
    expect(filterNewDictionarySuggestions(["miosa"], existingTerms)).toEqual(
      [],
    );
  });

  it("keeps all candidates when the dictionary is empty", () => {
    expect(filterNewDictionarySuggestions(["Ollama"], [])).toEqual(["Ollama"]);
  });
});
