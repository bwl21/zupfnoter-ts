import type { FixtureStage } from './fixtureLoader.js'

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

const OPEN_IMPLEMENTATIONS: OpenImplementation[] = []

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
