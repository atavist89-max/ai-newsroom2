import { PodcastConfig, GenerationStatus, APIResponse } from '../types/podcast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class AutogenAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async generatePodcast(config: PodcastConfig, onStatusUpdate?: (status: GenerationStatus) => void): Promise<APIResponse> {
    if (onStatusUpdate) {
      onStatusUpdate({
        status: 'researching',
        progress: 10,
        currentStep: 'Researching news from local sources...'
      });
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/generate-podcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.json();
        if (onStatusUpdate) {
          onStatusUpdate({
            status: 'error',
            progress: 0,
            currentStep: 'Error',
            error: error.error || 'Unknown error occurred',
            message: error.reason || error.message
          });
        }
        throw new Error(error.error || 'Generation failed');
      }

      const data: APIResponse = await response.json();

      if (onStatusUpdate) {
        onStatusUpdate({
          status: 'completed',
          progress: 100,
          currentStep: 'Podcast complete!',
          mp3Url: data.mp3Url,
          filename: data.filename,
          metadata: data.metadata
        });
      }

      return data;
    } catch (error: any) {
      if (onStatusUpdate) {
        onStatusUpdate({
          status: 'error',
          progress: 0,
          currentStep: 'Failed',
          error: error.message
        });
      }
      throw error;
    }
  }

  async getOutputs(): Promise<{files: {filename: string; url: string; created: Date}[]}> {
    const response = await fetch(`${this.baseUrl}/api/outputs`);
    return response.json();
  }

  getDownloadUrl(filename: string): string {
    return `${this.baseUrl}/output/${filename}`;
  }
}

export const autogenAPI = new AutogenAPI();
