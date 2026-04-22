/**
 * Song-level legacy comparison tests (Stufe 2: ABC → Musikmodell).
 *
 * Each test:
 *   1. Reads an ABC fixture from fixtures/abc/
 *   2. Runs the real AbcParser + AbcToSong pipeline
 *   3. Compares the result against the JSON fixture in fixtures/song/
 *      using semantic matching (type, pitch, duration, beat, variant, visible)
 *
 * Fixtures must be populated from the legacy Ruby system before these tests pass.
 * See fixtures/README.md for export instructions.
 * A placeholder fixture (voices: []) causes the test to fail immediately.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { AbcParser } from '../../../AbcParser.js'
import { AbcToSong } from '../../../AbcToSong.js'
import { matchSong, formatMismatches } from '../../semanticMatch.js'
import { loadSongFixture, songToFixture } from '../../fixtureLoader.js'
import { defaultTestConfig } from '../../defaultConfig.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../../../../..')

function readAbc(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf-8')
}

function transformAbcToSong(abcText: string) {
  const parser = new AbcParser()
  const model = parser.parse(abcText)
  const transformer = new AbcToSong()
  const song = transformer.transform(model, defaultTestConfig)
  return songToFixture(song)
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
