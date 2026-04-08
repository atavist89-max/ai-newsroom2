import { AgentCard, AgentState } from './AgentCard';
import { ArrowRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AgentPipelineProps {
  agents: Record<string, AgentState>;
  currentAgent: string | null;
  className?: string;
}

// Define the order of agents in the pipeline
const AGENT_ORDER = [
  'news_researcher',
  'editor',
  'final_writer',
  'fact_checker',
  'recovery_researcher',
  'final_editor',
  'audio_producer'
];

// Define which agents can loop back
const LOOP_CONNECTIONS: Record<string, string[]> = {
  'fact_checker': ['recovery_researcher', 'final_editor'],
  'recovery_researcher': ['final_writer'],
};

export function AgentPipeline({ agents, currentAgent, className }: AgentPipelineProps) {
  const getAgentIndex = (name: string) => AGENT_ORDER.indexOf(name);
  
  const isActive = (name: string) => {
    if (currentAgent === name) return true;
    // Also highlight if we're waiting for this agent's result
    const agent = agents[name];
    return agent?.status === 'working';
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Desktop: Horizontal Pipeline */}
      <div className="hidden lg:flex items-center justify-between gap-2 overflow-x-auto pb-4">
        {AGENT_ORDER.map((agentName, index) => {
          const agent = agents[agentName];
          if (!agent) return null;
          
          const isLast = index === AGENT_ORDER.length - 1;
          
          return (
            <div key={agentName} className="flex items-center">
              <div className="w-44 flex-shrink-0">
                <AgentCard 
                  agent={agent} 
                  isActive={isActive(agentName)} 
                  stepNumber={index + 1}
                />
              </div>
              {!isLast && (
                <div className="px-2">
                  <ArrowRight 
                    className={cn(
                      'w-5 h-5 transition-all duration-300',
                      agent.status === 'completed' && 
                      (agents[AGENT_ORDER[index + 1]]?.status === 'working' || 
                       agents[AGENT_ORDER[index + 1]]?.status === 'waiting_for_human')
                        ? 'text-blue-400 animate-pulse' 
                        : 'text-slate-700'
                    )} 
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile/Tablet: Vertical Pipeline with Loops */}
      <div className="lg:hidden space-y-2">
        {AGENT_ORDER.map((agentName, index) => {
          const agent = agents[agentName];
          if (!agent) return null;
          
          const isLast = index === AGENT_ORDER.length - 1;
          const loops = LOOP_CONNECTIONS[agentName];
          
          return (
            <div key={agentName}>
              <AgentCard 
                agent={agent} 
                isActive={isActive(agentName)} 
                stepNumber={index + 1}
              />
              
              {/* Standard next connection */}
              {!isLast && !LOOP_CONNECTIONS[agentName]?.includes(AGENT_ORDER[index + 1]) && (
                <div className="flex justify-center py-2">
                  <ArrowRight 
                    className={cn(
                      'w-5 h-5 rotate-90 transition-all duration-300',
                      agent.status === 'completed' && 
                      (agents[AGENT_ORDER[index + 1]]?.status === 'working' || 
                       agents[AGENT_ORDER[index + 1]]?.status === 'waiting_for_human')
                        ? 'text-blue-400 animate-pulse' 
                        : 'text-slate-700'
                    )} 
                  />
                </div>
              )}
              
              {/* Loop connections (conditional branches) */}
              {loops && (
                <div className="flex justify-center gap-8 py-2">
                  {loops.map((loopTarget) => {
                    const targetIndex = getAgentIndex(loopTarget);
                    const isForward = targetIndex > index;
                    
                    return (
                      <div 
                        key={loopTarget}
                        className={cn(
                          'flex flex-col items-center text-xs',
                          agents[loopTarget]?.status === 'working' 
                            ? 'text-blue-400' 
                            : 'text-slate-600'
                        )}
                      >
                        <span className="mb-1 capitalize">
                          {loopTarget.replace(/_/g, ' ')}
                        </span>
                        <ArrowRight 
                          className={cn(
                            'w-4 h-4 transition-all',
                            isForward ? '' : 'rotate-180',
                            agents[loopTarget]?.status === 'working' && 'animate-pulse'
                          )} 
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 justify-center">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-slate-700" />
          <span>Waiting</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Working</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Needs You</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Error</span>
        </div>
      </div>
    </div>
  );
}
