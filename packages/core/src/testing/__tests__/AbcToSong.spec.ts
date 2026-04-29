/* oxlint-disable jest/no-conditional-expect -- type-narrowing guards are intentional */
/**
 * AbcToSong unit tests.
 *
 * Tests the full ABC → Song transformation for the minimal fixtures.
 */
import { describe, it, expect } from 'vitest'
import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import { defaultTestConfig } from '../defaultConfig.js'

function transform(abcText: string) {
  const parser = new AbcParser()
  const model = parser.parse(abcText)
  const transformer = new AbcToSong()
  return transformer.transform(model, defaultTestConfig)
}

// ---------------------------------------------------------------------------
// single_note
// ---------------------------------------------------------------------------

describe('AbcToSong – single_note', () => {
  const ABC = `X:1
T:Single Note Test
M:4/4
L:1/4
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] C |]
`

  it('produces a Song with at least one voice', () => {
    const song = transform(ABC)
    expect(song.voices.length).toBeGreaterThanOrEqual(1)
  })

  it('voice contains at least one Note entity', () => {
    const song = transform(ABC)
    const notes = song.voices[0]!.entities.filter((e) => e.type === 'Note')
    expect(notes.length).toBeGreaterThanOrEqual(1)
  })

  it('note has a valid MIDI pitch', () => {
    const song = transform(ABC)
    const note = song.voices[0]!.entities.find((e) => e.type === 'Note')
    expect(note).toBeDefined()
    if (note?.type === 'Note') {
      expect(note.pitch).toBeGreaterThan(0)
      expect(note.pitch).toBeLessThan(128)
    }
  })

  it('note has a positive duration', () => {
    const song = transform(ABC)
    const note = song.voices[0]!.entities.find((e) => e.type === 'Note')
    if (note?.type === 'Note') {
      expect(note.duration).toBeGreaterThan(0)
    }
  })

  it('note has a non-negative beat', () => {
    const song = transform(ABC)
    const note = song.voices[0]!.entities.find((e) => e.type === 'Note')
    if (note?.type === 'Note') {
      expect(note.beat).toBeGreaterThanOrEqual(0)
    }
  })

  it('extracts title metadata', () => {
    const song = transform(ABC)
    expect(song.metaData.title).toContain('Single Note')
  })

  it('produces a BeatMap', () => {
    const song = transform(ABC)
    expect(song.beatMaps.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// two_voices
// ---------------------------------------------------------------------------

describe('AbcToSong – two_voices', () => {
  const ABC = `X:1
T:Two Voices Test
M:4/4
L:1/4
K:C
%%score (V1) (V2)
V:V1 clef=treble-8
V:V2 clef=treble-8
[V:V1] C D E F |]
[V:V2] G, A, B, C |]
`

  it('produces two voices', () => {
    const song = transform(ABC)
    expect(song.voices.length).toBeGreaterThanOrEqual(2)
  })

  it('each voice has at least 4 Note entities', () => {
    const song = transform(ABC)
    for (const voice of song.voices.slice(0, 2)) {
      const notes = voice.entities.filter((e) => e.type === 'Note')
      expect(notes.length).toBeGreaterThanOrEqual(4)
    }
  })
})

// ---------------------------------------------------------------------------
// pause
// ---------------------------------------------------------------------------

describe('AbcToSong – pause', () => {
  const ABC = `X:1
T:Pause Test
M:4/4
L:1/16
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] C z D2 z2 E4 z4 |]
`

  it('produces Pause entities', () => {
    const song = transform(ABC)
    const pauses = song.voices[0]!.entities.filter((e) => e.type === 'Pause')
    expect(pauses.length).toBeGreaterThanOrEqual(1)
  })

  it('pauses have positive duration', () => {
    const song = transform(ABC)
    const pauses = song.voices[0]!.entities.filter((e) => e.type === 'Pause')
    for (const p of pauses) {
      if (p.type === 'Pause') {
        expect(p.duration).toBeGreaterThan(0)
      }
    }
  })

  it('preserves annotations attached to rests', () => {
    const song = transform(`X:1
T:Pause Annotation Test
M:4/4
L:1/4
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] \"^rest-label\" z C |]
`)
    const annotations = song.voices[0]!.entities.filter((e) => e.type === 'NoteBoundAnnotation')
    expect(annotations.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// repeat
// ---------------------------------------------------------------------------

describe('AbcToSong – repeat', () => {
  const ABC = `X:1
T:Repeat Test
M:4/4
L:1/4
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] |: C D E F :|
`

  it('produces Goto entities for repeat', () => {
    const song = transform(ABC)
    const gotos = song.voices[0]!.entities.filter((e) => e.type === 'Goto')
    expect(gotos.length).toBeGreaterThanOrEqual(1)
  })

})

// ---------------------------------------------------------------------------
// decorations
// ---------------------------------------------------------------------------

describe('AbcToSong – decorations', () => {
  const ABC = `X:1
T:Decoration Test
M:4/4
L:1/4
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] !fermata!C D !f!E !p!F |]
`

  it('preserves supported note decorations', () => {
    const song = transform(ABC)
    const notes = song.voices[0]?.entities.filter((e) => e.type === 'Note') ?? []

    expect(notes.map((note) => note.decorations)).toEqual([
      ['fermata'],
      [],
      ['f'],
      ['p'],
    ])
  })
})

// ---------------------------------------------------------------------------
// tie
// ---------------------------------------------------------------------------

describe('AbcToSong – tie', () => {
  const ABC = `X:1
T:Tie Test
M:4/4
L:1/4
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] C- C D E |]
`

  it('first note has tieStart=true', () => {
    const song = transform(ABC)
    const notes = song.voices[0]!.entities.filter((e) => e.type === 'Note')
    const tieStart = notes.find((n) => n.type === 'Note' && n.tieStart)
    expect(tieStart).toBeDefined()
  })

  it('second note has tieEnd=true', () => {
    const song = transform(ABC)
    const notes = song.voices[0]!.entities.filter((e) => e.type === 'Note')
    const tieEnd = notes.find((n) => n.type === 'Note' && n.tieEnd)
    expect(tieEnd).toBeDefined()
  })
})
