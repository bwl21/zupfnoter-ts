/* oxlint-disable jest/expect-expect -- dev helper: tests write files, no assertions needed */
/**
 * Dumps the TS pipeline output for all fixture cases to fixtures/cases/<area>/<name>/_ts_output/.
 *
 * Development helper — not a regression test.
 * Run once to see what the TS pipeline currently produces:
 *
 *   cd packages/core
 *   npx vitest run --reporter=verbose src/testing/__tests__/sheet/dump_ts_output.spec.ts
 *
 * Output: fixtures/cases/<area>/<name>/_ts_output/sheet.extract-<nr>.json
 * Compare with the legacy Ruby export to identify discrepancies before populating
 * the real fixtures in fixtures/cases/<area>/<name>/sheet.extract-0.json.
 */
import { describe, it } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  getSheetFixtureTargets,
  loadFixture,
  scanFixtureCases,
  transformFixtureToSheet,
} from '../../fixtureLoader.js'
import type { FixtureCase } from '../../fixtureLoader.js'

function dump(testCase: FixtureCase) {
  const fixture = loadFixture(testCase)
  const targets = getSheetFixtureTargets(fixture)
  const effectiveTargets = targets.length > 0 ? targets : [{ extractNr: 0 }]
  const outputDir = resolve(fixture.dir, '_ts_output')
  mkdirSync(outputDir, { recursive: true })
  const legacyOutputPath = resolve(outputDir, 'sheet.json')
  if (existsSync(legacyOutputPath)) rmSync(legacyOutputPath)

  for (const target of effectiveTargets) {
    const content = `${JSON.stringify(transformFixtureToSheet(fixture, target.extractNr), null, 2)}\n`
    const filename = resolve(outputDir, `sheet.extract-${target.extractNr}.json`)
    writeFileSync(filename, content, 'utf-8')
    console.log(`Written: ${testCase.id}/_ts_output/sheet.extract-${target.extractNr}.json`)
  }
}

describe('dump TS sheet output (dev helper)', () => {
  for (const testCase of scanFixtureCases()) {
    it(`writes ${testCase.id}`, () => dump(testCase))
  }
})
