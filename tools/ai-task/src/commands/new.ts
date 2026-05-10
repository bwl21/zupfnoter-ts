import path from 'node:path';
import { addTask, writeStatus } from '../lib/store.js';
import { ensureDir, writeFileSafe } from '../lib/fsx.js';
import { taskPath } from '../lib/paths.js';
import { slugify } from '../lib/slugify.js';
import type { TaskIndexEntry, TaskStatus } from '../lib/types.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function newCommand(titleParts: string[]): Promise<void> {
  const title = titleParts.join(' ').trim();
  if (!title) throw new Error('Usage: pnpm ai-task new "topic"');
  const now = new Date().toISOString();
  const id = `${today()}-${slugify(title)}`;
  const dir = taskPath(id);
  await ensureDir(dir);

  const entry: TaskIndexEntry = { id, title, state: 'topic', createdAt: now, updatedAt: now };
  const status: TaskStatus = { ...entry, currentArtifact: 'topic.md', notes: [] };

  await writeFileSafe(path.join(dir, 'topic.md'), `# Topic\n\n${title}\n\n## Goal\n\nNoch offen.\n\n## Notes\n\nNoch offen.\n`, false);
  await writeFileSafe(path.join(dir, 'notes.md'), `# Notes\n\n`, false);
  await writeStatus(status);
  await addTask(entry);
  console.log(`Created and activated task: ${id}`);
}
