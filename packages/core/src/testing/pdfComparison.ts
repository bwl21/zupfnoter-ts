/** Visueller Vergleich zweier PDF-Dateien über gerenderte Seitenbilder. */

import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

export interface PdfPageComparison {
  page: number
  differingPixels?: number
  diffImagePath?: string
}

export interface PdfComparisonSummary {
  available: boolean
  legacyPages?: number
  tsPages?: number
  pages: PdfPageComparison[]
  artifactDir: string
  error?: string
}

function pageImages(prefix: string): string[] {
  const directory = resolve(prefix, '..')
  const basename = prefix.slice(prefix.lastIndexOf('/') + 1)
  return readdirSync(directory)
    .filter((name) => new RegExp(`^${basename}-\\d+\\.png$`).test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .map((name) => resolve(directory, name))
}

function renderPdf(pdfPath: string, prefix: string): string | undefined {
  const result = spawnSync('pdftoppm', ['-png', '-r', '144', pdfPath, prefix], { stdio: 'ignore' })
  return existsSync(`${prefix}-1.png`) ? undefined : `pdftoppm failed with status ${String(result.status)}`
}

function differingPixels(legacyPng: string, tsPng: string, diffPng: string): number | undefined {
  const result = spawnSync('compare', ['-metric', 'AE', legacyPng, tsPng, diffPng], { encoding: 'utf-8' })
  const value = Number.parseFloat(result.stderr.trim())
  return Number.isFinite(value) ? value : undefined
}

/** Rendert beide PDFs und vergleicht sie Seite für Seite mit ImageMagick. */
export function comparePdfFiles(legacyPdf: string, tsPdf: string, artifactDir: string): PdfComparisonSummary {
  if (!existsSync(legacyPdf) || !existsSync(tsPdf)) {
    return { available: false, pages: [], artifactDir, error: 'PDF reference or TS output is missing.' }
  }
  mkdirSync(artifactDir, { recursive: true })
  const legacyPrefix = resolve(artifactDir, 'legacy')
  const tsPrefix = resolve(artifactDir, 'ts')
  const legacyError = renderPdf(legacyPdf, legacyPrefix)
  const tsError = renderPdf(tsPdf, tsPrefix)
  if (legacyError !== undefined || tsError !== undefined) {
    return { available: false, pages: [], artifactDir, error: legacyError ?? tsError }
  }

  const legacyPages = pageImages(legacyPrefix)
  const tsPages = pageImages(tsPrefix)
  const pageCount = Math.min(legacyPages.length, tsPages.length)
  const pages: PdfPageComparison[] = []
  for (let index = 0; index < pageCount; index += 1) {
    const legacyPage = legacyPages[index]
    const tsPage = tsPages[index]
    if (legacyPage === undefined || tsPage === undefined) continue
    const diffImagePath = resolve(artifactDir, `diff-${index + 1}.png`)
    pages.push({
      page: index + 1,
      differingPixels: differingPixels(legacyPage, tsPage, diffImagePath),
      diffImagePath,
    })
  }

  return {
    available: true,
    legacyPages: legacyPages.length,
    tsPages: tsPages.length,
    pages,
    artifactDir,
  }
}
