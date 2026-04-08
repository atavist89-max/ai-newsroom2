import { useState, useCallback, useRef, useEffect } from 'react';
import { AgentState, AgentStatus } from '../components/AgentCard';
import { Story, FailedStory } from '../types/podcast';

// Python server WebSocket URL
const PYTHON_WS_URL = import.meta.env.VITE_PYTHON_WS_URL || 'ws://localhost:8000';
const PYTHON_API_URL = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000';

export type WorkflowState = 'running' | 'awaiting_selection' | 'awaiting_replacement' | 'error' | 'complete' | 'timeout';

export interface WorkflowStatus {
  sessionId: string;
  workflowState: WorkflowState;
  currentStep: string;
  progress: number;
  agents: Record<string, AgentState>;
  researchOutput?: {
    localStories: Story[];
    continentStories: Story[];
  };
  failedStory?: FailedStory;
  replacementOptions?: Story[];
  mp3Url?: string;
  filename?: string;
  error?: string;
}

export interface UseAgentWorkflowReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  
  // Workflow state
  sessionId: string | null;
  workflowStatus: WorkflowStatus | null;
  agents: Record<string, AgentState>;
  currentAgent: string | null;
  messages: Array<{ agent: string; content: string; timestamp: string }>;
  
  // Actions
  connect: (sid: string) => void;
  disconnect: () => void;
  startWorkflow: (config: unknown) => Promise<string>;
  submitStorySelection: (localStoryIds: string[], continentStoryIds: string[]) => Promise<void>;
  submitReplacementSelection: (selectedStoryId: string | undefined, removeStory: boolean) => Promise<void>;
  
  // Polling fallback
  pollStatus: (sid: string) => Promise<WorkflowStatus>;
}

// Default agent states
const createDefaultAgents = (): Record<string, AgentState> => ({
  news_researcher: {
    name: 'news_researcher',
    role: 'Investigative Researcher',
    avatar: '🔍',
    status: 'idle' as AgentStatus,
    progress: 0,
    messages: []
  },
  editor: {
    name: 'editor',
    role: 'Content Editor',
    avatar: '✏️',
    status: 'idle' as AgentStatus,
    progress: 0,
    messages: []
  },
  final_writer: {
    name: 'final_writer',
    role: 'Script Writer',
    avatar: '📝',
    status: 'idle' as AgentStatus,
    progress: 0,
    messages: []
  },
  fact_checker: {
    name: 'fact_checker',
    role: 'Verification Specialist',
    avatar: '✅',
    status: 'idle' as AgentStatus,
    progress: 0,
    messages: []
  },
  recovery_researcher: {
    name: 'recovery_researcher',
    role: 'Backup Researcher',
    avatar: '🔄',
    status: 'idle' as AgentStatus,
    progress: 0,
    messages: []
  },
  final_editor: {
    name: 'final_editor',
    role: 'Final Editor',
    avatar: '👔',
    status: 'idle' as AgentStatus,
    progress: 0,
    messages: []
  },
  audio_producer: {
    name: 'audio_producer',
    role: 'Audio Producer',
    avatar: '🎙️',
    status: 'idle' as AgentStatus,
    progress: 0,
    messages: []
  }
});

export function useAgentWorkflow(): UseAgentWorkflowReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [agents, setAgents] = useState<Record<string, AgentState>>(createDefaultAgents());
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ agent: string; content: string; timestamp: string }>>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  // Connect to WebSocket
  const connect = useCallback((sid: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[useAgentWorkflow] Already connected');
      return;
    }

    setIsConnecting(true);
    setSessionId(sid);

    try {
      const ws = new WebSocket(`${PYTHON_WS_URL}/socket.io/?EIO=4&transport=websocket`);
      
      ws.onopen = () => {
        console.log('[useAgentWorkflow] WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        
        // Join session room
        ws.send(JSON.stringify({
          type: 'join_session',
          data: { session_id: sid }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (e) {
          // Handle Socket.IO protocol messages
          if (typeof event.data === 'string') {
            if (event.data.startsWith('0')) {
              // Handshake response
              ws.send('40');
            } else if (event.data.startsWith('40')) {
              // Connected, join room
              ws.send(`420["join_session",{"session_id":"${sid}"}]`);
            } else if (event.data.startsWith('42')) {
              // Event message
              const match = event.data.match(/42\["([^"]+)",(.*)\]/);
              if (match) {
                const [, eventName, eventData] = match;
                handleWebSocketMessage({ type: eventName, data: JSON.parse(eventData) });
              }
            }
          }
        }
      };

      ws.onerror = (error) => {
        console.error('[useAgentWorkflow] WebSocket error:', error);
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onclose = () => {
        console.log('[useAgentWorkflow] WebSocket closed');
        setIsConnected(false);
        setIsConnecting(false);
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (sessionId) {
            console.log('[useAgentWorkflow] Attempting to reconnect...');
            connect(sessionId);
          }
        }, 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[useAgentWorkflow] Error connecting:', error);
      setIsConnecting(false);
    }
  }, [sessionId]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: { type: string; data: unknown }) => {
    console.log('[useAgentWorkflow] Message:', data.type, data.data);

    switch (data.type) {
      case 'agent_started':
      case 'agent_status_update': {
        const msg = data.data as { agent: string; status: AgentStatus; task?: string; progress?: number; message?: string; timestamp?: string };
        const timestamp = msg.timestamp || new Date().toISOString();
        setAgents(prev => ({
          ...prev,
          [msg.agent]: {
            ...prev[msg.agent],
            status: msg.status,
            currentTask: msg.task || prev[msg.agent]?.currentTask,
            progress: msg.progress ?? prev[msg.agent]?.progress,
            startTime: msg.status === 'working' ? timestamp : prev[msg.agent]?.startTime,
            messages: msg.message 
              ? [...(prev[msg.agent]?.messages || []), { timestamp, content: msg.message, type: 'start' }]
              : prev[msg.agent]?.messages
          }
        }));
        if (msg.status === 'working') {
          setCurrentAgent(msg.agent);
        }
        if (msg.message) {
          setMessages(prev => [...prev, { agent: msg.agent, content: msg.message || '', timestamp }]);
        }
        break;
      }

      case 'agent_working': {
        const msg = data.data as { agent: string; message: string; progress: number; timestamp?: string; type?: string; elapsed_seconds?: number };
        const timestamp = msg.timestamp || new Date().toISOString();
        setAgents(prev => ({
          ...prev,
          [msg.agent]: {
            ...prev[msg.agent],
            status: 'working',
            progress: msg.progress,
            messages: [...(prev[msg.agent]?.messages || []), { 
              timestamp, 
              content: msg.message,
              type: msg.type || 'progress'
            }]
          }
        }));
        setCurrentAgent(msg.agent);
        setMessages(prev => [...prev, { agent: msg.agent, content: msg.message || '', timestamp }]);
        break;
      }

      case 'agent_completed': {
        const msg = data.data as { agent: string; output?: string; timestamp?: string; duration_seconds?: number };
        const timestamp = msg.timestamp || new Date().toISOString();
        setAgents(prev => ({
          ...prev,
          [msg.agent]: {
            ...prev[msg.agent],
            status: 'completed',
            progress: 100,
            output: msg.output,
            messages: [...(prev[msg.agent]?.messages || []), { 
              timestamp, 
              content: `✅ COMPLETED${msg.duration_seconds ? ` (took ${msg.duration_seconds < 60 ? msg.duration_seconds + 's' : (msg.duration_seconds/60).toFixed(1) + 'm'})` : ''}`,
              type: 'complete',
              duration_seconds: msg.duration_seconds
            }]
          }
        }));
        break;
      }

      case 'agent_error': {
        const msg = data.data as { agent: string; error: string; timestamp?: string };
        const timestamp = msg.timestamp || new Date().toISOString();
        setAgents(prev => ({
          ...prev,
          [msg.agent]: {
            ...prev[msg.agent],
            status: 'error',
            error: msg.error,
            messages: [...(prev[msg.agent]?.messages || []), { 
              timestamp, 
              content: `❌ ERROR: ${msg.error}`,
              type: 'error'
            }]
          }
        }));
        break;
      }

      case 'workflow_started':
      case 'workflow_resumed':
      case 'workflow_paused':
      case 'workflow_completed':
      case 'workflow_error': {
        // Refresh status from API
        if (sessionId) {
          pollStatus(sessionId);
        }
        break;
      }
    }
  }, [sessionId]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  // Start workflow
  const startWorkflow = useCallback(async (config: unknown): Promise<string> => {
    const response = await fetch(`${PYTHON_API_URL}/workflow/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start workflow');
    }

    const data = await response.json();
    const sid = data.sessionId;
    
    setSessionId(sid);
    setAgents(createDefaultAgents());
    setMessages([]);
    
    // Connect WebSocket
    connect(sid);
    
    return sid;
  }, [connect]);

  // Submit story selection
  const submitStorySelection = useCallback(async (
    localStoryIds: string[],
    continentStoryIds: string[]
  ): Promise<void> => {
    if (!sessionId) throw new Error('No active session');

    const response = await fetch(`${PYTHON_API_URL}/workflow/${sessionId}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localStoryIds, continentStoryIds })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to submit selection');
    }
  }, [sessionId]);

  // Submit replacement selection
  const submitReplacementSelection = useCallback(async (
    selectedStoryId: string | undefined,
    removeStory: boolean
  ): Promise<void> => {
    if (!sessionId) throw new Error('No active session');

    const response = await fetch(`${PYTHON_API_URL}/workflow/${sessionId}/replace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedStoryId, removeStory })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to submit replacement');
    }
  }, [sessionId]);

  // Poll status (fallback when WebSocket is not available)
  const pollStatus = useCallback(async (sid: string): Promise<WorkflowStatus> => {
    const response = await fetch(`${PYTHON_API_URL}/workflow/${sid}/status`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get status');
    }

    const data = await response.json();
    
    // Update local state
    setWorkflowStatus(data);
    if (data.agents) {
      setAgents(data.agents);
    }
    
    return data;
  }, []);

  return {
    isConnected,
    isConnecting,
    sessionId,
    workflowStatus,
    agents,
    currentAgent,
    messages,
    connect,
    disconnect,
    startWorkflow,
    submitStorySelection,
    submitReplacementSelection,
    pollStatus
  };
}
