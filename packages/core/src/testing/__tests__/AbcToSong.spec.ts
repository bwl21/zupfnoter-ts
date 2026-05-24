/* oxlint-disable jest/no-conditional-expect -- type-narrowing guards are intentional */
/**
 * AbcToSong unit tests.
 *
 * Tests the full ABC → Song transformation for the minimal fixtures.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import type { PlayableEntity, Song } from '@zupfnoter/types'
import type { AbcModel, AbcSymbol } from '../../AbcModel.js'
import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import { defaultTestConfig } from '../defaultConfig.js'
import { readFixtureAbc } from '../fixtureLoader.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../../../..')

function transform(abcText: string) {
  const parser = new AbcParser()
  const model = parser.parse(abcText)
  const transformer = new AbcToSong()
  return transformer.transform(model, defaultTestConfig)
}

function transformWithConfig(abcText: string, config: typeof defaultTestConfig) {
  const parser = new AbcParser()
  const model = parser.parse(abcText)
  const transformer = new AbcToSong()
  return transformer.transform(model, config)
}

function transformWithoutCountBy(abcText: string) {
  const parser = new AbcParser()
  const model = parser.parse(abcText)
  const voice = model.voices[0]
  if (voice) {
    voice.voice_properties.meter.a_meter = []
  }
  const transformer = new AbcToSong()
  return transformer.transform(model, defaultTestConfig)
}

function transformRawDuration(rawDuration: number) {
  const musicTypes = Array.from({ length: 18 }, () => '')
  musicTypes[8] = 'note'
  const model: AbcModel = {
    voices: [{
      voice_properties: {
        id: 'V1',
        meter: { wmeasure: 1536, a_meter: [{ bot: 4, top: 4 }] },
        key: {},
      },
      symbols: [{
        type: 8,
        time: 0,
        dur: rawDuration,
        istart: 0,
        iend: 1,
        notes: [{ midi: 60, dur: rawDuration }],
      }],
    }],
    music_types: musicTypes,
    music_type_ids: { note: 8 },
    info: {},
    checksum: '',
  }
  const transformer = new AbcToSong()
  return transformer.transform(model, defaultTestConfig)
}

function countFromRawDuration(rawDuration: number): string | null | undefined {
  return transformRawDuration(rawDuration)
    .voices[0]?.entities
    .find((entity) => entity.type === 'Note')
    ?.countNote
}

function transformSymbols(symbols: AbcSymbol[]) {
  const musicTypes = Array.from({ length: 18 }, () => '')
  musicTypes[8] = 'note'
  const model: AbcModel = {
    voices: [{
      voice_properties: {
        id: 'V1',
        meter: { wmeasure: 1536, a_meter: [{ bot: 4, top: 4 }] },
        key: {},
      },
      symbols,
    }],
    music_types: musicTypes,
    music_type_ids: { note: 8 },
    info: {},
    checksum: '',
  }
  const transformer = new AbcToSong()
  return transformer.transform(model, defaultTestConfig)
}

interface SlurTupletParityEntity {
  type: string
  time: number
  znId: string
  duration: number
  pitch: number
  slurStartsCount: number
  slurEndsCount: number
  tuplet: number
  tupletStart: boolean
  tupletEnd: boolean
  countNote: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function legacyType(entity: Record<string, unknown>): string {
  const explicitType = entity['type']
  if (typeof explicitType === 'string') return explicitType

  const className = entity['class']
  if (typeof className !== 'string') return ''

  return className.slice(className.lastIndexOf(':') + 1)
}

function normalizeTsSlurTupletParity(song: Song): SlurTupletParityEntity[] {
  const voice = song.voices[1] ?? song.voices[0]
  if (!voice) return []

  return voice.entities
    .filter((entity): entity is PlayableEntity => 'duration' in entity && 'pitch' in entity)
    .map((entity) => ({
      type: entity.type,
      time: entity.time,
      znId: entity.znId,
      duration: entity.duration,
      pitch: entity.pitch,
      slurStartsCount: entity.slurStarts.length,
      slurEndsCount: entity.slurEnds.length,
      tuplet: entity.tuplet,
      tupletStart: entity.tupletStart,
      tupletEnd: entity.tupletEnd,
      countNote: entity.countNote,
    }))
}

function normalizeLegacySlurTupletParity(rawSong: unknown): SlurTupletParityEntity[] {
  if (!isRecord(rawSong)) return []

  const voices = rawSong['voices']
  if (!Array.isArray(voices)) return []

  const voice = voices[1] ?? voices[0]
  if (!Array.isArray(voice)) return []

  return voice
    .filter(isRecord)
    .map((entity) => ({
      type: legacyType(entity),
      time: asNumber(entity['@time']),
      znId: asString(entity['@znid']),
      duration: asNumber(entity['@duration']),
      pitch: asNumber(entity['@pitch']),
      slurStartsCount: arrayLength(entity['@slur_starts']),
      slurEndsCount: arrayLength(entity['@slur_ends']),
      tuplet: asNumber(entity['@tuplet']),
      tupletStart: Boolean(entity['@tuplet_start']),
      tupletEnd: Boolean(entity['@tuplet_end']),
      countNote: asNullableString(entity['@count_note']),
    }))
}

function readLegacyRawSong(fixtureName: string): unknown {
  const path = resolve(REPO_ROOT, 'fixtures/cases', fixtureName, 'song.legacy-raw.json')
  return JSON.parse(readFileSync(path, 'utf-8')) as unknown
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

  it('reports invalid remark znId and uses legacy fallback', () => {
    const song = transform(`X:1
T:Invalid Remark ZnId Test
M:4/4
L:1/4
K:C
%%score (V1)
V:V1 clef=treble-8
r:bad-id
[V:V1] C |]
`)
    const note = song.voices[0]?.entities.find((e) => e.type === 'Note')

    expect(note?.znId).toBe('_bad-id_')
    expect(song.metaData.diagnostics).toEqual([
      {
        severity: 'error',
        message: 'illegal character in [r:] (must be of [a-z][a-z0.9_])',
        startPos: [1, 1],
        endPos: [1, 1],
      },
    ])
  })

  it('uses a valid [r:] remark as znId', () => {
    const song = transform(`X:1
T:Valid Remark ZnId Test
M:4/4
L:1/4
K:C
%%score (V1)
V:V1 clef=treble-8
r:custom_id
[V:V1] C |]
`)
    const note = song.voices[0]?.entities.find((e) => e.type === 'Note')

    expect(note?.znId).toBe('custom_id')
    expect(song.metaData.diagnostics ?? []).toEqual([])
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

  it('applies repeatend=previous to a rest before a repeat end', () => {
    const song = transformWithConfig(`X:1
T:Repeat End Restposition Test
M:4/4
L:1/4
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] |: C z :| D |]
`, {
      ...defaultTestConfig,
      restposition: {
        ...defaultTestConfig.restposition,
        repeatend: 'previous',
      },
    })
    const pause = song.voices[0]?.entities.find((e) => e.type === 'Pause')
    expect(pause?.type).toBe('Pause')
    if (pause?.type === 'Pause') {
      expect(pause.pitch).toBe(48)
    }
  })

  it('marks rests after inline part markers as firstInPart without emitting NewPart entities', () => {
    const song = transform(`X:1
T:Inline Part Rest Test
M:4/4
L:1/4
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] C [P:Rests] z |]
`)
    const pause = song.voices[0]?.entities.find((e) => e.type === 'Pause')
    const partAnnotations = song.voices[0]?.entities.filter((e) => e.type === 'NoteBoundAnnotation') ?? []
    expect(song.voices[0]?.entities.some((e) => e.type === 'NewPart')).toBe(false)
    expect(pause?.type).toBe('Pause')
    expect(partAnnotations).toHaveLength(1)
    expect((partAnnotations[0] as { text?: string } | undefined)?.text).toBe('Rests')
    if (pause?.type === 'Pause') {
      expect(pause.firstInPart).toBe(true)
    }
  })

  it('shares inline part markers across voices via a transformer-global part table', () => {
    const song = transform(`X:1
T:Inline Part Shared Across Voices
M:4/4
L:1/4
K:C
%%score (V1) (V2)
V:V1 clef=treble-8
V:V2 clef=treble-8
[V:V1] [P:Rests] z |]
[V:V2] C |]
`)
    const voice1Playable = song.voices[1]?.entities.find((e) => e.type === 'Pause')
    const voice2Playable = song.voices[2]?.entities.find((e) => e.type === 'Note')
    const voice1Annotations = song.voices[1]?.entities.filter((e) => e.type === 'NoteBoundAnnotation') ?? []
    const voice2Annotations = song.voices[2]?.entities.filter((e) => e.type === 'NoteBoundAnnotation') ?? []
    expect(voice1Playable?.type).toBe('Pause')
    expect(song.voices[1]?.entities.some((e) => e.type === 'NewPart')).toBe(false)
    expect(song.voices[2]?.entities.some((e) => e.type === 'NewPart')).toBe(false)
    expect(voice2Playable?.type).toBe('Note')
    expect(voice1Annotations).toHaveLength(1)
    expect(voice2Annotations).toHaveLength(1)
    expect((voice1Annotations[0] as { text?: string } | undefined)?.text).toBe('Rests')
    expect((voice2Annotations[0] as { text?: string } | undefined)?.text).toBe('Rests')
    if (voice1Playable?.type === 'Pause') {
      expect(voice1Playable.firstInPart).toBe(true)
    }
    if (voice2Playable?.type === 'Note') {
      expect(voice2Playable.firstInPart).toBe(true)
    }
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

// ---------------------------------------------------------------------------
// slur / tuplet
// ---------------------------------------------------------------------------

describe('AbcToSong – slur / tuplet', () => {
  it('matches regenerated legacy output for the focused slur and tuplet fixture', () => {
    const fixtureName = 'abc-to-song-slur-tuplet-parity'
    const song = transform(readFixtureAbc(fixtureName))
    const expected = normalizeLegacySlurTupletParity(readLegacyRawSong(fixtureName))

    expect(normalizeTsSlurTupletParity(song)).toEqual(expected)
  })

  it.each([
    [0x1, [1]],
    [0x11, [1, 2]],
    [0x1111, [1, 2, 3, 4]],
  ])('decodes slur_sls=%s as a legacy bitfield', (slur_sls, expectedStarts) => {
    const song = transformSymbols([{
      type: 8,
      time: 0,
      dur: 384,
      istart: 0,
      iend: 1,
      notes: [{ midi: 60, dur: 384 }],
      // Legacy abc2svg stores slur_sls as 4-bit groups, not as an array.
      slur_sls: slur_sls as unknown as number[],
    }])
    const note = song.voices[0]?.entities.find((entity) => entity.type === 'Note')

    expect(note?.slurStarts).toEqual(expectedStarts)
  })

  it('uses legacy abc2svg tuplet fields for a triplet', () => {
    const song = transformSymbols([
      {
        type: 8,
        time: 0,
        dur: 256,
        istart: 0,
        iend: 1,
        notes: [{ midi: 60, dur: 256 }],
        in_tuplet: true,
        tp: [{ p: 3 }],
      },
      {
        type: 8,
        time: 256,
        dur: 256,
        istart: 2,
        iend: 3,
        notes: [{ midi: 62, dur: 256 }],
        in_tuplet: true,
      },
      {
        type: 8,
        time: 512,
        dur: 256,
        istart: 4,
        iend: 5,
        notes: [{ midi: 65, dur: 256 }],
        in_tuplet: true,
        tpe: true,
      },
    ])
    const notes = song.voices[0]?.entities.filter((entity) => entity.type === 'Note') ?? []

    expect(notes.map((note) => note.tuplet)).toEqual([3, 3, 3])
    expect(notes[0]?.tupletStart).toBe(true)
    expect(notes[0]?.tupletEnd).toBe(false)
    expect(notes[1]?.tupletStart).toBe(false)
    expect(notes[1]?.tupletEnd).toBe(false)
    expect(notes[2]?.tupletStart).toBe(false)
    expect(notes[2]?.tupletEnd).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// countNote
// ---------------------------------------------------------------------------

describe('AbcToSong – countNote', () => {
  it('matches legacy count strings for regular durations', () => {
    expect(countFromRawDuration(384)).toBe('1')
    expect(countFromRawDuration(192)).toBe('1')
    expect(countFromRawDuration(288)).toBe('1-e-u')
  })

  it('applies countNote to Note, SynchPoint and Pause', () => {
    const song = transform(`X:1
T:Count Note Entity Test
M:4/4
L:1/4
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] | [CE] z C |]
`)
    const synchPoint = song.voices[0]?.entities.find((entity) => entity.type === 'SynchPoint')
    const pause = song.voices[0]?.entities.find((entity) => entity.type === 'Pause')
    const note = song.voices[0]?.entities.find((entity) => entity.type === 'Note')

    expect(synchPoint?.countNote).toBe('1')
    expect(pause?.countNote).toBe('2')
    expect(note?.countNote).toBe('3')
  })

  it('uses tra/la for tuplet counts', () => {
    const song = transform(`X:1
T:Tuplet Count Note Test
M:4/4
L:1/4
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] | (3 C D E |]
`)
    const notes = song.voices[0]?.entities.filter((entity) => entity.type === 'Note') ?? []

    expect(notes[0]?.countNote).toBe('tra')
    expect(notes[1]?.countNote).toBe('la')
  })

  it('uses x when meter count base is missing', () => {
    const song = transformWithoutCountBy(`X:1
T:Missing Count Base Test
M:4/4
L:1/4
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] C |]
`)
    const note = song.voices[0]?.entities.find((entity) => entity.type === 'Note')

    expect(note?.countNote).toBe('x')
  })
})
