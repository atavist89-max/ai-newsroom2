import { 
  PodcastConfig, 
  GenerationStatus, 
  APIResponse, 
  WorkflowStatus, 
  StorySelection, 
  ReplacementSelection 
} from '../types/podcast';

// API URLs - use relative URLs (Vite proxy handles routing in dev)
const NODE_API_URL = '';
const PYTHON_API_URL = '';
const PYTHON_WS_URL = '';  // Will construct WebSocket URL based on window.location

export class AutogenAPI {
  private nodeUrl: string;
  private pythonUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.nodeUrl = NODE_API_URL;
    this.pythonUrl = PYTHON_API_URL;
    this.wsUrl = PYTHON_WS_URL;
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Check Node.js server
      const nodeResponse = await fetch(`${this.nodeUrl}/api/health`);
      // Check Python server
      const pythonResponse = await fetch(`${this.pythonUrl}/health`);
      return nodeResponse.ok && pythonResponse.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start a new podcast generation workflow using the Python server
   */
  async startGeneration(config: PodcastConfig): Promise<{ sessionId: string; status: string }> {
    const response = await fetch(`${this.pythonUrl}/workflow/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start generation');
    }

    return response.json();
  }

  /**
   * Get the current status of a workflow from Python server
   */
  async getWorkflowStatus(sessionId: string): Promise<WorkflowStatus> {
    const response = await fetch(`${this.pythonUrl}/workflow/${sessionId}/status`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get workflow status');
    }

    return response.json();
  }

  /**
   * Submit story selection to resume workflow
   */
  async submitStorySelection(sessionId: string, selection: StorySelection): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.pythonUrl}/workflow/${sessionId}/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(selection),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to submit story selection');
    }

    return response.json();
  }

  /**
   * Submit replacement selection to resume workflow
   */
  async submitReplacementSelection(sessionId: string, selection: ReplacementSelection): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.pythonUrl}/workflow/${sessionId}/replace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(selection),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to submit replacement selection');
    }

    return response.json();
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket(
    sessionId: string,
    onMessage: (type: string, data: unknown) => void,
    onConnect?: () => void,
    onDisconnect?: () => void
  ): () => void {
    const connect = () => {
      try {
        // Construct WebSocket URL based on current window location
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = this.wsUrl || `${protocol}//${window.location.host}`;
        this.ws = new WebSocket(`${wsUrl}/socket.io/?EIO=4&transport=websocket`);
        
        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.reconnectAttempts = 0;
          onConnect?.();
        };

        this.ws.onmessage = (event) => {
          this.handleWebSocketMessage(event.data, onMessage, sessionId);
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Closed');
          onDisconnect?.();
          
          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
              console.log(`[WebSocket] Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
              connect();
            }, 3000 * this.reconnectAttempts);
          }
        };
      } catch (error) {
        console.error('[WebSocket] Connection error:', error);
      }
    };

    connect();

    // Return disconnect function
    return () => {
      this.ws?.close();
      this.ws = null;
    };
  }

  private handleWebSocketMessage(
    data: string, 
    onMessage: (type: string, data: unknown) => void,
    sessionId: string
  ) {
    // Handle Socket.IO protocol
    if (data.startsWith('0')) {
      // Handshake response, send ping
      this.ws?.send('40');
    } else if (data.startsWith('40')) {
      // Connected, join session room
      this.ws?.send(`420["join_session",{"session_id":"${sessionId}"}]`);
    } else if (data.startsWith('42')) {
      // Event message
      const match = data.match(/42\["([^"]+)",(.*)\]/);
      if (match) {
        const [, eventName, eventData] = match;
        try {
          const parsedData = JSON.parse(eventData);
          onMessage(eventName, parsedData);
        } catch {
          onMessage(eventName, eventData);
        }
      }
    }
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
   * Uses Node.js backend for synchronous execution
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
      const response = await fetch(`${this.nodeUrl}/api/generate-podcast`, {
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
   * New method that supports human-in-the-loop workflow with real-time updates
   */
  async generatePodcastWithHumanInTheLoop(
    config: PodcastConfig,
    onStatusUpdate?: (status: GenerationStatus) => void,
    onAwaitingSelection?: (sessionId: string, researchOutput: { localStories: any[]; continentStories: any[] }) => void,
    onAwaitingReplacement?: (sessionId: string, failedStory: any, alternatives: any[]) => void,
    useWebSocket: boolean = true
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

      // Step 2: Connect WebSocket for real-time updates
      let disconnectWebSocket: (() => void) | null = null;
      
      if (useWebSocket) {
        disconnectWebSocket = this.connectWebSocket(
          sessionId,
          (type, data) => {
            // Handle WebSocket events
            switch (type) {
              case 'agent_started':
              case 'agent_working':
                if (onStatusUpdate) {
                  onStatusUpdate({
                    status: 'researching',
                    progress: (data as { progress?: number }).progress || 0,
                    currentStep: (data as { task?: string; message?: string }).task || 
                                 (data as { task?: string; message?: string }).message || 
                                 'Working...'
                  });
                }
                break;
              
              case 'workflow_paused':
                const pauseData = data as { reason: string; data: any };
                if (pauseData.reason === 'awaiting_selection' && onAwaitingSelection) {
                  onAwaitingSelection(sessionId, pauseData.data);
                } else if (pauseData.reason === 'awaiting_replacement' && onAwaitingReplacement) {
                  onAwaitingReplacement(sessionId, pauseData.data.failedStory, pauseData.data.alternatives);
                }
                break;
              
              case 'workflow_completed':
                const completeData = data as { mp3_url?: string; filename?: string };
                if (onStatusUpdate) {
                  onStatusUpdate({
                    status: 'completed',
                    progress: 100,
                    currentStep: 'Podcast complete!',
                    mp3Url: completeData.mp3_url,
                    filename: completeData.filename
                  });
                }
                break;
              
              case 'workflow_error':
                const errorData = data as { error: string };
                if (onStatusUpdate) {
                  onStatusUpdate({
                    status: 'error',
                    progress: 0,
                    currentStep: 'Failed',
                    error: errorData.error
                  });
                }
                break;
            }
          }
        );
      }

      // Step 3: Poll for status as fallback/primary
      let workflowStatus = await this.pollWorkflowStatus(sessionId, onStatusUpdate);

      // Step 4: Handle human-in-the-loop interactions
      while (
        workflowStatus.workflowState === 'awaiting_selection' ||
        workflowStatus.workflowState === 'awaiting_replacement'
      ) {
        // These will be handled by WebSocket callbacks or the polling will continue
        // after the user submits via the UI
        workflowStatus = await this.pollWorkflowStatus(sessionId, onStatusUpdate);
      }

      // Cleanup WebSocket
      if (disconnectWebSocket) {
        disconnectWebSocket();
      }

      // Step 5: Handle final state
      if (workflowStatus.workflowState === 'complete') {
        return {
          success: true,
          jobId: sessionId,
          sessionId: sessionId,
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
    const response = await fetch(`${this.pythonUrl}/outputs`);
    return response.json();
  }

  async getFileMetadata(filename: string): Promise<{
    filename: string;
    size: number;
    sizeFormatted: string;
    estimatedDuration: string;
    created: string;
    url: string;
  }> {
    const response = await fetch(`${this.pythonUrl}/output/${filename}/metadata`);
    if (!response.ok) {
      throw new Error('Failed to get file metadata');
    }
    return response.json();
  }

  getDownloadUrl(filename: string): string {
    return `${this.pythonUrl}/output/${filename}`;
  }
}

export const autogenAPI = new AutogenAPI();
