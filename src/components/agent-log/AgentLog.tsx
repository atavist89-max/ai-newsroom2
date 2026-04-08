/**
 * AgentLog Component
 * Main container for the Agent Log feature
 * Provides tabs for Activity Timeline, Artifacts Grid, and Raw Outputs
 */

import { useState, useEffect, useCallback } from 'react';
import { ActivityTimeline } from './ActivityTimeline';
import { ArtifactsGrid } from './ArtifactsGrid';
import { RawOutputView } from './RawOutputView';
import { ArtifactViewer } from './ArtifactViewer';
import { AgentLogData, ActivityLogEntry } from './agentLogTypes';

interface AgentLogProps {
  sessionId: string | null;
  isVisible: boolean;
  onClose: () => void;
}

type TabType = 'activity' | 'artifacts' | 'outputs';

// Use relative URL to go through Vite proxy
const API_BASE = '';  // Empty for relative URLs, Vite proxy will handle routing

export function AgentLog({ sessionId, isVisible, onClose }: AgentLogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [logData, setLogData] = useState<AgentLogData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<{ type: string; content: unknown } | null>(null);

  // Fetch agent log data
  const fetchLogData = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/workflow/${sessionId}/full-state`);

      if (!response.ok) {
        throw new Error(`Failed to fetch log data: ${response.statusText}`);
      }

      const data = await response.json();
      setLogData({
        sessionId: data.sessionId,
        artifacts: data.artifacts || {},
        artifactTypes: data.artifactTypes || [],
        activityLog: data.activityLog || [],
        totalEvents: data.totalEvents || 0,
        agentOutputs: data.agentOutputs || {}
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch log data';
      console.error('[AgentLog] Fetch error:', errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Initial fetch and polling
  useEffect(() => {
    if (isVisible && sessionId) {
      fetchLogData();

      // Poll every 5 seconds while visible
      const interval = setInterval(fetchLogData, 5000);
      return () => clearInterval(interval);
    }
  }, [isVisible, sessionId, fetchLogData]);

  // Don't render if not visible
  if (!isVisible) return null;

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'activity', label: 'Activity', icon: '📊' },
    { id: 'artifacts', label: 'Artifacts', icon: '📦' },
    { id: 'outputs', label: 'Raw Outputs', icon: '🔧' }
  ];

  return (
    <>
      {/* Overlay backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 900
        }}
        onClick={onClose}
      />

      {/* Agent Log Panel */}
      <div
        style={{
          position: 'fixed',
          top: '5%',
          left: '10%',
          right: '10%',
          bottom: '5%',
          backgroundColor: '#111827',
          borderRadius: '0.75rem',
          border: '1px solid rgba(55, 65, 81, 0.8)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          zIndex: 901,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(55, 65, 81, 0.5)',
            backgroundColor: 'rgba(17, 24, 39, 0.8)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem'
              }}
            >
              📋
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e5e7eb' }}>
                Agent Log
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {sessionId ? `Session: ${sessionId.slice(0, 8)}...` : 'No active session'}
                {logData && ` • ${logData.totalEvents} events`}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={fetchLogData}
              disabled={isLoading}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid rgba(55, 65, 81, 0.8)',
                backgroundColor: 'transparent',
                color: '#9ca3af',
                fontSize: '0.875rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              {isLoading ? '🔄' : '↻'} Refresh
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid rgba(55, 65, 81, 0.8)',
                backgroundColor: 'transparent',
                color: '#9ca3af',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.25rem',
            padding: '0.5rem 1rem',
            borderBottom: '1px solid rgba(55, 65, 81, 0.5)',
            backgroundColor: 'rgba(17, 24, 39, 0.5)'
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: activeTab === tab.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                color: activeTab === tab.id ? '#3b82f6' : '#9ca3af',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === 'activity' && logData && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '0.25rem',
                    backgroundColor: activeTab === tab.id ? 'rgba(59, 130, 246, 0.3)' : 'rgba(55, 65, 81, 0.5)',
                    color: activeTab === tab.id ? '#fff' : '#9ca3af'
                  }}
                >
                  {logData.totalEvents}
                </span>
              )}
              {tab.id === 'artifacts' && logData && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '0.25rem',
                    backgroundColor: activeTab === tab.id ? 'rgba(59, 130, 246, 0.3)' : 'rgba(55, 65, 81, 0.5)',
                    color: activeTab === tab.id ? '#fff' : '#9ca3af'
                  }}
                >
                  {logData.artifactTypes.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {error && (
            <div
              style={{
                padding: '1rem',
                margin: '1rem',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444'
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {isLoading && !logData && (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
              <div>Loading agent log...</div>
            </div>
          )}

          {logData && (
            <>
              {activeTab === 'activity' && (
                <ActivityTimeline
                  events={logData.activityLog}
                  onEventClick={(event: ActivityLogEntry) => {
                    console.log('Event clicked:', event);
                  }}
                />
              )}

              {activeTab === 'artifacts' && (
                <ArtifactsGrid
                  artifacts={logData.artifacts}
                  onArtifactClick={(type: string, content: unknown) => {
                    setSelectedArtifact({ type, content });
                  }}
                />
              )}

              {activeTab === 'outputs' && (
                <RawOutputView agentOutputs={logData.agentOutputs} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Artifact viewer modal */}
      {selectedArtifact && (
        <ArtifactViewer
          type={selectedArtifact.type}
          content={selectedArtifact.content}
          onClose={() => setSelectedArtifact(null)}
        />
      )}
    </>
  );
}

export default AgentLog;
