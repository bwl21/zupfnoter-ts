/* oxlint-disable jest/expect-expect -- report-style test retains visual diffs for PDF parity work */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { loadFixture, transformFixtureToPdf } from '../../fixtureLoader.js'
import { comparePdfFiles } from '../../pdfComparison.js'

const FIXTURE_NAME = '3015_reference_sheet'
const ARTIFACT_DIR = resolve('/private/tmp/zupfnoter-pdf-artifacts', FIXTURE_NAME)
// jsPDF 4.x rasterisiert Standardfonts und Dash-Muster anders als das Legacy-jsPDF 1.5.2.
const MAX_RENDERER_DIFFERING_PIXELS = 5000

describe('PDF fixtures', () => {
  it('renders and visually compares the focused A3 PDF fixture', { timeout: 30000 }, async () => {
    const fixture = loadFixture(FIXTURE_NAME)
    mkdirSync(ARTIFACT_DIR, { recursive: true })
    const legacyPdf = resolve(fixture.dir, 'output.extract-0_a3.pdf')
    expect(existsSync(legacyPdf)).toBe(true)
    const tsPdf = resolve(ARTIFACT_DIR, 'ts-a3.pdf')
    writeFileSync(tsPdf, Buffer.from(await transformFixtureToPdf(fixture, 0, 'A3').arrayBuffer()))

    const summary = comparePdfFiles(legacyPdf, tsPdf, resolve(ARTIFACT_DIR, 'comparison'))
    expect(summary.available, summary.error).toBe(true)
    expect(summary.legacyPages).toBe(1)
    expect(summary.tsPages).toBe(1)
    const differingPixels = summary.pages[0]?.differingPixels
    expect(differingPixels).toBeDefined()
    expect(differingPixels).toBeLessThanOrEqual(MAX_RENDERER_DIFFERING_PIXELS)
    console.log(`[pdf-parity] differing pixels: ${String(differingPixels)} (limit: ${String(MAX_RENDERER_DIFFERING_PIXELS)}); artifacts: ${ARTIFACT_DIR}`)
  })
})
