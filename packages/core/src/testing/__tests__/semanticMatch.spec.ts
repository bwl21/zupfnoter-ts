import { describe, expect, it } from 'vitest'

import { matchSheet, matchSong, type SheetFixture, type SongFixture } from '../semanticMatch.js'

describe('semanticMatch', () => {
  it('compares beat maps as part of song parity', () => {
    const fixture: SongFixture = {
      meta_data: {},
      voices: [{ entities: [] }],
      beat_maps: [{ '0': 0, '96': 96 }],
    }

    const actual: SongFixture = {
      meta_data: {},
      voices: [{ entities: [] }],
      beat_maps: [{ '0': 0, '96': 144 }],
    }

    const result = matchSong(actual, fixture)

    expect(result.passed).toBe(false)
    expect(result.mismatches[0]?.path).toBe('beat_maps[0]')
  })

  it('ignores legacy exporter residue in beat maps', () => {
    const fixture: SongFixture = {
      meta_data: {},
      voices: [{ entities: [] }],
      beat_maps: [{ '0': 0, '96': 96, entries: {} as unknown as number }],
    }

    const actual: SongFixture = {
      meta_data: {},
      voices: [{ entities: [] }],
      beat_maps: [{ '0': 0, '96': 96 }],
    }

    const result = matchSong(actual, fixture)

    expect(result.passed).toBe(true)
  })

  it('normalizes created-footer timestamps in sheet annotation text', () => {
    const fixture: SheetFixture = {
      children: [
        {
          type: 'Annotation',
          text: 'demo.abc - created 2026-04-28 15:40:22 by Zupfnoter v1.17.1 [zupfnoter-cli]',
        },
      ],
    }

    const actual: SheetFixture = {
      children: [
        {
          type: 'Annotation',
          text: 'demo.abc - created by Zupfnoter',
        },
      ],
    }

    const result = matchSheet(actual, fixture)

    expect(result.passed).toBe(true)
  })
})
