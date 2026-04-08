import { Loader2, Check, AlertCircle, Hand, User } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type AgentStatus = 'idle' | 'working' | 'completed' | 'error' | 'waiting_for_human';

export interface AgentMessage {
  timestamp: string;
  content: string;
  type?: string;
  progress?: number;
  duration_seconds?: number;
}

export interface AgentState {
  name: string;
  role: string;
  avatar: string;
  status: AgentStatus;
  currentTask?: string;
  progress: number;
  messages: AgentMessage[];
  output?: string;
  error?: string;
  startTime?: string;
}

interface AgentCardProps {
  agent: AgentState;
  isActive: boolean;
  showDetails?: boolean;
  stepNumber?: number;
}

export function AgentCard({ agent, isActive, showDetails = false, stepNumber }: AgentCardProps) {
  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case 'idle':
        return 'bg-slate-700 border-slate-600 text-slate-400';
      case 'working':
        return 'bg-blue-900/30 border-blue-500 text-blue-400';
      case 'completed':
        return 'bg-green-900/30 border-green-500 text-green-400';
      case 'error':
        return 'bg-red-900/30 border-red-500 text-red-400';
      case 'waiting_for_human':
        return 'bg-yellow-900/30 border-yellow-500 text-yellow-400';
      default:
        return 'bg-slate-700 border-slate-600 text-slate-400';
    }
  };

  const getStatusIcon = (status: AgentStatus) => {
    switch (status) {
      case 'idle':
        return <User className="w-5 h-5" />;
      case 'working':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'completed':
        return <Check className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'waiting_for_human':
        return <Hand className="w-5 h-5" />;
      default:
        return <User className="w-5 h-5" />;
    }
  };

  const getStatusLabel = (status: AgentStatus) => {
    switch (status) {
      case 'idle':
        return 'Waiting';
      case 'working':
        return 'Working';
      case 'completed':
        return 'Done';
      case 'error':
        return 'Error';
      case 'waiting_for_human':
        return 'Needs You';
      default:
        return 'Unknown';
    }
  };

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 p-4 transition-all duration-300',
        getStatusColor(agent.status),
        isActive && 'ring-2 ring-offset-2 ring-offset-slate-950 ring-blue-500 scale-105',
        agent.status === 'working' && 'animate-pulse'
      )}
    >
      {/* Avatar & Agent Info */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center text-2xl',
            agent.status === 'working' && 'animate-bounce'
          )}
        >
          {agent.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {stepNumber && (
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold border-2 border-blue-400">
                {stepNumber}
              </span>
            )}
            <h3 className="font-bold text-white text-base truncate uppercase tracking-wide">
              {agent.name.replace(/_/g, ' ')}
            </h3>
          </div>
          <p className="text-xs text-blue-300 font-medium truncate">{agent.role}</p>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-slate-800">
          {getStatusIcon(agent.status)}
          <span className="hidden sm:inline">{getStatusLabel(agent.status)}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">Progress</span>
          <span className="text-slate-300">{agent.progress}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              agent.status === 'completed' ? 'bg-green-500' :
              agent.status === 'error' ? 'bg-red-500' :
              agent.status === 'waiting_for_human' ? 'bg-yellow-500' :
              'bg-blue-500'
            )}
            style={{ width: `${agent.progress}%` }}
          />
        </div>
      </div>

      {/* Current task */}
      {agent.currentTask && (
        <p className="text-sm text-slate-300 line-clamp-2">
          {agent.currentTask}
        </p>
      )}

      {/* Error message */}
      {agent.error && (
        <p className="text-sm text-red-400 mt-2 line-clamp-2">
          {agent.error}
        </p>
      )}

      {/* Recent messages */}
      {showDetails && agent.messages.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 mb-1">Latest:</p>
          <p className="text-xs text-slate-400 line-clamp-2">
            {agent.messages[agent.messages.length - 1]?.content}
          </p>
        </div>
      )}
    </div>
  );
}
