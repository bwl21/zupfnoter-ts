import { readIndex } from '../lib/store.js';

export async function currentCommand(): Promise<void> {
  const index = await readIndex();
  console.log(index.currentTask ?? 'No current task.');
}
