/* oxlint-disable jest/expect-expect -- dev helper: tests write files, no assertions needed */
import { describe, it } from 'vitest'

import {
  getOutputSvgFixtureTargets,
  getSheetFixtureTargets,
  loadFixture,
  saveFixtureOutput,
  scanFixtureCases,
  transformFixtureToSvg,
} from '../../fixtureLoader.js'
import type { FixtureCase } from '../../fixtureLoader.js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function dump(testCase: FixtureCase) {
  const fixture = loadFixture(testCase)
  const targets = getOutputSvgFixtureTargets(fixture)
  const fallbackTargets = getSheetFixtureTargets(fixture)
  const effectiveTargets = targets.length > 0 ? targets : fallbackTargets
  const outputDir = resolve(fixture.dir, '_ts_output')
  mkdirSync(outputDir, { recursive: true })

  if (effectiveTargets.length === 0) {
    saveFixtureOutput(fixture, 'output_svg', transformFixtureToSvg(fixture))
    console.log(`Written: ${testCase.id}/_ts_output/output.svg`)
    return
  }

  for (const target of effectiveTargets) {
    const content = transformFixtureToSvg(fixture, target.extractNr)
    const filename = resolve(outputDir, `output.extract-${target.extractNr}.svg`)
    writeFileSync(filename, content, 'utf-8')
    console.log(`Written: ${testCase.id}/_ts_output/output.extract-${target.extractNr}.svg`)
  }
}

describe('dump TS svg output (dev helper)', () => {
  for (const testCase of scanFixtureCases()) {
    it(`writes ${testCase.id}`, () => dump(testCase))
  }
})
