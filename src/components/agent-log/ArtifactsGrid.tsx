/**
 * ArtifactsGrid Component
 * Displays all workflow artifacts (JSONs, Markdowns) in a grid
 */

interface ArtifactsGridProps {
  artifacts: Record<string, unknown>;
  onArtifactClick?: (type: string, content: unknown) => void;
}

// Artifact metadata for display
const ARTIFACT_METADATA: Record<string, { label: string; icon: string; color: string; description: string }> = {
  selected_stories: {
    label: 'Selected Stories',
    icon: '📰',
    color: '#3b82f6',
    description: 'Stories chosen for the podcast'
  },
  first_draft: {
    label: 'First Draft',
    icon: '📝',
    color: '#10b981',
    description: 'Initial script draft'
  },
  evaluation: {
    label: 'Editor Evaluation',
    icon: '✏️',
    color: '#8b5cf6',
    description: 'Editor review & feedback'
  },
  fact_check: {
    label: 'Fact Check',
    icon: '✅',
    color: '#f59e0b',
    description: 'Verification results'
  },
  final_script: {
    label: 'Final Script',
    icon: '📄',
    color: '#10b981',
    description: 'Approved final script'
  }
};

function getArtifactMetadata(type: string) {
  return (
    ARTIFACT_METADATA[type] || {
      label: type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      icon: '📄',
      color: '#6b7280',
      description: 'Workflow artifact'
    }
  );
}

function formatContentPreview(content: unknown): string {
  if (typeof content === 'string') {
    // For markdown content
    const lines = content.split('\n').filter((line) => line.trim());
    const preview = lines.slice(0, 3).join(' ');
    return preview.length > 100 ? preview.slice(0, 100) + '...' : preview;
  }
  if (typeof content === 'object' && content !== null) {
    // For JSON content
    const keys = Object.keys(content);
    if (keys.length === 0) return 'Empty object';
    if (Array.isArray(content)) {
      return `Array with ${content.length} items`;
    }
    return `Object with keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`;
  }
  return String(content).slice(0, 100);
}

function getContentSize(content: unknown): string {
  const json = JSON.stringify(content);
  const bytes = new Blob([json]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getContentType(type: string, content: unknown): string {
  if (type.includes('draft') || type.includes('script')) {
    return 'text/markdown';
  }
  if (typeof content === 'object') {
    return 'application/json';
  }
  return 'text/plain';
}

export function ArtifactsGrid({ artifacts, onArtifactClick }: ArtifactsGridProps) {
  const artifactEntries = Object.entries(artifacts);

  if (artifactEntries.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📦</div>
        <div>No artifacts yet</div>
        <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Artifacts will appear here as agents complete their tasks
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem'
        }}
      >
        {artifactEntries.map(([type, content]) => {
          const meta = getArtifactMetadata(type);
          const contentType = getContentType(type, content);

          return (
            <div
              key={type}
              onClick={() => onArtifactClick?.(type, content)}
              style={{
                padding: '1rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(17, 24, 39, 0.6)',
                border: '1px solid rgba(55, 65, 81, 0.5)',
                cursor: onArtifactClick ? 'pointer' : 'default'
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '0.75rem'
                }}
              >
                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '0.5rem',
                    backgroundColor: `${meta.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem'
                  }}
                >
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#e5e7eb',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {meta.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{meta.description}</div>
                </div>
              </div>

              {/* Content preview */}
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  fontFamily: 'monospace',
                  lineHeight: 1.5,
                  minHeight: '3rem',
                  maxHeight: '4.5rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {formatContentPreview(content)}
              </div>

              {/* Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(55, 65, 81, 0.5)'
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    backgroundColor: `${meta.color}20`,
                    color: meta.color
                  }}
                >
                  {contentType.split('/')[1].toUpperCase()}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{getContentSize(content)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ArtifactsGrid;
