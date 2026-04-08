/**
 * ActivityTimeline Component
 * Displays a chronological timeline of all workflow events
 */

import { ActivityLogEntry } from './agentLogTypes';

interface ActivityTimelineProps {
  events: ActivityLogEntry[];
  onEventClick?: (event: ActivityLogEntry) => void;
}

// Agent metadata for display
const AGENT_METADATA: Record<string, { icon: string; color: string }> = {
  news_researcher: { icon: '🔍', color: '#3b82f6' },
  editor: { icon: '✏️', color: '#8b5cf6' },
  final_writer: { icon: '📝', color: '#10b981' },
  fact_checker: { icon: '✅', color: '#f59e0b' },
  recovery_researcher: { icon: '🔄', color: '#ef4444' },
  final_editor: { icon: '👔', color: '#6366f1' },
  audio_producer: { icon: '🎙️', color: '#ec4899' },
  system: { icon: '⚙️', color: '#6b7280' }
};

// Event type icons
const EVENT_TYPE_ICONS: Record<string, string> = {
  workflow_started: '🚀',
  workflow_paused: '⏸️',
  workflow_resumed: '▶️',
  workflow_completed: '✅',
  workflow_error: '❌',
  agent_started: '▶️',
  agent_working: '🔄',
  agent_completed: '✅',
  agent_error: '❌',
  agent_api_call: '📡',
  agent_parsing: '📋',
  story_selected: '📰',
  replacement_selected: '🔄'
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}



function getEventIcon(event: ActivityLogEntry): string {
  if (EVENT_TYPE_ICONS[event.event_type]) {
    return EVENT_TYPE_ICONS[event.event_type];
  }
  if (event.agent && AGENT_METADATA[event.agent]) {
    return AGENT_METADATA[event.agent].icon;
  }
  return '📌';
}

function getEventColor(event: ActivityLogEntry): string {
  if (event.event_type.includes('error')) return '#ef4444';
  if (event.event_type.includes('completed')) return '#10b981';
  if (event.event_type.includes('paused')) return '#f59e0b';
  if (event.agent && AGENT_METADATA[event.agent]) {
    return AGENT_METADATA[event.agent].color;
  }
  return '#6b7280';
}

export function ActivityTimeline({ events, onEventClick }: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
        <div>No activity yet</div>
        <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Events will appear here as the workflow progresses
        </div>
      </div>
    );
  }

  // Group events by minute for cleaner display
  const groupedEvents: { timestamp: string; events: ActivityLogEntry[] }[] = [];
  let currentGroup: ActivityLogEntry[] = [];
  let currentMinute = '';

  events.forEach((event) => {
    const minute = event.timestamp.slice(0, 16); // YYYY-MM-DDTHH:mm
    if (minute !== currentMinute && currentGroup.length > 0) {
      groupedEvents.push({
        timestamp: currentGroup[0].timestamp,
        events: currentGroup
      });
      currentGroup = [];
    }
    currentMinute = minute;
    currentGroup.push(event);
  });

  if (currentGroup.length > 0) {
    groupedEvents.push({
      timestamp: currentGroup[0].timestamp,
      events: currentGroup
    });
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {groupedEvents.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* Time header */}
            <div
              style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginBottom: '0.5rem',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.025em'
              }}
            >
              {new Date(group.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>

            {/* Events in this group */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {group.events.map((event) => (
                <div
                  onClick={() => onEventClick?.(event)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'rgba(17, 24, 39, 0.5)',
                    border: '1px solid rgba(55, 65, 81, 0.5)',
                    cursor: onEventClick ? 'pointer' : 'default'
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '0.375rem',
                      backgroundColor: `${getEventColor(event)}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      flexShrink: 0
                    }}
                  >
                    {getEventIcon(event)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.25rem'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: getEventColor(event),
                          textTransform: 'uppercase',
                          letterSpacing: '0.025em'
                        }}
                      >
                        {event.event_type.replace(/_/g, ' ')}
                      </span>
                      {event.agent && (
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          • {AGENT_METADATA[event.agent]?.icon || '🤖'}{' '}
                          {event.agent.replace(/_/g, ' ')}
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 'auto' }}>
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>

                    {/* Message */}
                    {event.message && (
                      <div
                        style={{
                          fontSize: '0.875rem',
                          color: '#e5e7eb',
                          lineHeight: 1.5,
                          wordBreak: 'break-word'
                        }}
                      >
                        {event.message}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActivityTimeline;
