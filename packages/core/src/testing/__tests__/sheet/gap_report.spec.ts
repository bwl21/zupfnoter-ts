/* oxlint-disable jest/expect-expect -- report-style spec that writes the sheet gap markdown report */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it } from 'vitest'

import {
  getSheetFixtureTargets,
  loadFixture,
  scanFixtureCases,
  transformFixtureToSheet,
} from '../../fixtureLoader.js'
import { matchSheet, resolveSheetFixtureZnId } from '../../semanticMatch.js'
import {
  classifyFailures,
  pushFailureIfNeeded,
  renderStageReport,
  type DetectedFailureWithDetails,
} from '../../gapReporting.js'
import { getOpenImplementations } from '../../openImplementations.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MARKDOWN_REPORT_PATH = resolve(
  __dirname,
  '../../../../../../fixtures/reports/sheet-gap-report.md',
)
const REPRO_COMMAND = 'pnpm --filter @zupfnoter/core exec vitest run src/testing/__tests__/sheet/gap_report.spec.ts'

function collectSheetFailures(): DetectedFailureWithDetails[] {
  const failures: DetectedFailureWithDetails[] = []
  for (const testCase of scanFixtureCases().filter((fixture) => fixture.hasSheetFixture)) {
    const fixture = loadFixture(testCase)
    for (const target of getSheetFixtureTargets(fixture)) {
      const actual = transformFixtureToSheet(fixture, target.extractNr)
      const result = matchSheet(actual, target.expected)
      const znId = result.mismatches[0]?.path ? resolveSheetFixtureZnId(actual, result.mismatches[0].path) : undefined
      pushFailureIfNeeded(
        failures,
        { stage: 'sheet', fixtureId: testCase.id, extractNr: target.extractNr },
        result,
        znId,
      )
    }
  }
  return failures
}

describe('sheet gap report', () => {
  it('writes the sheet gap markdown report', () => {
    const entries = getOpenImplementations('sheet')
    const failures = collectSheetFailures()
    const { covered, uncovered } = classifyFailures(failures, entries)

    mkdirSync(dirname(MARKDOWN_REPORT_PATH), { recursive: true })
    writeFileSync(
      MARKDOWN_REPORT_PATH,
      renderStageReport({
        stageTitle: 'Sheet',
        stageKey: 'sheet',
        entries,
        covered,
        uncovered,
        reproCommand: REPRO_COMMAND,
      }),
      'utf-8',
    )

    console.log(
      `\n[sheet-gap-report] Open: ${entries.length}, covered failures: ${covered.length}, unclassified: ${uncovered.length}\nMarkdown: ${MARKDOWN_REPORT_PATH}\n`,
    )
  })
})
