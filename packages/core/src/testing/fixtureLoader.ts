/**
 * Loads JSON fixtures from the fixtures/ directory at the repository root.
 *
 * In Vitest (Node environment) we use fs.readFileSync.
 * The path is resolved relative to the project root via import.meta.url.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Song, Sheet } from '@zupfnoter/types'
import type { SongFixture, SheetFixture, DrawableFixture } from './semanticMatch.js'

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

/**
 * Converts a Sheet domain object into the SheetFixture format used for comparison.
 *
 * Only fields relevant for semantic comparison are included.
 * Excluded: confKey, lineWidth, origin, draginfo, visible (invisible elements filtered out).
 */
export function sheetToFixture(sheet: Sheet): SheetFixture {
  return {
    children: sheet.children
      .filter((c) => c.visible !== false)
      .map((c): DrawableFixture => {
        const entry: DrawableFixture = { type: c.type }
        if ('center'    in c && c.center    !== undefined) entry.center    = c.center
        if ('size'      in c && c.size      !== undefined) entry.size      = c.size
        if ('fill'      in c && c.fill      !== undefined) entry.fill      = c.fill as DrawableFixture['fill']
        if ('from'      in c && c.from      !== undefined) entry.from      = c.from
        if ('to'        in c && c.to        !== undefined) entry.to        = c.to
        if ('style'     in c && c.style     !== undefined) entry.style     = c.style
        if ('glyphName' in c && c.glyphName !== undefined) entry.glyphName = c.glyphName
        if ('text'      in c && c.text      !== undefined) entry.text      = c.text
        if ('color'     in c && c.color     !== undefined) entry.color     = c.color
        return entry
      }),
  }
}
