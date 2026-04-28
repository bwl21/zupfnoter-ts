/* oxlint-disable jest/expect-expect -- report-style test prints actionable prompts and writes a template file */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it } from 'vitest'

import { loadFixture, scanFixtureCases, transformFixtureToSheet, transformFixtureToSong, getSheetFixtureTargets } from '../fixtureLoader.js'
import { formatMismatches, matchSheet, matchSong, type MatchResult } from '../semanticMatch.js'
import {
  coversDetectedFailure,
  formatOpenImplementations,
  getOpenImplementations,
  type DetectedFailure,
  type OpenImplementation,
} from '../../../../../fixtures/openImplementations.js'

interface DetectedFailureWithDetails extends DetectedFailure {
  mismatchSummary: string
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_PATH = resolve(__dirname, '../../../../../fixtures/reports/open_implementations_template.ts')
const MARKDOWN_REPORT_PATH = resolve(__dirname, '../../../../../fixtures/reports/gap-report.md')

function collectSongFailures(): DetectedFailureWithDetails[] {
  const failures: DetectedFailureWithDetails[] = []

  for (const testCase of scanFixtureCases().filter((fixture) => fixture.hasSongFixture)) {
    const fixture = loadFixture(testCase)
    if (fixture.song === null) continue

    const actual = transformFixtureToSong(fixture)
    const result = matchSong(actual, fixture.song)
    pushFailureIfNeeded(failures, { stage: 'song', fixtureId: testCase.id }, result)
  }

  return failures
}

function collectSheetFailures(): DetectedFailureWithDetails[] {
  const failures: DetectedFailureWithDetails[] = []

  for (const testCase of scanFixtureCases().filter((fixture) => fixture.hasSheetFixture)) {
    const fixture = loadFixture(testCase)
    for (const target of getSheetFixtureTargets(fixture)) {
      const actual = transformFixtureToSheet(fixture, target.extractNr)
      const result = matchSheet(actual, target.expected)
      pushFailureIfNeeded(
        failures,
        { stage: 'sheet', fixtureId: testCase.id, extractNr: target.extractNr },
        result,
      )
    }
  }

  return failures
}

function pushFailureIfNeeded(
  failures: DetectedFailureWithDetails[],
  failure: DetectedFailure,
  result: MatchResult,
): void {
  if (result.passed) return
  failures.push({
    ...failure,
    mismatchSummary: formatMismatches(result),
  })
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function classifyFailures(
  failures: DetectedFailureWithDetails[],
  knownEntries: OpenImplementation[],
): {
  covered: Array<{ failure: DetectedFailureWithDetails; entries: OpenImplementation[] }>
  uncovered: DetectedFailureWithDetails[]
} {
  const covered: Array<{ failure: DetectedFailureWithDetails; entries: OpenImplementation[] }> = []
  const uncovered: DetectedFailureWithDetails[] = []

  for (const failure of failures) {
    const entries = knownEntries.filter((entry) => coversDetectedFailure(entry, failure))
    if (entries.length > 0) {
      covered.push({ failure, entries })
    } else {
      uncovered.push(failure)
    }
  }

  return { covered, uncovered }
}

function makeImplementationPrompt(failure: DetectedFailureWithDetails): string {
  const testSelector = failure.stage === 'song'
    ? `pnpm --filter @zupfnoter/core exec vitest run src/testing/__tests__/song/legacy_comparison.spec.ts -t "${failure.fixtureId}"`
    : `pnpm --filter @zupfnoter/core exec vitest run src/testing/__tests__/sheet/legacy_comparison.spec.ts -t "${failure.fixtureId} [extract ${failure.extractNr ?? 0}]"`

  return [
    `Investigate the ${failure.stage} legacy comparison failure for fixture ${failure.fixtureId}${failure.extractNr !== undefined ? ` extract ${failure.extractNr}` : ''}.`,
    `Reproduce with: ${testSelector}`,
    `Implement legacy parity, then either attach this failure to an existing entry in fixtures/openImplementations.ts or promote the template entry if it is a genuinely new gap.`,
  ].join(' ')
}

function renderTemplate(uncovered: DetectedFailureWithDetails[]): string {
  const entries = uncovered.map((failure) => ({
    id: `${failure.stage}.${slugify(failure.fixtureId)}${failure.extractNr !== undefined ? `-extract-${failure.extractNr}` : ''}-unclassified`,
    stage: failure.stage,
    scope: `${failure.fixtureId}${failure.extractNr !== undefined ? ` [extract ${failure.extractNr}]` : ''}`,
    summary: `Unclassified ${failure.stage} legacy comparison failure detected for ${failure.fixtureId}${failure.extractNr !== undefined ? ` extract ${failure.extractNr}` : ''}.`,
    refs: [failure.stage === 'song' ? 'packages/core/src/AbcToSong.ts' : 'packages/core/src/HarpnotesLayout.ts'],
    fixtures: [failure.fixtureId],
    ...(failure.extractNr !== undefined ? { extracts: [failure.extractNr] } : {}),
    prompt: makeImplementationPrompt(failure),
    mismatchSummary: failure.mismatchSummary,
  }))

  const lines = [
    '/**',
    ' * Auto-generated by `pnpm test:gaps`.',
    ' *',
    ' * This file contains currently failing legacy-comparison cases that are not',
    ' * yet covered by fixtures/openImplementations.ts.',
    ' *',
    ' * If the array is empty, no new unclassified failures were detected.',
    ' */',
    '',
    'export const OPEN_IMPLEMENTATIONS_TEMPLATE = ',
    `${JSON.stringify(entries, null, 2)} as const`,
    '',
  ]

  return `${lines.join('\n')}\n`
}

function renderMarkdownReport(args: {
  songEntries: OpenImplementation[]
  sheetEntries: OpenImplementation[]
  covered: Array<{ failure: DetectedFailureWithDetails; entries: OpenImplementation[] }>
  uncovered: DetectedFailureWithDetails[]
}): string {
  const { songEntries, sheetEntries, covered, uncovered } = args
  const lines: string[] = [
    '# Gap Report',
    '',
    'Auto-generated by `pnpm test:gaps`.',
    '',
    'This report is a regenerated worklist for fixture-driven legacy parity.',
    'If a gap is really fixed, remove it from `fixtures/openImplementations.ts`.',
    '',
    '## Summary',
    '',
    `- Total open implementations: ${songEntries.length + sheetEntries.length}`,
    `- Song gaps: ${songEntries.length}`,
    `- Sheet gaps: ${sheetEntries.length}`,
    `- Known-covered failures: ${covered.length}`,
    `- New unclassified failures: ${uncovered.length}`,
    '',
  ]

  const appendStageSection = (
    title: string,
    entries: OpenImplementation[],
  ): void => {
    lines.push(`## ${title}`, '')
    if (entries.length === 0) {
      lines.push('No open gaps.', '')
      return
    }

    for (const entry of entries) {
      const fixtures = entry.fixtures?.length ? entry.fixtures.join(', ') : '-'
      lines.push(`- [ ] ${entry.id}`)
      lines.push(`  - Fixtures: ${fixtures}`)
      if (entry.scope) lines.push(`  - Scope: ${entry.scope}`)
      lines.push(`  - Summary: ${entry.summary}`)
      if (entry.prompt?.trim()) lines.push(`  - Prompt: ${entry.prompt.trim()}`)
      if (entry.refs?.length) lines.push(`  - Refs: ${entry.refs.join(', ')}`)
      lines.push('')
    }
  }

  appendStageSection('Song Gaps', songEntries)
  appendStageSection('Sheet Gaps', sheetEntries)

  lines.push('## New Unclassified Failures', '')
  if (uncovered.length === 0) {
    lines.push('None.', '')
  } else {
    for (const failure of uncovered) {
      lines.push(
        `- [ ] ${failure.stage}.${slugify(failure.fixtureId)}${failure.extractNr !== undefined ? ` [extract ${failure.extractNr}]` : ''}`,
      )
      lines.push(`  - Fixture: ${failure.fixtureId}`)
      if (failure.extractNr !== undefined) {
        lines.push(`  - Extract: ${failure.extractNr}`)
      }
      lines.push(`  - Prompt: ${makeImplementationPrompt(failure)}`)
      lines.push('  - Mismatch Summary:')
      for (const mismatchLine of failure.mismatchSummary.split('\n')) {
        lines.push(`    ${mismatchLine}`)
      }
      lines.push('')
    }
  }

  return `${lines.join('\n')}\n`
}

describe('gap report', () => {
  it('prints overall gap summary and writes the open implementations template', () => {
    const songEntries = getOpenImplementations('song')
    const sheetEntries = getOpenImplementations('sheet')
    const allEntries = [...songEntries, ...sheetEntries]
    const songFailures = collectSongFailures()
    const sheetFailures = collectSheetFailures()
    const allFailures = [...songFailures, ...sheetFailures]
    const allIds = allEntries.map((entry) => entry.id)
    const { covered, uncovered } = classifyFailures(allFailures, allEntries)

    mkdirSync(dirname(TEMPLATE_PATH), { recursive: true })
    writeFileSync(TEMPLATE_PATH, renderTemplate(uncovered), 'utf-8')
    writeFileSync(
      MARKDOWN_REPORT_PATH,
      renderMarkdownReport({ songEntries, sheetEntries, covered, uncovered }),
      'utf-8',
    )

    console.log(`\n[gap-report:summary]\nTotal open implementations: ${allEntries.length}\nIDs: ${allIds.join(', ')}\n`)
    console.log(`[gap-report:failures]\nKnown-covered failures: ${covered.length}\nNew unclassified failures: ${uncovered.length}\nTemplate: ${TEMPLATE_PATH}\nMarkdown: ${MARKDOWN_REPORT_PATH}\n`)

    if (uncovered.length > 0) {
      console.log('[gap-report:template-prompts]')
      for (const failure of uncovered) {
        console.log(`- ${makeImplementationPrompt(failure)}`)
      }
      console.log('')
    }
  })

  it('prints actionable prompt for song gaps', () => {
    const message = formatOpenImplementations(getOpenImplementations('song'))
    console.log(`\n[gap-report:song]\n${message}\n`)
  })

  it('prints actionable prompt for sheet gaps', () => {
    const message = formatOpenImplementations(getOpenImplementations('sheet'))
    console.log(`\n[gap-report:sheet]\n${message}\n`)
  })
})
