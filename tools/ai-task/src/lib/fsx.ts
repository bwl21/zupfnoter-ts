import fs from 'node:fs/promises';
import path from 'node:path';

export async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeFileSafe(file: string, content: string, overwrite = false): Promise<void> {
  await ensureDir(path.dirname(file));
  if (!overwrite && await exists(file)) {
    throw new Error(`File already exists: ${file}`);
  }
  await fs.writeFile(file, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

export async function readText(file: string): Promise<string> {
  return fs.readFile(file, 'utf8');
}
