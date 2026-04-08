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

export interface Story {
  id: string;
  headline: string;
  summary: string;
  newsRating: number;
  source: string;
  originalLanguage: string;
  section: 'local' | 'continent';
  url?: string;
  whyAlternative?: string;
}

export interface FailedStory {
  storyId: string;
  headline: string;
  reason: string;
}

export interface ResearchOutput {
  localStories: Story[];
  continentStories: Story[];
}

export type WorkflowState = 'running' | 'awaiting_selection' | 'awaiting_replacement' | 'error' | 'complete' | 'timeout';

export interface WorkflowStatus {
  sessionId: string;
  workflowState: WorkflowState;
  currentStep: string;
  progress: number;
  researchOutput?: ResearchOutput;
  failedStory?: FailedStory;
  replacementOptions?: Story[];
  error?: string;
  mp3Url?: string;
  filename?: string;
}

export interface GenerationStatus {
  status: WorkflowState | 'idle' | 'researching' | 'editing' | 'fact-checking' | 'producing' | 'completed';
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
  // Human-in-the-Loop fields
  sessionId?: string;
  workflowState?: WorkflowState;
  researchOutput?: ResearchOutput;
  failedStory?: FailedStory;
  replacementOptions?: Story[];
}

export interface APIResponse {
  success: boolean;
  jobId?: string;
  sessionId?: string;
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

export interface StorySelection {
  localStoryIds: string[];
  continentStoryIds: string[];
}

export interface ReplacementSelection {
  selectedStoryId?: string;
  removeStory: boolean;
}
