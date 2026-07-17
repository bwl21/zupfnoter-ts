/* oxlint-disable jest/expect-expect -- dev helper: tests write files, no assertions needed */
/**
 * Dumps TypeScript PDF output for every configured extract to
 * `fixtures/cases/<area>/<name>/_ts_output/`.
 *
 * The files use the fixture artifact name `output.extract-<nr>_a3.pdf`, so
 * they can be inspected next to the matching legacy A3 reference without
 * colliding with the productive storage filename.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'vitest'

import { loadFixture, scanFixtureCases, transformFixtureToPdf } from '../../fixtureLoader.js'
import type { FixtureCase } from '../../fixtureLoader.js'

function configuredPdfExtracts(produce: number[] | undefined): number[] {
  return produce !== undefined && produce.length > 0 ? produce : [0]
}

function clearPdfDumps(outputDir: string): void {
  for (const filename of readdirSync(outputDir)) {
    if (/^output\.extract-\d+_a3\.pdf$/.test(filename)) {
      rmSync(resolve(outputDir, filename))
    }
  }
}

async function dump(testCase: FixtureCase): Promise<void> {
  const fixture = loadFixture(testCase)
  const outputDir = resolve(fixture.dir, '_ts_output')
  mkdirSync(outputDir, { recursive: true })
  clearPdfDumps(outputDir)

  for (const extractNr of configuredPdfExtracts(fixture.config.produce)) {
    const pdf = transformFixtureToPdf(fixture, extractNr, 'A3')
    const filename = resolve(outputDir, `output.extract-${String(extractNr)}_a3.pdf`)
    writeFileSync(filename, Buffer.from(await pdf.arrayBuffer()))
    console.log(`Written: ${testCase.id}/_ts_output/output.extract-${String(extractNr)}_a3.pdf`)
  }
}

describe('dump TS PDF output (dev helper)', () => {
  for (const testCase of scanFixtureCases()) {
    it(`writes ${testCase.id}`, async () => dump(testCase))
  }
})
