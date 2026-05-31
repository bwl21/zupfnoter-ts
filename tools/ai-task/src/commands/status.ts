import { getCurrentTaskId, readStatus } from '../lib/store.js';

export async function statusCommand(): Promise<void> {
  const taskId = await getCurrentTaskId();
  const status = await readStatus(taskId);
  console.log(JSON.stringify(status, null, 2));
}
