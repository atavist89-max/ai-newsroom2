import { useRef, useEffect } from 'react';
import { AgentState, AgentMessage } from './AgentCard';
import { ChevronDown, MessageSquare, Clock, Wifi, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AgentMessageLogProps {
  agents: Record<string, AgentState>;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

// Define agent order for display
const AGENT_ORDER = [
  'news_researcher',
  'editor',
  'final_writer',
  'fact_checker',
  'recovery_researcher',
  'final_editor',
  'audio_producer'
];

export function AgentMessageLog({ agents, isOpen, onToggle, className }: AgentMessageLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agents, isOpen]);

  // Find agents that have been waiting a long time (stuck detection)
  const now = Date.now();
  const stuckThreshold = 60000; // 60 seconds
  const slowThreshold = 30000;  // 30 seconds

  // Collect all messages from all agents, sorted by timestamp
  const allMessages: Array<{
    id: string;
    agentName: string;
    agentAvatar: string;
    agentStatus: string;
    agentStartTime?: string;
    message: AgentMessage;
  }> = [];

  AGENT_ORDER.forEach((agentName) => {
    const agent = agents[agentName];
    if (agent && agent.messages.length > 0) {
      agent.messages.forEach((msg, idx) => {
        allMessages.push({
          id: `${agentName}-${idx}-${msg.timestamp}`,
          agentName,
          agentAvatar: agent.avatar,
          agentStatus: agent.status,
          agentStartTime: agent.startTime,
          message: msg
        });
      });
    }
  });

  // Sort by timestamp
  allMessages.sort((a, b) => 
    new Date(a.message.timestamp).getTime() - new Date(b.message.timestamp).getTime()
  );

  // Keep only last 100 messages
  const recentMessages = allMessages.slice(-100);

  // Find currently working agents and check if any are stuck
  const workingAgents = Object.entries(agents).filter(([_, agent]) => agent.status === 'working');
  const stuckAgents = workingAgents.filter(([_, agent]) => {
    if (!agent.startTime) return false;
    const elapsed = now - new Date(agent.startTime).getTime();
    return elapsed > stuckThreshold;
  });
  const slowAgents = workingAgents.filter(([_, agent]) => {
    if (!agent.startTime) return false;
    const elapsed = now - new Date(agent.startTime).getTime();
    return elapsed > slowThreshold && elapsed <= stuckThreshold;
  });

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className={cn('bg-slate-900 border border-slate-700 rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <span className="font-medium text-slate-200">Agent Activity Log</span>
          <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">
            {recentMessages.length}
          </span>
          {/* Stuck/Slow indicators */}
          {stuckAgents.length > 0 && (
            <span className="text-xs text-red-400 bg-red-900/50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {stuckAgents.length} stuck
            </span>
          )}
          {slowAgents.length > 0 && stuckAgents.length === 0 && (
            <span className="text-xs text-yellow-400 bg-yellow-900/50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {slowAgents.length} slow
            </span>
          )}
          {workingAgents.length > 0 && slowAgents.length === 0 && stuckAgents.length === 0 && (
            <span className="text-xs text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {workingAgents.length} active
            </span>
          )}
        </div>
        <ChevronDown 
          className={cn(
            'w-5 h-5 text-slate-400 transition-transform duration-200',
            isOpen && 'rotate-180'
          )} 
        />
      </button>

      {/* Message list */}
      {isOpen && (
        <div 
          ref={scrollRef}
          className="max-h-80 overflow-y-auto p-2 space-y-1"
        >
          {/* Stuck agents warning */}
          {stuckAgents.length > 0 && (
            <div className="mb-3 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 font-medium mb-1">
                <AlertCircle className="w-4 h-4" />
                <span>Stuck Agents Detected</span>
              </div>
              {stuckAgents.map(([name, agent]) => {
                const elapsed = agent.startTime ? now - new Date(agent.startTime).getTime() : 0;
                return (
                  <div key={name} className="text-sm text-red-300/80 pl-6">
                    • {agent.avatar} {name.replace(/_/g, ' ')}: waiting for {formatDuration(elapsed)}
                  </div>
                );
              })}
            </div>
          )}

          {/* Slow agents warning */}
          {slowAgents.length > 0 && stuckAgents.length === 0 && (
            <div className="mb-3 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-400 font-medium mb-1">
                <Clock className="w-4 h-4" />
                <span>Slow Agents</span>
              </div>
              {slowAgents.map(([name, agent]) => {
                const elapsed = agent.startTime ? now - new Date(agent.startTime).getTime() : 0;
                return (
                  <div key={name} className="text-sm text-yellow-300/80 pl-6">
                    • {agent.avatar} {name.replace(/_/g, ' ')}: running for {formatDuration(elapsed)}
                  </div>
                );
              })}
            </div>
          )}

          {recentMessages.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-sm">
              No activity yet...
            </div>
          ) : (
            recentMessages.map((msg) => (
              <MessageItem
                key={msg.id}
                agentName={msg.agentName}
                agentAvatar={msg.agentAvatar}
                message={msg.message}
                formatTime={formatTime}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface MessageItemProps {
  agentName: string;
  agentAvatar: string;
  message: AgentMessage;
  formatTime: (timestamp: string) => string;
}

function MessageItem({ agentName, agentAvatar, message, formatTime }: MessageItemProps) {
  // Determine message type and styling based on content
  const content = message.content || '';
  const type = (message as any).type || 'default';
  
  // Get icon and colors based on message type
  const getMessageStyle = () => {
    if (content.includes('🚀 STARTED')) {
      return { 
        icon: <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center">🚀</div>,
        textColor: 'text-blue-300',
        bgColor: 'bg-blue-500/5'
      };
    }
    if (content.includes('📡 Calling') || type === 'api_start' || type === 'api_call') {
      return { 
        icon: <Wifi className="w-4 h-4 text-purple-400" />,
        textColor: 'text-purple-300',
        bgColor: 'bg-purple-500/5'
      };
    }
    if (content.includes('⏱️ Still waiting') || type === 'api_waiting') {
      return { 
        icon: <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />,
        textColor: 'text-yellow-300',
        bgColor: 'bg-yellow-500/10'
      };
    }
    if (content.includes('✅ API call completed') || type === 'api_complete') {
      return { 
        icon: <CheckCircle className="w-4 h-4 text-green-400" />,
        textColor: 'text-green-300',
        bgColor: 'bg-green-500/5'
      };
    }
    if (content.includes('📝 Parsing') || type === 'parsing') {
      return { 
        icon: <div className="w-4 h-4 rounded-full bg-orange-500/20 flex items-center justify-center">📝</div>,
        textColor: 'text-orange-300',
        bgColor: 'bg-orange-500/5'
      };
    }
    if (content.includes('❌ ERROR') || type === 'error') {
      return { 
        icon: <AlertCircle className="w-4 h-4 text-red-400" />,
        textColor: 'text-red-300',
        bgColor: 'bg-red-500/10'
      };
    }
    if (content.includes('✅ COMPLETED') || type === 'complete') {
      return { 
        icon: <CheckCircle className="w-4 h-4 text-green-400" />,
        textColor: 'text-green-300',
        bgColor: 'bg-green-500/10'
      };
    }
    if (content.includes('⏳')) {
      return { 
        icon: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
        textColor: 'text-slate-300',
        bgColor: 'bg-slate-500/5'
      };
    }
    return { 
      icon: null,
      textColor: 'text-slate-400',
      bgColor: ''
    };
  };

  const style = getMessageStyle();

  return (
    <div className={cn(
      "flex items-start gap-2 p-2 rounded-lg transition-colors",
      style.bgColor || "hover:bg-slate-800/50"
    )}>
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-sm">
        {agentAvatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
            {agentName.replace(/_/g, ' ')}
          </span>
          {style.icon && <span className="flex-shrink-0">{style.icon}</span>}
          <span className="text-xs text-slate-500 font-mono">
            {formatTime(message.timestamp)}
          </span>
        </div>
        <p className={cn("text-sm line-clamp-2", style.textColor)}>
          {content.replace(/^[🚀📡⏱️✅📝❌⏳]\s*/, '')}
        </p>
      </div>
    </div>
  );
}
