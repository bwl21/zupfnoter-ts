import path from 'node:path';
import { artifactFile } from '../lib/artifacts.js';
import { writeFileSafe } from '../lib/fsx.js';
import { taskPath } from '../lib/paths.js';
import { getCurrentTaskId, updateTaskState } from '../lib/store.js';
import { outputArtifact, renderPrompt, type PromptKind } from '../lib/templates.js';
import type { TaskState } from '../lib/types.js';

const stateByKind: Record<PromptKind, TaskState> = {
  analysis: 'analysis',
  strategy: 'strategy',
  codex: 'codex',
  review: 'review'
};

export async function promptCommand(args: string[]): Promise<void> {
  const kind = args[0] as PromptKind | undefined;
  if (!kind || !['analysis', 'strategy', 'codex', 'review'].includes(kind)) {
    throw new Error('Usage: pnpm ai-task prompt <analysis|strategy|codex|review>');
  }
  const overwrite = args.includes('--overwrite');
  const taskId = await getCurrentTaskId();
  const content = await renderPrompt(kind, taskId);
  const file = path.join(taskPath(taskId), outputArtifact[kind]);
  await writeFileSafe(file, content, overwrite);
  await updateTaskState(taskId, stateByKind[kind], path.basename(file));
  console.log(file);
}
