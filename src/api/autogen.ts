import { 
  PodcastConfig, 
  GenerationStatus, 
  APIResponse, 
  WorkflowStatus, 
  StorySelection, 
  ReplacementSelection 
} from '../types/podcast';

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

  /**
   * Start a new podcast generation workflow
   * Returns immediately with a sessionId for polling
   */
  async startGeneration(config: PodcastConfig): Promise<{ sessionId: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/api/generate-podcast/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start generation');
    }

    return response.json();
  }

  /**
   * Get the current status of a workflow
   */
  async getWorkflowStatus(sessionId: string): Promise<WorkflowStatus> {
    const response = await fetch(`${this.baseUrl}/api/workflow/${sessionId}/status`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get workflow status');
    }

    return response.json();
  }

  /**
   * Submit story selection to resume workflow
   */
  async submitStorySelection(sessionId: string, selection: StorySelection): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/workflow/${sessionId}/select-stories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(selection),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit story selection');
    }

    return response.json();
  }

  /**
   * Submit replacement selection to resume workflow
   */
  async submitReplacementSelection(sessionId: string, selection: ReplacementSelection): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/workflow/${sessionId}/select-replacement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(selection),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit replacement selection');
    }

    return response.json();
  }

  /**
   * Poll workflow status until it reaches a terminal state or requires human input
   */
  async pollWorkflowStatus(
    sessionId: string,
    onStatusUpdate?: (status: GenerationStatus) => void,
    checkInterval: number = 2000
  ): Promise<WorkflowStatus> {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const status = await this.getWorkflowStatus(sessionId);
          
          // Map workflow status to generation status for UI updates
          if (onStatusUpdate) {
            onStatusUpdate({
              status: this.mapWorkflowStateToStatus(status.workflowState),
              progress: status.progress,
              currentStep: status.currentStep,
              sessionId: status.sessionId,
              workflowState: status.workflowState,
              researchOutput: status.researchOutput,
              failedStory: status.failedStory,
              replacementOptions: status.replacementOptions,
              mp3Url: status.mp3Url,
              filename: status.filename,
              error: status.error
            });
          }

          // Check if workflow requires human input or is complete/error
          if (
            status.workflowState === 'awaiting_selection' ||
            status.workflowState === 'awaiting_replacement' ||
            status.workflowState === 'complete' ||
            status.workflowState === 'error' ||
            status.workflowState === 'timeout'
          ) {
            resolve(status);
            return;
          }

          // Continue polling
          setTimeout(checkStatus, checkInterval);
        } catch (error: any) {
          reject(error);
        }
      };

      checkStatus();
    });
  }

  /**
   * Legacy method for backward compatibility - starts and runs full workflow
   * Note: This does NOT support human-in-the-loop and will fail if human input is required
   */
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

  /**
   * New method that supports human-in-the-loop workflow
   */
  async generatePodcastWithHumanInTheLoop(
    config: PodcastConfig,
    onStatusUpdate?: (status: GenerationStatus) => void,
    onAwaitingSelection?: (sessionId: string, researchOutput: { localStories: any[]; continentStories: any[] }) => void,
    onAwaitingReplacement?: (sessionId: string, failedStory: any, alternatives: any[]) => void
  ): Promise<APIResponse> {
    try {
      // Step 1: Start the workflow
      if (onStatusUpdate) {
        onStatusUpdate({
          status: 'researching',
          progress: 10,
          currentStep: 'Starting research...'
        });
      }

      const { sessionId } = await this.startGeneration(config);

      // Step 2: Poll for status
      let workflowStatus = await this.pollWorkflowStatus(sessionId, onStatusUpdate);

      // Step 3: Handle human-in-the-loop interactions
      while (
        workflowStatus.workflowState === 'awaiting_selection' ||
        workflowStatus.workflowState === 'awaiting_replacement'
      ) {
        if (workflowStatus.workflowState === 'awaiting_selection' && onAwaitingSelection) {
          // Wait for user to select stories via callback
          await new Promise<void>((resolve) => {
            onAwaitingSelection(sessionId, workflowStatus.researchOutput!);
            // The UI will call submitStorySelection when user confirms
            // We need to poll again after that
            const checkResumed = async () => {
              const status = await this.getWorkflowStatus(sessionId);
              if (status.workflowState !== 'awaiting_selection') {
                resolve();
              } else {
                setTimeout(checkResumed, 1000);
              }
            };
            setTimeout(checkResumed, 1000);
          });
        }

        if (workflowStatus.workflowState === 'awaiting_replacement' && onAwaitingReplacement) {
          // Wait for user to select replacement via callback
          await new Promise<void>((resolve) => {
            onAwaitingReplacement(sessionId, workflowStatus.failedStory!, workflowStatus.replacementOptions!);
            // The UI will call submitReplacementSelection when user confirms
            const checkResumed = async () => {
              const status = await this.getWorkflowStatus(sessionId);
              if (status.workflowState !== 'awaiting_replacement') {
                resolve();
              } else {
                setTimeout(checkResumed, 1000);
              }
            };
            setTimeout(checkResumed, 1000);
          });
        }

        // Continue polling
        workflowStatus = await this.pollWorkflowStatus(sessionId, onStatusUpdate);
      }

      // Step 4: Handle final state
      if (workflowStatus.workflowState === 'complete') {
        return {
          success: true,
          jobId: sessionId,
          mp3Url: workflowStatus.mp3Url,
          filename: workflowStatus.filename,
          metadata: {
            country: config.country.name,
            timeframe: config.timeframe.label,
            topics: config.topics,
            voice: config.voice.label,
            editorAttempts: 0,
            factCheckAttempts: 0,
            timestamp: new Date().toISOString()
          }
        };
      }

      if (workflowStatus.workflowState === 'error' || workflowStatus.workflowState === 'timeout') {
        throw new Error(workflowStatus.error || 'Workflow failed');
      }

      throw new Error('Unexpected workflow state');
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

  private mapWorkflowStateToStatus(state: string): GenerationStatus['status'] {
    switch (state) {
      case 'running':
        return 'researching';
      case 'awaiting_selection':
      case 'awaiting_replacement':
        return 'idle';
      case 'complete':
        return 'completed';
      case 'error':
      case 'timeout':
        return 'error';
      default:
        return 'idle';
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
