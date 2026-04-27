import type { FixtureStage } from './fixtureLoader.js'

export interface OpenImplementation {
  id: string
  stage: 'song' | 'sheet' | 'both'
  summary: string
  scope?: string
  refs?: string[]
}

const OPEN_IMPLEMENTATIONS: OpenImplementation[] = [
  {
    id: 'song.bar-bound-variant-annotations',
    stage: 'song',
    scope: 'Song parity',
    summary: 'Bar-bound variant annotations from the legacy pipeline are not yet mapped with legacy parity in the Song model.',
    refs: ['packages/core/src/AbcToSong.ts'],
  },
  {
    id: 'sheet.extract-produce-selection',
    stage: 'sheet',
    scope: 'fixture rendering',
    summary: 'Fixture rendering always calls HarpnotesLayout.layout(song, 0, \'A4\'); it does not derive extract/page selection from configuration.',
    refs: ['packages/core/src/testing/fixtureLoader.ts'],
  },
  {
    id: 'sheet.repeat-sign-layout',
    stage: 'sheet',
    scope: 'extract.repeatsigns',
    summary: 'Legacy repeat sign rendering is not wired to config-driven voice selection yet.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
  },
  {
    id: 'sheet.reference-jumplines',
    stage: 'sheet',
    scope: 'jump line parity',
    summary: 'Reference-sheet jump lines are not yet ported with legacy parity.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
  },
  {
    id: 'sheet.barnumbers-config',
    stage: 'sheet',
    scope: 'extract.barnumbers',
    summary: 'Barnumber layout ignores config fields such as pos, autopos, style, and prefix; current output uses a fixed placement and style.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
  },
  {
    id: 'sheet.lyrics-config',
    stage: 'sheet',
    scope: 'extract.lyrics',
    summary: 'Lyrics are laid out with a generic per-note offset and style instead of configured verse groups, positions, and styles.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
  },
  {
    id: 'sheet.nonflowrest-config',
    stage: 'sheet',
    scope: 'extract.nonflowrest',
    summary: 'The nonflowrest option is not evaluated when deciding pause and flowline behavior.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
  },
  {
    id: 'sheet.countnotes-config',
    stage: 'sheet',
    scope: 'extract.countnotes',
    summary: 'Countnote annotations are not rendered from configuration yet.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
  },
  {
    id: 'sheet.stringnames-config',
    stage: 'sheet',
    scope: 'extract.stringnames',
    summary: 'Config-driven string name layout is not implemented yet.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
  },
  {
    id: 'sheet.notebound-annotation-overrides',
    stage: 'sheet',
    scope: 'extract.notebound.annotation',
    summary: 'Per-note annotation position overrides from configuration are not applied yet.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
  },
  {
    id: 'sheet.notebound-partname-overrides',
    stage: 'sheet',
    scope: 'extract.notebound.partname',
    summary: 'Per-note part name position overrides from configuration are not applied yet.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
  },
  {
    id: 'sheet.legend-secondary-position',
    stage: 'sheet',
    scope: 'extract.legend.spos',
    summary: 'The secondary legend position used by the legacy renderer is not evaluated yet.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
  },
  {
    id: 'sheet.filenamepart-and-footers',
    stage: 'sheet',
    scope: 'extract.filenamepart',
    summary: 'Filename-part-driven footer and reference-sheet text behavior is not implemented with legacy parity.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
  },
  {
    id: 'sheet.top-level-annotation-definitions',
    stage: 'sheet',
    scope: 'top-level annotations',
    summary: 'Top-level annotation definitions are not yet resolved through the legacy annotation pipeline.',
    refs: ['packages/core/src/HarpnotesLayout.ts'],
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

  const lines = ['Open implementations for this stage:']
  for (const entry of entries) {
    const scope = entry.scope ? ` (${entry.scope})` : ''
    lines.push(`- ${entry.id}${scope}: ${entry.summary}`)
    if (entry.refs && entry.refs.length > 0) {
      lines.push(`  refs: ${entry.refs.join(', ')}`)
    }
  }

  return lines.join('\n')
}
