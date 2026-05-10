import type { ArtifactKey } from './types.js';

export const ARTIFACTS: Record<ArtifactKey, string> = {
  topic: 'topic.md',
  'analysis-prompt': '01-analysis-prompt.md',
  'analysis-result': '02-analysis-result.md',
  'strategy-prompt': '03-strategy-prompt.md',
  'strategy-result': '04-strategy-result.md',
  'codex-prompt': '05-codex-prompt.md',
  'codex-result': '06-codex-result.md',
  'review-prompt': '07-review-prompt.md',
  'review-result': '08-review-result.md',
  diff: 'diff.patch',
  notes: 'notes.md'
};

export function artifactFile(key: ArtifactKey): string {
  const file = ARTIFACTS[key];
  if (!file) throw new Error(`Unknown artifact key: ${key}`);
  return file;
}
