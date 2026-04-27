/* oxlint-disable jest/expect-expect -- dev helper: tests write files, no assertions needed */
/**
 * Dumps the TS pipeline output for all fixture cases to fixtures/cases/<name>/_ts_output/.
 *
 * Development helper — not a regression test.
 * Run once to see what the TS pipeline currently produces:
 *
 *   cd packages/core
 *   npx vitest run --reporter=verbose src/testing/__tests__/song/dump_ts_output.spec.ts
 *
 * Output: fixtures/cases/<name>/_ts_output/song.json
 * Compare with the legacy Ruby export to identify discrepancies before populating
 * the real fixtures in fixtures/cases/<name>/song.json.
 */
import { describe, it } from 'vitest'

import { loadFixture, saveFixtureOutput, scanFixtureCases, transformFixtureToSong } from '../../fixtureLoader.js'
import type { FixtureCase } from '../../fixtureLoader.js'

function dump(testCase: FixtureCase) {
  const fixture = loadFixture(testCase)
  saveFixtureOutput(fixture, 'song', transformFixtureToSong(fixture))
  console.log(`Written: ${testCase.id}/_ts_output/song.json`)
}

describe('dump TS song output (dev helper)', () => {
  for (const testCase of scanFixtureCases()) {
    it(`writes ${testCase.id}`, () => dump(testCase))
  }
})
