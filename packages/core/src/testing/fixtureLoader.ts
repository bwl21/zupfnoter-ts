/**
 * Loads JSON fixtures from the fixtures/ directory at the repository root.
 *
 * In Vitest (Node environment) we use fs.readFileSync.
 * The path is resolved relative to the project root via import.meta.url.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Song } from '@zupfnoter/types'
import type { SongFixture, SheetFixture } from './semanticMatch.js'

// Resolve the repo root: packages/core/src/testing/ → ../../../../
const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../../..')

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

/**
 * Converts a Song domain object into the SongFixture format used for comparison.
 *
 * All entity types are included (Note, Pause, SynchPoint, MeasureStart, NewPart,
 * Goto, Chordsymbol, NoteBoundAnnotation). Fields not present on a given type
 * are omitted (not set to null).
 */
export function songToFixture(song: Song): SongFixture {
  return {
    meta_data: song.metaData as Record<string, unknown>,
    voices: song.voices.map((v) => ({
      entities: v.entities.map((e) => {
        const entry: Record<string, unknown> = {
          type: e.type,
          beat: e.beat,
          variant: e.variant,
          visible: e.visible,
        }
        if ('pitch' in e) entry['pitch'] = (e as { pitch: number }).pitch
        if ('duration' in e) entry['duration'] = (e as { duration: number }).duration
        return entry
      }),
    })),
    beat_maps: song.beatMaps.map((bm) =>
      Object.fromEntries(
        Object.entries(bm.entries).map(([k, v]) => [k, (v as { beat: number }).beat]),
      ),
    ),
  }
}
