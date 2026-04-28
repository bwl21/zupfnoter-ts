/* oxlint-disable jest/valid-expect -- Vitest supports expect(val, msg) for failure messages */
/**
 * Sheet-level legacy comparison tests (Stufe 3: Song -> Drawing-Modell).
 *
 * Each test:
 *   1. Loads an ABC fixture via the central fixture loader
 *   2. Runs the TS pipeline: AbcParser -> AbcToSong -> HarpnotesLayout
 *   3. Compares the Sheet against fixtures/cases/<name>/sheet.json
 *      using semantic matching (positions +/-0.1 mm, sizes +/-0.05 mm)
 *
 * Fixtures must be populated from the legacy Ruby system before these tests pass.
 * See fixtures/README.md for export instructions.
 */
import { describe, it, expect } from 'vitest'

import { matchSheet, formatMismatches } from '../../semanticMatch.js'
import { getSheetFixtureTargets, loadFixture, scanFixtureCases, transformFixtureToSheet } from '../../fixtureLoader.js'
import { formatOpenImplementations, getOpenImplementations } from '../../../../../../fixtures/openImplementations.js'

const SHEET_FIXTURES = scanFixtureCases().filter((testCase) => testCase.hasSheetFixture)

describe('Sheet fixtures', () => {
  for (const testCase of SHEET_FIXTURES) {
    const fixture = loadFixture(testCase)
    const targets = getSheetFixtureTargets(fixture)

    for (const target of targets) {
      it(`matches legacy output: ${testCase.id} [extract ${target.extractNr}]`, () => {
        const actual = transformFixtureToSheet(fixture, target.extractNr)
        const result = matchSheet(actual, target.expected)
        const openImplementations = getOpenImplementations('sheet')
        const knownGaps = formatOpenImplementations(openImplementations)
        const failureMessage = [formatMismatches(result), knownGaps].filter(Boolean).join('\n\n')
        expect(result.passed, failureMessage).toBe(true)
      })
    }

    if (targets.length === 0) {
      it(`matches legacy output: ${testCase.id}`, () => {
        throw new Error(`Missing sheet fixture for ${testCase.id}`)
      })
    }
  }
})
