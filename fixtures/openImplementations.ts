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
    id: 'empty-part-marker-flowline-break',
    stage: 'both',
    summary: 'Keep empty [P:] markers as legacy-parity annotations that interrupt flowlines.',
    scope: 'ABC part markers [P:] without a label',
    fixtures: [
      '758_adventliche-weise',
      '765_guter-mond-du-gehst-so-stille',
      '782_lobe-den-herren-o-meine-seele',
      '784_herr-wir-loben-deine-gnade',
      '786_menuetto_salzburger-tanzbuechlein-15',
      '788_italienisches-lied-arpggio',
      '792_wie-ein-hirsch',
    ],
    prompt: [
      'Short term: materialize every empty [P:] marker like Legacy as a note-bound annotation with a single space.',
      'The annotation must remain in the model and interrupt flowline continuation.',
      'Later: keep the semantic interruption, but suppress visual rendering of the empty annotation.',
    ].join(' '),
    notes: 'Do not remove the marker from the Song model when implementing the visual suppression; the flowline break is semantic.',
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
