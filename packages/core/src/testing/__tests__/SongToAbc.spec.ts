import { describe, expect, it } from 'vitest'
import type { Song } from '@zupfnoter/types'
import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import { exportSongToAbc } from '../../SongToAbc.js'
import { defaultTestConfig } from '../defaultConfig.js'

const SHIFTED_ABC = `X:1
T:Materialize shift
M:4/4
L:1/4
K:C shift=DC
C D [E,G]2 |: F G :|
`

function transform(source: string): Song {
  const model = new AbcParser().parse(source)
  return new AbcToSong().transform(model, defaultTestConfig)
}

function pitches(song: Song): number[][] {
  return song.voices.slice(1).map((voice) => voice.entities
    .flatMap((entity): number[] => {
      if (entity.type === 'Note') return [entity.pitch]
      if (entity.type === 'SynchPoint') return entity.notes.map((note) => note.pitch)
      return []
    }))
}

describe('exportSongToAbc', () => {
  it('materializes effective pitches and removes source shifts', () => {
    const originalSong = transform(SHIFTED_ABC)
    const exported = exportSongToAbc(SHIFTED_ABC, originalSong)
    const exportedSong = transform(exported)

    expect(exported).not.toContain('shift=')
    expect(exported).toContain('|:')
    expect(pitches(exportedSong)).toEqual(pitches(originalSong))
  })

  it('changes only mapped note tokens, preserving headers and repeat syntax', () => {
    const originalSong = transform(SHIFTED_ABC)
    const exported = exportSongToAbc(SHIFTED_ABC, originalSong)

    expect(exported).toContain('X:1\nT:Materialize shift\nM:4/4\nL:1/4\n')
    expect(exported).toMatch(/\|: _E F :\|/)
    expect(exported).toContain('[D,F]2')
  })
})
