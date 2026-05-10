import { getCurrentTaskId, updateTaskState } from '../lib/store.js';

export async function doneCommand(): Promise<void> {
  const taskId = await getCurrentTaskId();
  await updateTaskState(taskId, 'done');
  console.log(`Marked done: ${taskId}`);
}
