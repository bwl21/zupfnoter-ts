import type { FixtureStage } from '../packages/core/src/testing/fixtureLoader.js'

export interface OpenImplementation {
  id: string
  stage: 'song' | 'sheet' | 'both'
  summary: string
  scope?: string
  refs?: string[]
  fixtures?: string[]
  extracts?: number[]
  prompt?: string
  notes?: string
}

export interface DetectedFailure {
  stage: Extract<FixtureStage, 'song' | 'sheet'>
  fixtureId: string
  extractNr?: number
}

const OPEN_IMPLEMENTATIONS: OpenImplementation[] = [
  {
    id: 'sheet.reference-jumplines',
    stage: 'sheet',
    scope: 'jump line parity',
    summary: 'Reference-sheet jump lines are not yet ported with legacy parity.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['3015_reference_sheet', '783_einsiedler-kreuzweg'],
    prompt: 'Investigate jump-line parity for the listed fixtures, reproduce with the sheet legacy comparison tests, implement the remaining legacy jumpline behavior in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
  },
  {
    id: 'sheet.legacy-inline-directives',
    stage: 'sheet',
    scope: '%%%%hn* inline directives',
    summary: 'Legacy inline directives such as %%%%hnc, %%%%hna, and %%%%hn.legend are not parsed and mapped to the TypeScript config model yet.',
    refs: ['packages/core/src/extractSongConfig.ts', 'packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['02_twoStaff'],
    prompt: 'Investigate legacy inline ABC directives such as %%%%hnc, %%%%hna, and %%%%hn.legend, reproduce with the 02_twoStaff sheet legacy comparison test, implement parsing and config mapping with legacy parity, then remove this id from fixtures/openImplementations.ts.',
  },
  {
    id: 'sheet.barnumbers-config',
    stage: 'sheet',
    scope: 'extract.barnumbers',
    summary: 'Barnumber layout ignores config fields such as pos, autopos, style, and prefix; current output uses a fixed placement and style.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['3015_reference_sheet'],
    prompt: 'Investigate barnumber config parity in 3015_reference_sheet, reproduce with the sheet legacy comparison test, implement the remaining extract.barnumbers behavior in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
  },
  {
    id: 'sheet.nonflowrest-config',
    stage: 'sheet',
    scope: 'extract.nonflowrest',
    summary: 'The nonflowrest option is not evaluated when deciding pause and flowline behavior.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['3015_reference_sheet', '783_einsiedler-kreuzweg'],
    prompt: 'Investigate nonflowrest parity for the listed fixtures, reproduce with the sheet legacy comparison tests, implement extract.nonflowrest handling in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
  },
  {
    id: 'sheet.countnotes-config',
    stage: 'sheet',
    scope: 'extract.countnotes',
    summary: 'Countnote annotations are not rendered from configuration yet.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['3015_reference_sheet'],
    prompt: 'Investigate countnote parity in 3015_reference_sheet, reproduce with the sheet legacy comparison test, implement the remaining extract.countnotes behavior in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
  },
  {
    id: 'sheet.notebound-annotation-overrides',
    stage: 'sheet',
    scope: 'extract.notebound.annotation',
    summary: 'Per-note annotation position overrides from configuration are not applied yet.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['3015_reference_sheet'],
    prompt: 'Investigate note-bound annotation override parity in 3015_reference_sheet, reproduce with the sheet legacy comparison test, implement extract.notebound.annotation override handling in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
  },
  {
    id: 'sheet.notebound-partname-overrides',
    stage: 'sheet',
    scope: 'extract.notebound.partname',
    summary: 'Per-note part name position overrides from configuration are not applied yet.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['3015_reference_sheet'],
    prompt: 'Investigate note-bound part-name override parity in 3015_reference_sheet, reproduce with the sheet legacy comparison test, implement extract.notebound.partname override handling in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
  },
  {
    id: 'sheet.sheet-header-legend-and-footers',
    stage: 'sheet',
    scope: 'header, legend, cutmarks, footer text',
    summary: 'Legacy sheet header, legend, cutmark, and footer text behavior is not yet reproduced with legacy parity, including filename-part-driven text variants.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: [
        '3015_reference_sheet',
        'repeat',
        '783_einsiedler-kreuzweg',
        'pause',
        'single_note',
      'tuplet',
      'two_voices',
    ],
    prompt: 'Investigate legacy sheet header, legend, cutmark, and footer parity for the listed fixtures, reproduce with the sheet legacy comparison tests, implement the remaining text-block and footer behavior in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
  },
  {
    id: 'sheet.decorations-layout',
    stage: 'sheet',
    scope: 'note decorations and symbols',
    summary: 'Legacy decoration rendering is not yet reproduced with full sheet-layout parity.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['decoration'],
    prompt: 'Investigate decoration layout parity in the decoration fixture, reproduce with the sheet legacy comparison test, implement the remaining legacy decoration rendering in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
  },
  {
    id: 'sheet.lyrics-layout',
    stage: 'sheet',
    scope: 'ABC lyrics layout',
    summary: 'Plain ABC lyric lines are not yet laid out with full legacy parity.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['lyrics'],
    prompt: 'Investigate lyrics layout parity in the lyrics fixture, reproduce with the sheet legacy comparison test, implement the remaining lyric placement behavior in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
  },
  {
    id: 'sheet.tie-layout',
    stage: 'sheet',
    scope: 'tie and slur layout',
    summary: 'Tie and slur rendering is not yet reproduced with full legacy parity in the sheet layout.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['tie'],
    prompt: 'Investigate tie and slur layout parity in the tie fixture, reproduce with the sheet legacy comparison test, implement the remaining tie rendering in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
  },
  {
    id: 'sheet.multistaff-layout',
    stage: 'sheet',
    scope: 'multi-staff sheet layout',
    summary: 'Multi-staff sheet layout is not yet reproduced with full legacy parity.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['Twostaff'],
    prompt: 'Investigate multi-staff layout parity in the Twostaff fixture, reproduce with the sheet legacy comparison test, implement the remaining multi-staff legacy behavior in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
  },
]

export function getOpenImplementations(
  stage: Extract<FixtureStage, 'song' | 'sheet'>,
): OpenImplementation[] {
  return OPEN_IMPLEMENTATIONS.filter(
    (entry) => entry.stage === stage || entry.stage === 'both',
  )
}

export function formatOpenImplementations(entries: OpenImplementation[]): string {
  if (entries.length === 0) return ''

  const ids = entries.map((entry) => entry.id)
  const lines = [
    `Open implementations for this stage (${entries.length}): ${ids.join(', ')}`,
  ]

  if (entries.some((entry) => entry.prompt?.trim())) {
    lines.push('Entries:')
    for (const entry of entries) {
      const fixtures = entry.fixtures?.length ? entry.fixtures.join(', ') : '-'
      lines.push(`- id: ${entry.id}`)
      lines.push(`  fixtures: ${fixtures}`)
      if (entry.prompt?.trim()) {
        lines.push(`  prompt: ${entry.prompt.trim()}`)
      }
    }
  } else {
    lines.push(
      'Prompt: implement the listed gaps with legacy parity, then remove the completed ids from fixtures/openImplementations.ts.',
    )
  }

  return lines.join('\n')
}

export function coversDetectedFailure(
  entry: OpenImplementation,
  failure: DetectedFailure,
): boolean {
  if (!(entry.stage === failure.stage || entry.stage === 'both')) return false
  if (entry.fixtures && !entry.fixtures.includes(failure.fixtureId)) return false
  if (failure.extractNr !== undefined && entry.extracts && !entry.extracts.includes(failure.extractNr)) return false
  return true
}
