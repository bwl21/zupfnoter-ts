export type TaskState =
  | 'topic'
  | 'analysis'
  | 'strategy'
  | 'codex'
  | 'review'
  | 'done'
  | 'blocked';

export interface TaskIndexEntry {
  id: string;
  title: string;
  state: TaskState;
  createdAt: string;
  updatedAt: string;
}

export interface TaskIndex {
  currentTask?: string;
  tasks: TaskIndexEntry[];
}

export interface TaskStatus extends TaskIndexEntry {
  currentArtifact?: string;
  notes?: string[];
}

export type ArtifactKey =
  | 'topic'
  | 'analysis-prompt'
  | 'analysis-result'
  | 'strategy-prompt'
  | 'strategy-result'
  | 'codex-prompt'
  | 'codex-result'
  | 'review-prompt'
  | 'review-result'
  | 'diff'
  | 'notes';
