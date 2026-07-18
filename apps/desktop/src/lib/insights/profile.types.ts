export type AiVoiceProfile = {
  name: string;
  identity: string;
  traits: string[];
  topics: string[];
  style: string;
  quirks: string[];
  recentActivity?: string;
  tone?: string;
  whatsChanged?: string;
  // Deeper multi-dimensional analysis (populated by the big model).
  howYouThink?: string;
  whatYouCareAbout?: string[];
  expertise?: string[];
  howYouSpeak?: string;
  ubiquitousLanguage?: string[];
  // Rich "identifies me" layer — the portrait that makes the profile feel like
  // it genuinely gets the person, not just a stats readout.
  portrait?: string;
  personality?: string[];
  motivations?: string[];
  communicationSuperpower?: string;
  blindSpots?: string[];
  howOthersExperienceYou?: string;
  mindsetPatterns?: string[];
  // Coaching layer: turns the profile from a mirror into a coach.
  coaching?: Coaching;
  generated: boolean;
};

export type Coaching = {
  strengths: string[];
  growthAreas: string[];
  suggestions: string[];
};

// A snapshot of the measured speaking stats at the moment a profile was
// generated, so we can compare generations over time and show real trends
// (e.g. "filler words down 30% since your last profile").
export type CoachingSnapshot = {
  fillerRate: number;
  avgSentenceLength: number;
  vocabularySize: number;
  questionRatio: number;
  wpm: number;
};

export type StoredVoiceProfile = {
  milestone: number;
  createdAt: number;
  totalWords: number;
  profile: AiVoiceProfile;
  catchphrase: string | null;
  mostUsedWord: string | null;
  // Optional for backward compatibility with profiles persisted before this
  // field existed.
  stats?: CoachingSnapshot;
  // Schema/prompt version this profile was generated under. When the current
  // PROFILE_VERSION is newer, the profile is regenerated so users always get the
  // latest depth instead of a stale shallow cache. Absent == 0 (pre-versioning).
  version?: number;
};
