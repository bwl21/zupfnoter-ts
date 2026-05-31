import { setCurrentTask } from '../lib/store.js';

export async function switchCommand(args: string[]): Promise<void> {
  const id = args[0];
  if (!id) throw new Error('Usage: pnpm ai-task switch <task-id>');
  await setCurrentTask(id);
  console.log(`Current task: ${id}`);
}
