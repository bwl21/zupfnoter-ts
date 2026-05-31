import { readIndex } from '../lib/store.js';

export async function listCommand(): Promise<void> {
  const index = await readIndex();
  if (index.tasks.length === 0) {
    console.log('No tasks yet.');
    return;
  }
  for (const task of index.tasks) {
    const marker = task.id === index.currentTask ? '*' : ' ';
    console.log(`${marker} ${task.id}  [${task.state}]  ${task.title}`);
  }
}
