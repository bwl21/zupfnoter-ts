/* oxlint-disable jest/expect-expect -- comparison workbench that writes reports instead of asserting exact equality */
import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'

import {
  getOutputSvgFixtureTargets,
  loadFixture,
  scanFixtureCases,
  transformFixtureToSvg,
} from '../../fixtureLoader.js'
import { compareSvgFixtures, type SvgComparisonSummary } from '../../svgComparison.js'

const SVG_ARTIFACT_ROOT = resolve('/private/tmp/zupfnoter-svg-artifacts', '3015_reference_sheet')

function compareFocusedFixtures() {
  const summaries: SvgComparisonSummary[] = []
  const cases = scanFixtureCases()
    .filter((testCase) => testCase.hasOutputSvgFixture)
    .filter((testCase) => testCase.id === '3015_reference_sheet')

  for (const testCase of cases) {
    const fixture = loadFixture(testCase)
    const target = getOutputSvgFixtureTargets(fixture).find((entry) => entry.extractNr === 0)
    if (target === undefined) continue
    let actualSvg: string
    try {
      actualSvg = transformFixtureToSvg(fixture, 0)
    } catch (error) {
      actualSvg = error instanceof Error ? error.message : String(error)
    }
    summaries.push(compareSvgFixtures({
      fixtureId: testCase.id,
      extractNr: 0,
      legacy: target.expected,
      ts: actualSvg,
      artifactDir: SVG_ARTIFACT_ROOT,
    }))
  }

  return summaries
}

describe('SVG fixtures', () => {
  it('builds comparison summaries for 3015_reference_sheet', () => {
    const summaries = compareFocusedFixtures()
    expect(summaries.length).toBeGreaterThan(0)
    expect(summaries.some((summary) => summary.fixtureId === '3015_reference_sheet')).toBe(true)
  })
})
