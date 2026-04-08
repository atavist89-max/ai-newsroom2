/**
 * ArtifactViewer Component
 * Modal/Panel for viewing artifact content in detail
 */

import { useState } from 'react';

interface ArtifactViewerProps {
  type: string;
  content: unknown;
  onClose: () => void;
}

// Artifact metadata for display
const ARTIFACT_METADATA: Record<string, { label: string; icon: string; color: string }> = {
  selected_stories: { label: 'Selected Stories', icon: '📰', color: '#3b82f6' },
  first_draft: { label: 'First Draft', icon: '📝', color: '#10b981' },
  evaluation: { label: 'Editor Evaluation', icon: '✏️', color: '#8b5cf6' },
  fact_check: { label: 'Fact Check', icon: '✅', color: '#f59e0b' },
  final_script: { label: 'Final Script', icon: '📄', color: '#10b981' }
};

function getArtifactMetadata(type: string) {
  return (
    ARTIFACT_METADATA[type] || {
      label: type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      icon: '📄',
      color: '#6b7280'
    }
  );
}

function isMarkdown(type: string): boolean {
  return type.includes('draft') || type.includes('script');
}

function formatContent(content: unknown, type: string): string {
  if (isMarkdown(type) && typeof content === 'string') {
    return content;
  }
  return JSON.stringify(content, null, 2);
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function ArtifactViewer({ type, content, onClose }: ArtifactViewerProps) {
  const [copied, setCopied] = useState(false);
  const meta = getArtifactMetadata(type);
  const formattedContent = formatContent(content, type);

  const handleCopy = async () => {
    await copyToClipboard(formattedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          backgroundColor: '#111827',
          borderRadius: '0.75rem',
          border: '1px solid rgba(55, 65, 81, 0.8)',
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
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(55, 65, 81, 0.5)',
            backgroundColor: 'rgba(17, 24, 39, 0.8)'
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
          <div style={{ flex: 1 }}>
            <div
              style={{ fontSize: '1rem', fontWeight: 600, color: '#e5e7eb' }}
            >
              {meta.label}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {isMarkdown(type) ? 'Markdown' : 'JSON'}
            </div>
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid rgba(55, 65, 81, 0.8)',
              backgroundColor: copied ? '#10b981' : 'transparent',
              color: copied ? '#fff' : '#9ca3af',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>

          {/* Close button */}
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
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '1.25rem',
            backgroundColor: '#0d1117'
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: '0.875rem',
              lineHeight: 1.6,
              color: '#e5e7eb',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            <code>{formattedContent}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

export default ArtifactViewer;
