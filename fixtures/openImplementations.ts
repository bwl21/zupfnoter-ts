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
    fixtures: ['783_einsiedler-kreuzweg'],
    prompt: 'Investigate the remaining composite sheet parity in 783_einsiedler-kreuzweg, classify the concrete flowline/countnote/tuplet/variant-ending mismatches with the sheet legacy comparison tests, implement the remaining behavior in packages/core/src/HarpnotesLayout.ts, then remove this id from fixtures/openImplementations.ts.',
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
    scope: '246_Horch sheet Y-position parity',
    summary: 'Sheet child count, FlowLine counts, `:|]2` variant-end labels, and small annotation-background widths now match for 246_Horch-was-kommt-von-draussen-rein extract 0; the remaining failure is layout-layer Y-position parity.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
    fixtures: ['246_Horch-was-kommt-von-draussen-rein'],
    extracts: [0],
    prompt: 'Investigate the remaining sheet parity for 246_Horch-was-kommt-von-draussen-rein extract 0. Element order and type counts are aligned: 1290 children with FlowLine/Path/Annotation/Glyph/Ellipse counts matching legacy. The remaining mismatch is systematic Y-position drift from beat compression/spread behavior.',
    notes: [
      'Triage 2026-05-08: The visible 1280 vs 1290 count gap was caused by Pause entities not carrying ABC decorations. `AbcToSong._transformRest()` now copies `this._parseDecorations(sym)`, which restores the 10 missing decoration background/text children without changing song entity counts.',
      'Follow-up 2026-05-09: Layout now suppresses FlowLines across variant boundaries even when the target playable is a Pause or the line is dotted. This removes the 4 extra FlowLines without affecting Song fixtures.',
      'Follow-up 2026-05-09: Layout now synthesizes missing `2` variant-end labels from repeat Gotos when Song parity intentionally has no NoteBoundAnnotation entity for `:|]2`. Do not materialize these in AbcToSong; that breaks Horch song parity by +1 entity per voice.',
      'Follow-up 2026-05-09: Annotation background widths for small countnote text now account for narrow glyphs such as `l`, `t`, and `r`; the focused Horch sheet diff no longer reports size mismatches.',
      'A naive trailing-rest FlowLine skip also breaks the `pause` sheet fixture. Revisit only if a future FlowLine mismatch reappears.',
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
