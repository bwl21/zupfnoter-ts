/* oxlint-disable jest/valid-expect -- Vitest supports expect(val, msg) for failure messages */
/**
 * Song-level legacy comparison tests (Stufe 2: ABC -> Musikmodell).
 *
 * Each test:
 *   1. Loads an ABC fixture via the central fixture loader
 *   2. Runs the real AbcParser + AbcToSong pipeline with fixture config
 *   3. Compares the result against fixtures/cases/<name>/song.json
 *      using semantic matching (type, pitch, duration, beat, variant, visible)
 *
 * Fixtures must be populated from the legacy Ruby system before these tests pass.
 * See fixtures/README.md for export instructions.
 * A placeholder fixture (voices: []) causes the test to fail immediately.
 */
import { describe, it, expect } from 'vitest'

import { matchSong, formatMismatches } from '../../semanticMatch.js'
import { loadFixture, scanFixtureCases, transformFixtureToSong } from '../../fixtureLoader.js'
import { formatOpenImplementations, getOpenImplementations } from '../../openImplementations.js'

const SONG_FIXTURES = scanFixtureCases().filter((testCase) => testCase.hasSongFixture)

describe('Song fixtures', () => {
  for (const testCase of SONG_FIXTURES) {
    it(`matches legacy output: ${testCase.id}`, () => {
      const fixture = loadFixture(testCase)
      if (fixture.song === null) throw new Error(`Missing song fixture for ${testCase.id}`)
      const actual = transformFixtureToSong(fixture)
      const result = matchSong(actual, fixture.song)
      const openImplementations = getOpenImplementations('song')
      const knownGaps = formatOpenImplementations(openImplementations)
      const failureMessage = [formatMismatches(result), knownGaps].filter(Boolean).join('\n\n')
      expect(result.passed, failureMessage).toBe(true)
    })
  }
})
