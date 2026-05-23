/* oxlint-disable jest/expect-expect -- report-style spec that writes the song gap markdown report */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it } from 'vitest'

import { loadFixture, scanFixtureCases, transformFixtureToSong } from '../../fixtureLoader.js'
import { matchSong, normalizeRawSongFixture } from '../../semanticMatch.js'
import {
  classifyFailures,
  pushFailureIfNeeded,
  renderStageReport,
  type DetectedFailureWithDetails,
} from '../../gapReporting.js'
import { getOpenImplementations } from '../../../../../../fixtures/openImplementations.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MARKDOWN_REPORT_PATH = resolve(
  __dirname,
  '../../../../../../fixtures/reports/song-gap-report.md',
)
const REPRO_COMMAND = 'pnpm --filter @zupfnoter/core exec vitest run src/testing/__tests__/song/gap_report.spec.ts'

function collectSongFailures(): DetectedFailureWithDetails[] {
  const failures: DetectedFailureWithDetails[] = []
  for (const testCase of scanFixtureCases().filter((fixture) => fixture.hasSongFixture)) {
    const fixture = loadFixture(testCase)
    if (fixture.song === null) continue
    const actual = transformFixtureToSong(fixture)
    const result = matchSong(actual, normalizeRawSongFixture(fixture.song))
    pushFailureIfNeeded(failures, { stage: 'song', fixtureId: testCase.id }, result)
  }
  return failures
}

describe('song gap report', () => {
  it('writes the song gap markdown report', () => {
    const entries = getOpenImplementations('song')
    const failures = collectSongFailures()
    const { covered, uncovered } = classifyFailures(failures, entries)

    mkdirSync(dirname(MARKDOWN_REPORT_PATH), { recursive: true })
    writeFileSync(
      MARKDOWN_REPORT_PATH,
      renderStageReport({
        stageTitle: 'Song',
        stageKey: 'song',
        entries,
        covered,
        uncovered,
        reproCommand: REPRO_COMMAND,
      }),
      'utf-8',
    )

    console.log(
      `\n[song-gap-report] Open: ${entries.length}, covered failures: ${covered.length}, unclassified: ${uncovered.length}\nMarkdown: ${MARKDOWN_REPORT_PATH}\n`,
    )
  })
})
