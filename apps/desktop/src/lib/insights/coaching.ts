// Coaching intelligence layer: turns the raw measured stats (WordAnalysis)
// into a scored, prioritized, actionable read. Every number here traces back
// to a real measured stat — nothing is invented or LLM-guessed.
import { WordAnalysis } from "./compute";

export type ScoreDimensionKey =
  "filler" | "sentenceLength" | "vocabulary" | "questionRatio";

export type ScoreDimension = {
  key: ScoreDimensionKey;
  label: string;
  points: number;
  maxPoints: number;
  // A short, numbers-grounded explanation of why this dimension scored the
  // way it did.
  note: string;
};

export type CommunicationGrade = "A" | "B" | "C" | "D" | "F";

export type CommunicationScore = {
  score: number; // 0-100
  grade: CommunicationGrade;
  dimensions: ScoreDimension[];
  // The single strongest-scoring dimension's note (what's lifting the score),
  // or null when there isn't enough signal to say.
  lift: string | null;
  // The single weakest-scoring dimension's note (what's dragging the score),
  // or null when every dimension is already maxed out.
  drag: string | null;
};

const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

const scoreFiller = (fillerRate: number): ScoreDimension => {
  const points = Math.round(clamp(30 - fillerRate * 3, 0, 30));
  const note =
    fillerRate <= 2
      ? `Only ~${fillerRate} filler words per 100 — clean and deliberate.`
      : fillerRate <= 6
        ? `~${fillerRate} filler words per 100 — some "um"/"like" creeping in.`
        : `~${fillerRate} filler words per 100 — fillers are diluting your points.`;
  return {
    key: "filler",
    label: "Filler words",
    points,
    maxPoints: 30,
    note,
  };
};

const scoreSentenceLength = (avgSentenceLength: number): ScoreDimension => {
  let points: number;
  let note: string;
  if (avgSentenceLength === 0) {
    points = 0;
    note = "Not enough sentence data yet.";
  } else if (avgSentenceLength >= 8 && avgSentenceLength <= 20) {
    points = 25;
    note = `~${avgSentenceLength}-word sentences — easy to follow, well-paced.`;
  } else if (avgSentenceLength < 8) {
    points = Math.round(clamp(25 - (8 - avgSentenceLength) * 3, 0, 25));
    note = `Sentences run short (~${avgSentenceLength} words) — can feel choppy.`;
  } else {
    points = Math.round(clamp(25 - (avgSentenceLength - 20) * 1.2, 0, 25));
    note = `Sentences run long (~${avgSentenceLength} words) — can bury the point.`;
  }
  return {
    key: "sentenceLength",
    label: "Sentence length",
    points,
    maxPoints: 25,
    note,
  };
};

const scoreVocabulary = (vocabularySize: number): ScoreDimension => {
  const points = Math.round(clamp(vocabularySize / 32, 0, 25));
  const note =
    vocabularySize >= 600
      ? `${vocabularySize.toLocaleString()} distinct words — a wide-ranging vocabulary.`
      : vocabularySize >= 200
        ? `${vocabularySize.toLocaleString()} distinct words — a solid, growing vocabulary.`
        : `${vocabularySize.toLocaleString()} distinct words so far — still building range.`;
  return {
    key: "vocabulary",
    label: "Vocabulary",
    points,
    maxPoints: 25,
    note,
  };
};

const scoreQuestionRatio = (questionRatio: number): ScoreDimension => {
  let points: number;
  let note: string;
  if (questionRatio >= 5 && questionRatio <= 25) {
    points = 20;
    note = `${questionRatio}% of sentences are questions — curious without hedging.`;
  } else if (questionRatio > 25) {
    points = Math.round(clamp(20 - (questionRatio - 25) * 0.6, 0, 20));
    note = `${questionRatio}% phrased as questions — can read as less certain than you are.`;
  } else {
    points = Math.round(clamp(20 - (5 - questionRatio) * 0.4, 0, 20));
    note = `${questionRatio}% phrased as questions — mostly direct statements.`;
  }
  return {
    key: "questionRatio",
    label: "Directness",
    points,
    maxPoints: 20,
    note,
  };
};

const GRADE_BANDS: { min: number; grade: CommunicationGrade }[] = [
  { min: 90, grade: "A" },
  { min: 75, grade: "B" },
  { min: 60, grade: "C" },
  { min: 45, grade: "D" },
  { min: 0, grade: "F" },
];

const letterGrade = (score: number): CommunicationGrade =>
  GRADE_BANDS.find((band) => score >= band.min)?.grade ?? "F";

// Weighted 0-100 communication score built entirely from the four measured
// dimensions we already track: filler rate (30pts), sentence-length balance
// (25pts), vocabulary range (25pts), and directness/question ratio (20pts).
export const computeCommunicationScore = (
  words: WordAnalysis,
): CommunicationScore => {
  const dimensions: ScoreDimension[] = [
    scoreFiller(words.fillerRate),
    scoreSentenceLength(words.avgSentenceLength),
    scoreVocabulary(words.vocabularySize),
    scoreQuestionRatio(words.questionRatio),
  ];
  const score = clamp(
    Math.round(dimensions.reduce((sum, d) => sum + d.points, 0)),
    0,
    100,
  );

  const ranked = dimensions
    .map((d) => ({ d, ratio: d.maxPoints > 0 ? d.points / d.maxPoints : 0 }))
    .sort((a, b) => a.ratio - b.ratio);
  const weakest = ranked[0];
  const strongest = ranked[ranked.length - 1];

  return {
    score,
    grade: letterGrade(score),
    dimensions,
    drag: weakest && weakest.ratio < 1 ? weakest.d.note : null,
    lift: strongest && strongest.ratio > 0 ? strongest.d.note : null,
  };
};

// Maps a letter grade to a semantic color name so the UI can theme the score
// consistently without re-deriving thresholds.
export const gradeColor = (
  grade: CommunicationGrade,
): "success" | "info" | "warning" | "error" => {
  if (grade === "A") return "success";
  if (grade === "B") return "info";
  if (grade === "C") return "warning";
  return "error";
};

export type FocusThisWeek = {
  title: string;
  detail: string;
  area: ScoreDimensionKey;
};

// The single most-impactful thing to work on this week: whichever measured
// dimension is scoring worst relative to its own max, translated into a
// concrete drill with a real target derived from the current number — never
// a generic "communicate better" nudge.
export const computeFocusThisWeek = (
  words: WordAnalysis,
  score: CommunicationScore,
): FocusThisWeek | null => {
  if (words.avgSentenceLength === 0 && words.vocabularySize === 0) {
    return null;
  }

  const ranked = score.dimensions
    .map((d) => ({ d, ratio: d.maxPoints > 0 ? d.points / d.maxPoints : 0 }))
    .sort((a, b) => a.ratio - b.ratio);
  const weakest = ranked[0];

  if (!weakest || weakest.ratio >= 0.9) {
    return {
      title: "Keep the momentum",
      detail:
        "All four signals are already in a strong range — keep dictating naturally and check back after your next milestone.",
      area: weakest?.d.key ?? "filler",
    };
  }

  switch (weakest.d.key) {
    case "filler": {
      const target = Math.max(1, Math.round(words.fillerRate / 2));
      return {
        title: "Cut filler words",
        detail: `You're at ~${words.fillerRate} filler words per 100 — aim for under ${target}. Pause silently instead of saying "um" or "like"; a beat of quiet reads as confidence.`,
        area: "filler",
      };
    }
    case "sentenceLength": {
      if (words.avgSentenceLength > 20) {
        return {
          title: "Tighten your sentences",
          detail: `Sentences are averaging ~${words.avgSentenceLength} words — aim for 12-18. Say the point first, then the reason, as two sentences instead of one.`,
          area: "sentenceLength",
        };
      }
      return {
        title: "Add connective flow",
        detail: `Sentences are averaging ~${words.avgSentenceLength} words — short bursts can feel choppy. Link consecutive thoughts with "because", "so", or "which means".`,
        area: "sentenceLength",
      };
    }
    case "vocabulary":
      return {
        title: "Widen your word choice",
        detail: `${words.vocabularySize.toLocaleString()} distinct words so far. Before your next dictation, jot 2-3 alternates for a word you overuse and swap one in.`,
        area: "vocabulary",
      };
    case "questionRatio":
      return {
        title: "State it, don't ask it",
        detail: `${words.questionRatio}% of your sentences are phrased as questions — aim for under 20%. Rewrite a few in your head as direct statements before you say them.`,
        area: "questionRatio",
      };
  }
};

export type CoachingDrill = {
  area: string;
  tips: string[];
};

// Concrete, repeatable practice tips for whichever dimensions are currently
// weak enough to count as growth areas — thresholds mirror the growth-area
// thresholds used elsewhere in the coaching layer, so a drill only shows up
// alongside a genuine, numbers-backed weak spot.
export const computeCoachingDrills = (words: WordAnalysis): CoachingDrill[] => {
  const drills: CoachingDrill[] = [];

  if (words.fillerRate >= 6) {
    drills.push({
      area: "Filler words",
      tips: [
        `Pause silently for a beat instead of saying "um" or "like" — you're at ~${words.fillerRate} per 100 words right now.`,
        "Record a 60-second answer, then count fillers afterward — the awareness alone cuts the rate fast.",
      ],
    });
  }

  if (words.avgSentenceLength > 24) {
    drills.push({
      area: "Sentence length",
      tips: [
        `Split long thoughts (currently ~${words.avgSentenceLength} words/sentence) into two: state the point, then the reason.`,
        'Use a "one breath, one idea" rule — if you need a second breath, start a new sentence.',
      ],
    });
  } else if (words.avgSentenceLength > 0 && words.avgSentenceLength < 6) {
    drills.push({
      area: "Sentence flow",
      tips: [
        `Sentences run short (~${words.avgSentenceLength} words) — add a connecting clause ("because...", "which means...") to link consecutive ideas.`,
      ],
    });
  }

  if (words.vocabularySize > 0 && words.vocabularySize < 150) {
    drills.push({
      area: "Vocabulary range",
      tips: [
        "Before dictating, jot 2-3 alternate words for terms you use constantly, and swap one in each session.",
      ],
    });
  }

  if (words.questionRatio >= 30) {
    drills.push({
      area: "Directness",
      tips: [
        `${words.questionRatio}% of your sentences are questions — rewrite three of them as direct statements before you send.`,
      ],
    });
  }

  return drills;
};
