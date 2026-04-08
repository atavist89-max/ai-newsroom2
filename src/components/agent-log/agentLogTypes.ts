/**
 * Agent Log Types
 * TypeScript definitions for the Agent Log feature
 */

/** Single activity log entry */
export interface ActivityLogEntry {
  timestamp: string;
  event_type: string;
  agent?: string | null;
  message?: string | null;
  data?: Record<string, unknown> | null;
}

/** Raw LLM output from an agent */
export interface AgentOutput {
  role: string;
  content: string;
  timestamp: string;
}

/** Artifact types stored by the workflow */
export type ArtifactType = 
  | 'selected_stories'
  | 'first_draft'
  | 'evaluation'
  | 'fact_check'
  | 'final_script';

/** Artifact metadata */
export interface Artifact {
  type: ArtifactType;
  label: string;
  description: string;
  icon: string;
  content: unknown;
  timestamp?: string;
}

/** Agent Log data for a workflow session */
export interface AgentLogData {
  sessionId: string;
  artifacts: Record<string, unknown>;
  artifactTypes: string[];
  activityLog: ActivityLogEntry[];
  totalEvents: number;
  agentOutputs: Record<string, AgentOutput[]>;
}

/** Props for AgentLog component */
export interface AgentLogProps {
  sessionId: string | null;
  isVisible: boolean;
  onClose: () => void;
}

/** Props for ActivityTimeline component */
export interface ActivityTimelineProps {
  events: ActivityLogEntry[];
  onEventClick?: (event: ActivityLogEntry) => void;
}

/** Props for ArtifactsGrid component */
export interface ArtifactsGridProps {
  artifacts: Record<string, unknown>;
  onArtifactClick?: (type: string, content: unknown) => void;
}

/** Props for RawOutputView component */
export interface RawOutputViewProps {
  agentOutputs: Record<string, AgentOutput[]>;
  selectedAgent?: string;
}

/** Props for ArtifactViewer component */
export interface ArtifactViewerProps {
  type: string;
  content: unknown;
  onClose: () => void;
}
