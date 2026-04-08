/**
 * RawOutputView Component
 * Displays raw LLM outputs from agents
 */

import { useState } from 'react';
import { AgentOutput } from './agentLogTypes';

interface RawOutputViewProps {
  agentOutputs: Record<string, AgentOutput[]>;
  selectedAgent?: string;
}

// Agent metadata for display
const AGENT_METADATA: Record<string, { icon: string; color: string; label: string }> = {
  news_researcher: { icon: '🔍', color: '#3b82f6', label: 'News Researcher' },
  editor: { icon: '✏️', color: '#8b5cf6', label: 'Editor' },
  final_writer: { icon: '📝', color: '#10b981', label: 'Writer' },
  fact_checker: { icon: '✅', color: '#f59e0b', label: 'Fact Checker' },
  recovery_researcher: { icon: '🔄', color: '#ef4444', label: 'Recovery Researcher' },
  final_editor: { icon: '👔', color: '#6366f1', label: 'Final Editor' },
  audio_producer: { icon: '🎙️', color: '#ec4899', label: 'Audio Producer' }
};

function getAgentMetadata(agent: string) {
  return (
    AGENT_METADATA[agent] || {
      icon: '🤖',
      color: '#6b7280',
      label: agent.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    }
  );
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function countTokens(content: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(content.length / 4);
}

export function RawOutputView({ agentOutputs, selectedAgent }: RawOutputViewProps) {
  const [activeAgent, setActiveAgent] = useState<string>(selectedAgent || '');
  const [expandedMessage, setExpandedMessage] = useState<number | null>(null);

  const agents = Object.keys(agentOutputs);
  const currentAgent = activeAgent && agents.includes(activeAgent) ? activeAgent : agents[0];
  const outputs = currentAgent ? agentOutputs[currentAgent] || [] : [];

  if (agents.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
        <div>No agent outputs yet</div>
        <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Raw LLM outputs will appear here when agents start working
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Agent tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.25rem',
          padding: '0.75rem',
          borderBottom: '1px solid rgba(55, 65, 81, 0.5)',
          overflowX: 'auto'
        }}
      >
        {agents.map((agent) => {
          const meta = getAgentMetadata(agent);
          const isActive = agent === currentAgent;
          const outputCount = agentOutputs[agent]?.length || 0;

          return (
            <button
              key={agent}
              onClick={() => setActiveAgent(agent)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: isActive ? `${meta.color}30` : 'transparent',
                color: isActive ? meta.color : '#9ca3af',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                  backgroundColor: isActive ? `${meta.color}40` : 'rgba(55, 65, 81, 0.5)',
                  color: isActive ? '#fff' : '#9ca3af'
                }}
              >
                {outputCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Output list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        {outputs.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
            No outputs for this agent yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {outputs.map((output, index) => {
              const isExpanded = expandedMessage === index;
              const meta = getAgentMetadata(currentAgent);
              const tokens = countTokens(output.content);

              return (
                <div
                  key={index}
                  style={{
                    borderRadius: '0.5rem',
                    backgroundColor: 'rgba(17, 24, 39, 0.6)',
                    border: '1px solid rgba(55, 65, 81, 0.5)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Message header */}
                  <div
                    onClick={() => setExpandedMessage(isExpanded ? null : index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderBottom: isExpanded ? '1px solid rgba(55, 65, 81, 0.5)' : 'none'
                    }}
                  >
                    <span
                      style={{
                        width: '1.5rem',
                        height: '1.5rem',
                        borderRadius: '0.25rem',
                        backgroundColor: `${meta.color}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem'
                      }}
                    >
                      {meta.icon}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: meta.color,
                        textTransform: 'uppercase'
                      }}
                    >
                      {output.role}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 'auto' }}>
                      {formatTimestamp(output.timestamp)} • ~{tokens} tokens
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>

                  {/* Message content */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '1rem',
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                        color: '#e5e7eb',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '500px',
                        overflow: 'auto'
                      }}
                    >
                      {output.content}
                    </div>
                  )}

                  {/* Collapsed preview */}
                  {!isExpanded && (
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        fontSize: '0.875rem',
                        color: '#9ca3af',
                        lineHeight: 1.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {output.content.slice(0, 150)}
                      {output.content.length > 150 ? '...' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default RawOutputView;
