import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { Term, Transcription } from "@voquill/types";
import {
  findRecurringCorrections,
  MIN_RECURRING_CORRECTION_COUNT,
} from "./recurring-corrections";

let idSeq = 0;
const nextId = (prefix: string): string => `${prefix}-${idSeq++}`;

const buildTranscription = (
  overrides: Partial<Transcription> = {},
): Transcription => ({
  id: nextId("t"),
  createdAt: dayjs().toISOString(),
  createdByUserId: "user-1",
  transcript: "hello world",
  isDeleted: false,
  ...overrides,
});

const buildTerm = (overrides: Partial<Term> = {}): Term => ({
  id: nextId("term"),
  createdAt: dayjs().toISOString(),
  sourceValue: "bob",
  destinationValue: "robert",
  isReplacement: true,
  ...overrides,
});

// Same clean single-word substitution used across the compute.test.ts LCS
// coverage: "bob" -> "robert", flanked by unchanged context on both sides.
const correctionEdit = (i: number): Transcription =>
  buildTranscription({
    createdAt: dayjs().subtract(i, "day").toISOString(),
    rawTranscript: "please call bob today",
    transcript: "please call robert today",
  });

describe("findRecurringCorrections", () => {
  it("should surface a correction that recurs at least the minimum count", () => {
    const transcriptions = [
      correctionEdit(2),
      correctionEdit(1),
      correctionEdit(0),
    ];

    const result = findRecurringCorrections(transcriptions, []);

    expect(result).toEqual([
      {
        source: "bob",
        destination: "robert",
        count: 3,
        anchorTranscriptionId: transcriptions[2].id, // most recent occurrence
      },
    ]);
  });

  it("should exclude corrections that recur fewer than the default threshold", () => {
    expect(MIN_RECURRING_CORRECTION_COUNT).toBe(3);
    const transcriptions = [correctionEdit(1), correctionEdit(0)];

    const result = findRecurringCorrections(transcriptions, []);

    expect(result).toEqual([]);
  });

  it("should honor a custom minCount override", () => {
    const transcriptions = [correctionEdit(1), correctionEdit(0)];

    const result = findRecurringCorrections(transcriptions, [], 2);

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
  });

  it("should exclude corrections whose source is already a known term", () => {
    const transcriptions = [
      correctionEdit(2),
      correctionEdit(1),
      correctionEdit(0),
    ];
    const terms = [buildTerm({ sourceValue: "bob" })];

    const result = findRecurringCorrections(transcriptions, terms);

    expect(result).toEqual([]);
  });

  it("should match existing terms case-insensitively", () => {
    const transcriptions = [
      correctionEdit(2),
      correctionEdit(1),
      correctionEdit(0),
    ];
    const terms = [buildTerm({ sourceValue: "BOB" })];

    const result = findRecurringCorrections(transcriptions, terms);

    expect(result).toEqual([]);
  });

  it("should ignore deleted transcriptions and ones without a real edit", () => {
    const deleted = { ...correctionEdit(2), isDeleted: true };
    const noRaw = buildTranscription({ transcript: "no edit here" });
    const unedited = buildTranscription({
      rawTranscript: "same text",
      transcript: "same text",
    });

    const result = findRecurringCorrections(
      [deleted, noRaw, unedited, correctionEdit(1), correctionEdit(0)],
      [],
      2,
    );

    expect(result).toEqual([
      {
        source: "bob",
        destination: "robert",
        count: 2,
        anchorTranscriptionId: expect.any(String),
      },
    ]);
  });

  it("should sort results by recurrence count descending", () => {
    const bobEdits = [correctionEdit(4), correctionEdit(3), correctionEdit(2)];
    const annEdits = [0, 1].map((i) =>
      buildTranscription({
        createdAt: dayjs().subtract(i, "day").toISOString(),
        rawTranscript: "please call ann today",
        transcript: "please call betty today",
      }),
    );

    const result = findRecurringCorrections([...bobEdits, ...annEdits], [], 2);

    expect(result.map((r) => r.source)).toEqual(["bob", "ann"]);
    expect(result[0].count).toBe(3);
    expect(result[1].count).toBe(2);
  });

  it("should return an empty array when there are no transcriptions", () => {
    expect(findRecurringCorrections([], [])).toEqual([]);
  });
});
