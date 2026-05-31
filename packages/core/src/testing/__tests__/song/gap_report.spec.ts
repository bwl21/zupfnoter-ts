/* oxlint-disable jest/expect-expect -- report-style spec that writes the song parity reports */
import { describe, it } from 'vitest'

import { runSongParity } from '../../songParity.js'
import { scanFixtureCases } from '../../fixtureLoader.js'

function readSelectedSongCases(): string[] {
  const envCaseIds = process.env.SONG_PARITY_CASE_IDS
  if (typeof envCaseIds === 'string' && envCaseIds.trim().length > 0) {
    return envCaseIds
      .split(',')
      .map((caseId) => caseId.trim())
      .filter(Boolean)
  }

  const all = process.env.SONG_PARITY_ALL
  if (all === '0') return []

  return scanFixtureCases()
    .filter((testCase) => testCase.hasSongFixture)
    .map((testCase) => testCase.id)
}

describe('song gap report', () => {
  it('writes the song parity reports', () => {
    const summary = runSongParity(readSelectedSongCases())
    console.log(
      `\n[song-gap-report] Cases: ${summary.cases.length}, required gaps: ${summary.requiredGapCount}, warnings: ${summary.warningCount}\nMarkdown: fixtures/reports/song-gap-report.md\n`,
    )
  })
})
