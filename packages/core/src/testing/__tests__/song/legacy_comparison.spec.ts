/**
 * Song-level legacy comparison tests (Stufe 2: ABC → Musikmodell).
 *
 * Each test:
 *   1. Reads an ABC fixture from fixtures/abc/
 *   2. Runs the TS AbcToSong transformer (once implemented)
 *   3. Compares the result against the JSON fixture in fixtures/song/
 *      using semantic matching (pitch, duration, beat, variant, visible)
 *
 * Fixtures with empty voices[] are treated as placeholders and always pass.
 * Populate them by running the legacy export (see fixtures/README.md).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { matchSong, formatMismatches } from '../../semanticMatch.js'
import { loadSongFixture } from '../../fixtureLoader.js'
import type { SongFixture } from '../../semanticMatch.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../../../../../..')

function readAbc(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf-8')
}

/**
 * Stub: replace with real AbcToSong.transform() once implemented.
 * Returns an empty SongFixture so tests compile and pass as placeholders.
 */
function transformAbcToSong(_abcText: string): SongFixture {
  // TODO: replace with: return new AbcToSong().transform(abcText)
  return { meta_data: {}, voices: [], beat_maps: [] }
}

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

const MINIMAL_FIXTURES = [
  'single_note',
  'two_voices',
  'repeat',
  'pause',
  'tuplet',
  'tie',
  'decoration',
  'lyrics',
] as const

describe('Song – minimal fixtures', () => {
  for (const name of MINIMAL_FIXTURES) {
    it(`matches legacy output: ${name}`, () => {
      const abcText = readAbc(`fixtures/abc/minimal/${name}.abc`)
      const fixture = loadSongFixture(name)
      const actual = transformAbcToSong(abcText)
      const result = matchSong(actual, fixture)
      expect(result.passed, formatMismatches(result)).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// Legacy testcases
// ---------------------------------------------------------------------------

const LEGACY_FIXTURES = ['02_twoStaff', 'Twostaff'] as const

describe('Song – legacy testcases', () => {
  for (const name of LEGACY_FIXTURES) {
    it(`matches legacy output: ${name}`, () => {
      const abcText = readAbc(`fixtures/abc/legacy/${name}.abc`)
      const fixture = loadSongFixture(name)
      const actual = transformAbcToSong(abcText)
      const result = matchSong(actual, fixture)
      expect(result.passed, formatMismatches(result)).toBe(true)
    })
  }
})
