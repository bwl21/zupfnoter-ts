import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { artifactFile } from '../lib/artifacts.js';
import { exists, writeFileSafe } from '../lib/fsx.js';
import { taskPath } from '../lib/paths.js';
import { getCurrentTaskId, updateTaskState } from '../lib/store.js';
import type { ArtifactKey, TaskState } from '../lib/types.js';

const stateByArtifact: Partial<Record<ArtifactKey, TaskState>> = {
  'analysis-result': 'strategy',
  'strategy-result': 'codex',
  'codex-result': 'review',
  'review-result': 'review'
};

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export async function saveCommand(args: string[]): Promise<void> {
  const key = args[0] as ArtifactKey | undefined;
  if (!key) throw new Error('Usage: pnpm ai-task save <artifact-key> [file|--stdin|--edit] [--overwrite]');
  const overwrite = args.includes('--overwrite');
  const useStdin = args.includes('--stdin');
  const useEdit = args.includes('--edit') || (!useStdin && args.length === 1);
  const sourceFile = args.find(a => !a.startsWith('--') && a !== key);

  const taskId = await getCurrentTaskId();
  const dest = path.join(taskPath(taskId), artifactFile(key));

  if (useStdin) {
    await writeFileSafe(dest, await readStdin(), overwrite);
  } else if (sourceFile) {
    await writeFileSafe(dest, await fs.readFile(sourceFile, 'utf8'), overwrite);
  } else if (useEdit) {
    if (!await exists(dest)) await writeFileSafe(dest, `# ${key}\n\n`, false);
    const editor = process.env.EDITOR || 'vi';
    spawnSync(editor, [dest], { stdio: 'inherit' });
  }

  await updateTaskState(taskId, stateByArtifact[key] ?? 'topic', path.basename(dest));
  console.log(dest);
}
