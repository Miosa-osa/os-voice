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
  generated: boolean;
};

export type StoredVoiceProfile = {
  milestone: number;
  createdAt: number;
  totalWords: number;
  profile: AiVoiceProfile;
  catchphrase: string | null;
  mostUsedWord: string | null;
};
