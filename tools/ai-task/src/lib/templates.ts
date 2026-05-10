import path from 'node:path';
import { artifactFile } from './artifacts.js';
import { exists, readText } from './fsx.js';
import { TEMPLATE_DIR, taskPath } from './paths.js';

export type PromptKind = 'analysis' | 'strategy' | 'codex' | 'review';

const templateFiles: Record<PromptKind, string> = {
  analysis: 'analysis-prompt.md',
  strategy: 'strategy-prompt.md',
  codex: 'codex-prompt.md',
  review: 'review-prompt.md'
};

export const outputArtifact: Record<PromptKind, ReturnType<typeof artifactFile>> = {
  analysis: artifactFile('analysis-prompt'),
  strategy: artifactFile('strategy-prompt'),
  codex: artifactFile('codex-prompt'),
  review: artifactFile('review-prompt')
};

async function optional(file: string): Promise<string> {
  return await exists(file) ? await readText(file) : '';
}

export async function renderPrompt(kind: PromptKind, taskId: string): Promise<string> {
  const template = await readText(path.join(TEMPLATE_DIR, templateFiles[kind]));
  const root = taskPath(taskId);
  const values: Record<string, string> = {
    TOPIC: await optional(path.join(root, artifactFile('topic'))),
    ANALYSIS_RESULT: await optional(path.join(root, artifactFile('analysis-result'))),
    STRATEGY_RESULT: await optional(path.join(root, artifactFile('strategy-result'))),
    CODEX_PROMPT: await optional(path.join(root, artifactFile('codex-prompt'))),
    DIFF: await optional(path.join(root, artifactFile('diff'))),
    NOTES: await optional(path.join(root, artifactFile('notes')))
  };

  return template.replace(/{{\s*([A-Z_]+)\s*}}/g, (_, key: string) => values[key] ?? '');
}
