import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, exists, readText, writeFileSafe } from './fsx.js';
import { INDEX_FILE, TASK_DIR, taskPath } from './paths.js';
import type { TaskIndex, TaskIndexEntry, TaskState, TaskStatus } from './types.js';

export async function readIndex(): Promise<TaskIndex> {
  if (!await exists(INDEX_FILE)) return { tasks: [] };
  return JSON.parse(await readText(INDEX_FILE)) as TaskIndex;
}

export async function writeIndex(index: TaskIndex): Promise<void> {
  await ensureDir(path.dirname(INDEX_FILE));
  await fs.writeFile(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}

export async function getCurrentTaskId(): Promise<string> {
  const index = await readIndex();
  if (!index.currentTask) throw new Error('No current task. Use: pnpm ai-task new "topic" or pnpm ai-task switch <task-id>');
  return index.currentTask;
}

export async function setCurrentTask(taskId: string): Promise<void> {
  const index = await readIndex();
  if (!index.tasks.some(t => t.id === taskId)) throw new Error(`Unknown task: ${taskId}`);
  index.currentTask = taskId;
  await writeIndex(index);
}

export async function addTask(entry: TaskIndexEntry): Promise<void> {
  const index = await readIndex();
  if (index.tasks.some(t => t.id === entry.id)) throw new Error(`Task already exists: ${entry.id}`);
  index.tasks.push(entry);
  index.currentTask = entry.id;
  await writeIndex(index);
}

export async function updateTaskState(taskId: string, state: TaskState, currentArtifact?: string): Promise<void> {
  const index = await readIndex();
  const entry = index.tasks.find(t => t.id === taskId);
  if (!entry) throw new Error(`Unknown task: ${taskId}`);
  entry.state = state;
  entry.updatedAt = new Date().toISOString();
  await writeIndex(index);

  const statusFile = path.join(taskPath(taskId), 'status.json');
  const status = JSON.parse(await readText(statusFile)) as TaskStatus;
  status.state = state;
  status.updatedAt = entry.updatedAt;
  if (currentArtifact) status.currentArtifact = currentArtifact;
  await fs.writeFile(statusFile, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
}

export async function writeStatus(status: TaskStatus): Promise<void> {
  await writeFileSafe(path.join(taskPath(status.id), 'status.json'), JSON.stringify(status, null, 2), true);
}

export async function readStatus(taskId: string): Promise<TaskStatus> {
  return JSON.parse(await readText(path.join(taskPath(taskId), 'status.json'))) as TaskStatus;
}

export async function listTasks(): Promise<TaskIndexEntry[]> {
  const index = await readIndex();
  return index.tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
