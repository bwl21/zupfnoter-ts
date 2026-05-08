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
    id: 'sheet.remaining-composite-layout',
    stage: 'sheet',
    scope: 'composite reference layout interactions',
    summary: 'Composite reference fixtures still expose mixed flowline, countnote, tuplet, variant-ending, and annotation-background parity gaps beyond sheet text blocks.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['3015_reference_sheet', '783_einsiedler-kreuzweg'],
    prompt: 'Investigate the remaining composite sheet parity in 3015_reference_sheet and 783_einsiedler-kreuzweg, classify the concrete flowline/countnote/tuplet/variant-ending mismatches with the sheet legacy comparison tests, implement the remaining behavior in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
  },
  {
    id: 'sheet.tuplet-layout',
    stage: 'sheet',
    scope: 'legacy tuplet bracket and number layout',
    summary: 'Tuplet bracket paths and tuplet number annotations are not yet reproduced with full legacy parity.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['tuplet'],
    prompt: 'Investigate tuplet layout parity in the tuplet fixture, reproduce with the sheet legacy comparison test, implement legacy tuplet bracket and number rendering in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
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
  {
    id: 'sheet.horch-entity-count-ripple',
    stage: 'sheet',
    scope: '246_Horch sheet children count',
    summary: 'Sheet children count for 246_Horch-was-kommt-von-draussen-rein extract 0 is 1280 vs expected 1290 (10 missing). The song-level entity-count gap is now resolved; the remaining 10 missing children are from layout-layer differences (likely Pause pitch Math.floor fix cascading into different beat compression/spread).',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['246_Horch-was-kommt-von-draussen-rein'],
    extracts: [0],
    prompt: 'Investigate the remaining 10 missing sheet children for 246_Horch-was-kommt-von-draussen-rein extract 0. The song entity count now matches, and Pause pitches match. The remaining sheet gap is a new effect from the layout layer.',
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
