import path from 'node:path';
import { ARTIFACTS } from '../lib/artifacts.js';
import { exists } from '../lib/fsx.js';
import { taskPath } from '../lib/paths.js';
import { getCurrentTaskId, readStatus } from '../lib/store.js';
import type { ArtifactKey } from '../lib/types.js';

const sequence: Array<{ need?: ArtifactKey; suggest: string; reason: string }> = [
  { need: 'analysis-prompt', suggest: 'pnpm ai-task prompt analysis', reason: 'Analyse-Prompt fehlt.' },
  { need: 'analysis-result', suggest: 'pnpm ai-task save analysis-result --edit', reason: 'Analyse-Ergebnis fehlt.' },
  { need: 'strategy-prompt', suggest: 'pnpm ai-task prompt strategy', reason: 'Strategie-Prompt fehlt.' },
  { need: 'strategy-result', suggest: 'pnpm ai-task save strategy-result --edit', reason: 'Strategie-Ergebnis fehlt.' },
  { need: 'codex-prompt', suggest: 'pnpm ai-task prompt codex', reason: 'Codex-Prompt fehlt.' },
  { need: 'codex-result', suggest: 'pnpm ai-task save codex-result --edit', reason: 'Codex-Ergebnis fehlt.' },
  { need: 'diff', suggest: 'pnpm ai-task diff', reason: 'Diff fehlt.' },
  { need: 'review-prompt', suggest: 'pnpm ai-task prompt review', reason: 'Review-Prompt fehlt.' },
  { need: 'review-result', suggest: 'pnpm ai-task save review-result --edit', reason: 'Review-Ergebnis fehlt.' }
];

export async function nextCommand(): Promise<void> {
  const taskId = await getCurrentTaskId();
  const status = await readStatus(taskId);
  const root = taskPath(taskId);
  for (const step of sequence) {
    if (step.need && !await exists(path.join(root, ARTIFACTS[step.need]))) {
      console.log(`Current task: ${taskId}`);
      console.log(`State: ${status.state}`);
      console.log(`Missing: ${ARTIFACTS[step.need]}`);
      console.log(`Next: ${step.suggest}`);
      console.log(`Reason: ${step.reason}`);
      return;
    }
  }
  console.log(`Current task: ${taskId}`);
  console.log('All standard artifacts exist. Suggested next step: review manually, commit, or mark done.');
}
