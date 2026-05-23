/* oxlint-disable jest/valid-expect -- Vitest supports expect(val, msg) for failure messages */
import { describe, expect, it } from 'vitest'

import { formatMismatches, matchSvg } from '../../semanticMatch.js'
import { getOutputSvgFixtureTargets, loadFixture, scanFixtureCases, transformFixtureToSvg } from '../../fixtureLoader.js'

const SVG_FIXTURES = scanFixtureCases().filter((testCase) => testCase.hasOutputSvgFixture)

describe('SVG fixtures', () => {
  if (SVG_FIXTURES.length === 0) {
    it('has no legacy svg fixtures yet', () => {
      expect(SVG_FIXTURES).toEqual([])
    })
  }

  for (const testCase of SVG_FIXTURES) {
    const fixture = loadFixture(testCase)
    const targets = getOutputSvgFixtureTargets(fixture)

    for (const target of targets) {
      it(`matches legacy output: ${testCase.id} [extract ${target.extractNr}]`, () => {
        const actual = transformFixtureToSvg(fixture, target.extractNr)
        const result = matchSvg(actual, target.expected)
        expect(result.passed, formatMismatches(result)).toBe(true)
      })
    }

    if (targets.length === 0) {
      it(`matches legacy output: ${testCase.id}`, () => {
        throw new Error(`Missing output.svg fixture for ${testCase.id}`)
      })
    }
  }
})
