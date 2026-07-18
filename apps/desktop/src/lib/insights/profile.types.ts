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
  // Coaching layer: turns the profile from a mirror into a coach.
  coaching?: Coaching;
  generated: boolean;
};

export type Coaching = {
  strengths: string[];
  growthAreas: string[];
  suggestions: string[];
};

export type StoredVoiceProfile = {
  milestone: number;
  createdAt: number;
  totalWords: number;
  profile: AiVoiceProfile;
  catchphrase: string | null;
  mostUsedWord: string | null;
};
