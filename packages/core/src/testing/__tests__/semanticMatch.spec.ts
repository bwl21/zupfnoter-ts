import { describe, expect, it } from 'vitest'

import { matchSong, type SongFixture } from '../semanticMatch.js'

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
})
