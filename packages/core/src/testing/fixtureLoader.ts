/**
 * Loads JSON fixtures from the fixtures/ directory at the repository root.
 *
 * In Vitest (Node environment) we use fs.readFileSync.
 * The path is resolved relative to the project root via import.meta.url.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SongFixture, SheetFixture } from './semanticMatch.js'

// Resolve the repo root: packages/core/src/testing/ → ../../../../
const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../../../..')

function loadJson<T>(relativePath: string): T {
  const fullPath = resolve(REPO_ROOT, relativePath)
  const raw = readFileSync(fullPath, 'utf-8')
  return JSON.parse(raw) as T
}

export function loadSongFixture(name: string): SongFixture {
  return loadJson<SongFixture>(`fixtures/song/${name}.json`)
}

export function loadSheetFixture(name: string): SheetFixture {
  return loadJson<SheetFixture>(`fixtures/sheet/${name}.json`)
}
