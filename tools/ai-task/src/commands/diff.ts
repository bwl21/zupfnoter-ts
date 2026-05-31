import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { artifactFile } from '../lib/artifacts.js';
import { writeFileSafe } from '../lib/fsx.js';
import { taskPath } from '../lib/paths.js';
import { getCurrentTaskId, updateTaskState } from '../lib/store.js';

export async function diffCommand(args: string[]): Promise<void> {
  const overwrite = args.includes('--overwrite');
  const taskId = await getCurrentTaskId();
  const dir = taskPath(taskId);
  const diff = execFileSync('git', ['diff'], { encoding: 'utf8' });
  const status = execFileSync('git', ['status', '--short'], { encoding: 'utf8' });
  await writeFileSafe(path.join(dir, artifactFile('diff')), diff || '# git diff is empty\n', overwrite);
  await writeFileSafe(path.join(dir, 'git-status.txt'), status || '# git status is clean\n', true);
  await updateTaskState(taskId, 'review', artifactFile('diff'));
  console.log(path.join(dir, artifactFile('diff')));
}
