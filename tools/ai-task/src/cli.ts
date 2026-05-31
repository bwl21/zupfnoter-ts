#!/usr/bin/env node
import { initCommand } from './commands/init.js';
import { newCommand } from './commands/new.js';
import { promptCommand } from './commands/prompt.js';
import { saveCommand } from './commands/save.js';
import { diffCommand } from './commands/diff.js';
import { listCommand } from './commands/list.js';
import { currentCommand } from './commands/current.js';
import { switchCommand } from './commands/switch.js';
import { statusCommand } from './commands/status.js';
import { nextCommand } from './commands/next.js';
import { doneCommand } from './commands/done.js';

function help(): void {
  console.log(`ai-task

Usage:
  pnpm ai-task init
  pnpm ai-task new "topic"
  pnpm ai-task list
  pnpm ai-task current
  pnpm ai-task switch <task-id>
  pnpm ai-task status
  pnpm ai-task next
  pnpm ai-task prompt <analysis|strategy|codex|review> [--overwrite]
  pnpm ai-task save <artifact-key> [file|--stdin|--edit] [--overwrite]
  pnpm ai-task diff [--overwrite]
  pnpm ai-task done

Artifact keys:
  analysis-result, strategy-result, codex-result, review-result, notes
`);
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;
  switch (command) {
    case 'init': return initCommand();
    case 'new': return newCommand(args);
    case 'prompt': return promptCommand(args);
    case 'save': return saveCommand(args);
    case 'diff': return diffCommand(args);
    case 'list': return listCommand();
    case 'current': return currentCommand();
    case 'switch': return switchCommand(args);
    case 'status': return statusCommand();
    case 'next': return nextCommand();
    case 'done': return doneCommand();
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      help();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ai-task: ${message}`);
  process.exitCode = 1;
});
