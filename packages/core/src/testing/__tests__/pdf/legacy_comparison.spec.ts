/* oxlint-disable jest/expect-expect -- report-style test retains visual diffs for PDF parity work */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { loadFixture, transformFixtureToPdf } from '../../fixtureLoader.js'
import { comparePdfFiles } from '../../pdfComparison.js'

const FIXTURE_NAME = '3015_reference_sheet'
const ARTIFACT_DIR = resolve('/private/tmp/zupfnoter-pdf-artifacts', FIXTURE_NAME)

function legacyCliPath(fixtureDir: string): string {
  return resolve(fixtureDir, '../../..', '../200_zupfnoter/30_sources/SRC_Zupfnoter/src/zupfnoter-cli.js')
}

function renderLegacyPdf(fixtureDir: string, abcPath: string): string {
  const cliPath = legacyCliPath(fixtureDir)
  if (!existsSync(cliPath)) throw new Error(`Legacy CLI is missing: ${cliPath}`)
  const legacyOutput = resolve(ARTIFACT_DIR, 'legacy-output')
  mkdirSync(legacyOutput, { recursive: true })
  const run = spawnSync('node', [cliPath, abcPath, legacyOutput], { encoding: 'utf-8' })
  if (run.status !== 0) throw new Error(run.stderr.trim() || run.stdout.trim() || 'Legacy CLI PDF export failed.')
  const pdf = readdirSync(legacyOutput).find((filename) => filename.endsWith('_a3.pdf'))
  if (pdf === undefined) throw new Error('Legacy CLI did not write an A3 PDF.')
  return resolve(legacyOutput, pdf)
}

describe('PDF fixtures', () => {
  it('renders and visually compares the focused legacy A3 PDF', { timeout: 30000 }, async () => {
    const fixture = loadFixture(FIXTURE_NAME)
    mkdirSync(ARTIFACT_DIR, { recursive: true })
    const legacyPdf = renderLegacyPdf(fixture.dir, resolve(fixture.dir, 'input.abc'))
    const tsPdf = resolve(ARTIFACT_DIR, 'ts-a3.pdf')
    writeFileSync(tsPdf, Buffer.from(await transformFixtureToPdf(fixture, 0, 'A3').arrayBuffer()))

    const summary = comparePdfFiles(legacyPdf, tsPdf, resolve(ARTIFACT_DIR, 'comparison'))
    expect(summary.available, summary.error).toBe(true)
    expect(summary.legacyPages).toBe(1)
    expect(summary.tsPages).toBe(1)
    console.log(`[pdf-parity] differing pixels: ${summary.pages[0]?.differingPixels ?? 'unavailable'}; artifacts: ${ARTIFACT_DIR}`)
  })
})
