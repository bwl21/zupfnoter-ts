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
    id: 'sheet.multistaff-layout',
    stage: 'sheet',
    scope: 'multi-staff sheet layout',
    summary: 'Multi-staff sheet layout is not yet reproduced with full legacy parity.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['Twostaff'],
    prompt: 'Investigate multi-staff layout parity in the Twostaff fixture, reproduce with the sheet legacy comparison test, implement the remaining multi-staff legacy behavior in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
    notes: [
      'Triage 2026-05-08: Not a small voice-index-only gap. The first mismatch block around children[68..77] is caused by SynchPoint/chord note order: legacy keeps [B,G,] as pitches [59,55], while TS currently emits ascending [55,59], so paired ellipses appear swapped.',
      'A second independent difference starts in the later bass/repeat section: expected y positions are consistently about +6.25 mm compared with TS output. This points to beat-packer, measureStart, or repeat-bar spacing behavior, not just child ordering.',
      'Temporary debug inspection was removed; revisit with focused diagnostics for SynchPoint note ordering and beat compression around beats 96+ in Twostaff.',
    ].join(' '),
  },
  {
    id: 'sheet.horch-entity-count-ripple',
    stage: 'sheet',
    scope: '246_Horch sheet children count',
    summary: 'Sheet children count for 246_Horch-was-kommt-von-draussen-rein extract 0 is no longer the primary mismatch after restoring pause decorations; the remaining failure is layout-layer parity in flowline/type counts and Y positions.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['246_Horch-was-kommt-von-draussen-rein'],
    extracts: [0],
    prompt: 'Investigate the remaining sheet parity for 246_Horch-was-kommt-von-draussen-rein extract 0. Pause decorations now restore the original child count, but TS still emits 4 extra FlowLines and misses 2 Annotation/Ellipse note-bound pairs; once child order is aligned, Y positions expose a beat compression/spread mismatch.',
    notes: [
      'Triage 2026-05-08: The visible 1280 vs 1290 count gap was caused by Pause entities not carrying ABC decorations. `AbcToSong._transformRest()` now copies `this._parseDecorations(sym)`, which restores the 10 missing decoration background/text children without changing song entity counts.',
      'Do not solve the remaining `:|]2` variant label by materializing extra Song NoteBoundAnnotation entities: that breaks Horch song parity by +1 entity per voice. The missing sheet-level `2` labels and the extra FlowLines need a layout/variant rendering approach that preserves the Song fixture shape.',
      'A naive trailing-rest FlowLine skip also breaks the `pause` sheet fixture. Revisit FlowLine parity with a narrower legacy condition.',
    ].join(' '),
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
