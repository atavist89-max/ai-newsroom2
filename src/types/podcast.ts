export interface Country {
  name: string;
  code: string;
  language: string;
  newsSources: string[];
}

export interface Continent {
  name: string;
  newsSources: { name: string; language: string }[];
}

export interface Timeframe {
  label: string;
  days: number;
  mode: 'daily' | 'weekly' | 'monthly';
}

export interface Voice {
  label: string;
  voiceId: string;
}

export interface MusicConfig {
  intro: {
    description: string;
    mood: string;
  };
  outro: {
    description: string;
    mood: string;
  };
  blockSting: {
    description: string;
  };
  storySting: {
    description: string;
  };
}

export interface PodcastConfig {
  country: Country;
  continent: Continent;
  timeframe: Timeframe;
  topics: string[];
  voice: Voice;
  music: MusicConfig;
  date: string;
}

export interface GenerationStatus {
  status: 'idle' | 'researching' | 'editing' | 'fact-checking' | 'producing' | 'completed' | 'error';
  progress: number;
  currentStep: string;
  message?: string;
  mp3Url?: string;
  filename?: string;
  error?: string;
  metadata?: {
    editorAttempts?: number;
    factCheckAttempts?: number;
    timestamp?: string;
  };
}

export interface APIResponse {
  success: boolean;
  jobId?: string;
  mp3Url?: string;
  filename?: string;
  script?: string;
  metadata?: {
    country: string;
    timeframe: string;
    topics: string[];
    voice: string;
    editorAttempts: number;
    factCheckAttempts: number;
    timestamp: string;
  };
  error?: string;
  message?: string;
  reason?: string;
  violations?: string[];
}
