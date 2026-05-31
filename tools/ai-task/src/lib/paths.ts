import path from 'node:path';

export const AI_ROOT = path.join('docs', 'ai');
export const TEMPLATE_DIR = path.join(AI_ROOT, 'templates');
export const TASK_DIR = path.join(AI_ROOT, 'tasks');
export const INDEX_FILE = path.join(TASK_DIR, 'index.json');

export function taskPath(taskId: string): string {
  return path.join(TASK_DIR, taskId);
}
