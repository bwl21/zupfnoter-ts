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
    id: 'song.metadata-fields',
    stage: 'song',
    scope: 'Song.metaData shape parity with legacy raw',
    summary:
      'Song.metaData diverges from the legacy raw export: `tempo` is collapsed to a single number instead of `{duration, bpm}`, `tempoDisplay` is not exposed under `tempo_display`, `meter` is a string instead of an array, `o_key`/`filename` are missing, and the `key` value is post-processed (e.g. "Amaj" instead of "A").',
    refs: ['packages/core/src/AbcToSong.ts', 'packages/core/src/testing/fixtureLoader.ts'],
    fixtures: [
      '246_Horch-was-kommt-von-draussen-rein',
      '3015_reference_sheet',
      '783_einsiedler-kreuzweg',
      'Twostaff',
      'abc-to-song-slur-tuplet-parity',
      'decoration',
      'lyrics',
      'pause',
      'repeat',
      'single_note',
      'tie',
      'tuplet',
      'two_voices',
    ],
    prompt:
      'Align Song.metaData with the legacy raw shape (`song.legacy-raw.json`): emit `tempo` as `{duration, bpm}`, expose `tempo_display`, keep `meter` as an array, add `o_key` and `filename`, and stop normalizing `key` to a major/minor suffix. Reproduce with the song legacy comparison tests in packages/core/src/testing/__tests__/song/legacy_comparison.spec.ts, then remove this id from fixtures/openImplementations.ts.',
  },
  {
    id: 'song.voice-count',
    stage: 'song',
    scope: 'Song.voices length parity',
    summary:
      'Several fixtures expose one fewer voice in the TS Song than in the legacy raw export. Cause is not yet classified — it may be related to multi-tune aggregation or to a missing voice-0 placeholder in the TS pipeline.',
    refs: ['packages/core/src/AbcToSong.ts'],
    fixtures: [
      '3015_reference_sheet',
      '783_einsiedler-kreuzweg',
      'Twostaff',
      'two_voices',
    ],
    prompt:
      'Diagnose why the TS pipeline produces fewer Song.voices than the legacy raw export for the listed fixtures (compare voices[*].length and entity counts), implement the missing voice handling in packages/core/src/AbcToSong.ts, and remove this id from fixtures/openImplementations.ts when the song legacy comparison tests pass.',
  },
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
