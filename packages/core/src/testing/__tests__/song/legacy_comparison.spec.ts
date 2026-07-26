/* oxlint-disable jest/valid-expect -- Vitest supports expect(val, msg) for failure messages */
/**
 * Song-level legacy comparison tests (Stufe 2: ABC -> Musikmodell).
 *
 * Each test:
 *   1. Loads an ABC fixture via the central fixture loader
 *   2. Runs the real AbcParser + AbcToSong pipeline with fixture config
 *   3. Compares the result against fixtures/cases/<area>/<name>/song.legacy-raw.json
 *      (the raw `@music_model.to_json` dump from the legacy CLI) using
 *      semantic matching after `normalizeRawSongFixture` rewrites the raw
 *      shape into the SongFixture shape consumed by `matchSong`.
 *
 * Fixtures must be populated from the legacy Ruby system before these tests pass.
 * See fixtures/README.md for export instructions.
 */
import { describe, it, expect } from 'vitest'

import { matchSong, formatMismatches, normalizeRawSongFixture } from '../../semanticMatch.js'
import { loadFixture, loadFixtureParity, scanFixtureCases, transformFixtureToSong } from '../../fixtureLoader.js'
import { formatOpenImplementations, getOpenImplementations } from '../../openImplementations.js'

const SONG_FIXTURES = scanFixtureCases().filter((testCase) => testCase.hasSongFixture)

describe('Song fixtures', () => {
  for (const testCase of SONG_FIXTURES) {
    it(`matches legacy output: ${testCase.id}`, async () => {
      const fixture = loadFixture(testCase)
      if (fixture.song === null) throw new Error(`Missing song fixture for ${testCase.id}`)
      const actual = transformFixtureToSong(fixture)
      const expected = normalizeRawSongFixture(fixture.song)
      const parity = await loadFixtureParity(testCase.id)
      const result = matchSong(actual, expected, {
        ignoredEntityFields: new Set(parity?.ignoreSongEntityFields ?? []),
      })
      parity?.assertSong?.({ actual, expected, abcText: fixture.input.abc, match: result })
      const openImplementations = getOpenImplementations('song')
      const knownGaps = formatOpenImplementations(openImplementations)
      const failureMessage = [formatMismatches(result), knownGaps].filter(Boolean).join('\n\n')
      expect(result.passed, failureMessage).toBe(true)
    })
  }
})
