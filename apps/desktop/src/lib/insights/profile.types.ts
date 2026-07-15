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
