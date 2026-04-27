/**
 * Unit-Tests für BeatPacker (Phase 3.2).
 *
 * Testet:
 * - computeBeatCompression() mit allen pack_methods (0, 1, 2, 3, 10)
 * - Monotonie der Ausgabe
 * - Taktanfang-Bonus (method 0)
 * - Default-Fallback auf method 0
 * - prevPitch/nextPitch auf Playables (AbcToSong-Integration)
 */

import { describe, it, expect } from 'vitest'
import { computeBeatCompression } from '../../BeatPacker.js'
import { Confstack } from '../../Confstack.js'
import type { Song, Voice, Note, PlayableEntity } from '@zupfnoter/types'
import type { DurationKey, DurationStyle } from '@zupfnoter/types'

// ---------------------------------------------------------------------------
// Test-Hilfsfunktionen
// ---------------------------------------------------------------------------

const DURATION_TO_STYLE: Record<DurationKey, DurationStyle> = {
  err: { sizeFactor: 2,    fill: 'filled', dotted: false },
  d64: { sizeFactor: 1,    fill: 'empty',  dotted: false },
  d48: { sizeFactor: 0.75, fill: 'empty',  dotted: true  },
  d32: { sizeFactor: 0.75, fill: 'empty',  dotted: false },
  d24: { sizeFactor: 0.75, fill: 'filled', dotted: true  },
  d16: { sizeFactor: 0.75, fill: 'filled', dotted: false },
  d12: { sizeFactor: 0.5,  fill: 'filled', dotted: true  },
  d8:  { sizeFactor: 0.5,  fill: 'filled', dotted: false },
  d6:  { sizeFactor: 0.3,  fill: 'filled', dotted: true  },
  d4:  { sizeFactor: 0.3,  fill: 'filled', dotted: false },
  d3:  { sizeFactor: 0.1,  fill: 'filled', dotted: true  },
  d2:  { sizeFactor: 0.1,  fill: 'filled', dotted: false },
  d1:  { sizeFactor: 0.05, fill: 'filled', dotted: false },
}

const BEAT_RESOLUTION = 384

function makeConf(packMethod: 0 | 1 | 2 | 3 | 10 = 0): Confstack {
  const conf = new Confstack()
  conf.push({
    layout: {
      DURATION_TO_STYLE,
      BEAT_RESOLUTION,
      packer: {
        pack_method: packMethod,
        pack_min_increment: 0,
        pack_max_spreadfactor: 1,
      },
    },
    notebound: { minc: {} },
  })
  return conf
}

/** Erstellt eine minimale Note für Tests. */
function makeNote(beat: number, duration: number, opts: Partial<Note> = {}): Note {
  return {
    type: 'Note',
    beat,
    time: beat * 10,
    duration,
    pitch: 60,
    startPos: [0, 0],
    endPos: [0, 1],
    decorations: [],
    barDecorations: [],
    visible: true,
    variant: 0,
    znId: '',
    tieStart: false,
    tieEnd: false,
    tuplet: 1,
    tupletStart: false,
    tupletEnd: false,
    firstInPart: false,
    measureStart: false,
    measureCount: 0,
    jumpStarts: [],
    jumpEnds: [],
    slurStarts: [],
    slurEnds: [],
    countNote: null,
    lyrics: null,
    ...opts,
  }
}

/** Erstellt einen minimalen Song mit einer Stimme. */
function makeSong(notes: PlayableEntity[]): Song {
  const voice: Voice = {
    index: 0,
    name: 'V1',
    showVoice: true,
    showFlowline: true,
    showJumpline: true,
    entities: notes,
  }
  return {
    voices: [voice],
    beatMaps: [{ index: 0, entries: Object.fromEntries(notes.map(n => [n.beat, n])) }],
    metaData: {},
  }
}

// ---------------------------------------------------------------------------
// Pack-Methode 2 – Linear
// ---------------------------------------------------------------------------

describe('computeBeatCompression – method 2 (linear)', () => {
  it('gibt beat * 8 zurück', () => {
    const notes = [
      makeNote(0, 96),
      makeNote(96, 96),
      makeNote(192, 96),
    ]
    const song = makeSong(notes)
    const conf = makeConf(2)
    const result = computeBeatCompression(song, [0], conf)

    expect(result[0]).toBe(0)
    expect(result[96]).toBe(96 * 8)
    expect(result[192]).toBe(192 * 8)
  })

  it('enthält nur Beats aus layoutLines', () => {
    const voice0 = [makeNote(0, 96), makeNote(96, 96)]
    const voice1 = [makeNote(200, 96)]
    const song: Song = {
      voices: [
        { index: 0, name: 'V1', showVoice: true, showFlowline: true, showJumpline: true, entities: voice0 },
        { index: 1, name: 'V2', showVoice: true, showFlowline: true, showJumpline: true, entities: voice1 },
      ],
      beatMaps: [],
      metaData: {},
    }
    const conf = makeConf(2)
    const result = computeBeatCompression(song, [0], conf)
    expect(result[200]).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Pack-Methode 0 – Standard
// ---------------------------------------------------------------------------

describe('computeBeatCompression – method 0 (standard)', () => {
  it('Positionen wachsen monoton', () => {
    const notes = [
      makeNote(0,   96),
      makeNote(96,  96),
      makeNote(192, 96),
      makeNote(288, 96),
    ]
    const song = makeSong(notes)
    const conf = makeConf(0)
    const result = computeBeatCompression(song, [0], conf)

    const positions = Object.keys(result).map(Number).sort((a, b) => a - b).map(k => result[k]!)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]!)
    }
  })

  it('Taktanfang hat größeren Abstand als normale Note', () => {
    const notes = [
      makeNote(0,   96),
      makeNote(96,  96),
      makeNote(192, 96, { measureStart: true }),
      makeNote(288, 96),
    ]
    const song = makeSong(notes)
    const conf = makeConf(0)
    const result = computeBeatCompression(song, [0], conf)

    const gap01 = result[96]!  - result[0]!
    const gap12 = result[192]! - result[96]!
    const gap23 = result[288]! - result[192]!

    expect(gap12).toBeGreaterThan(gap01)  // Taktanfang hat Bonus
    expect(gap23).toBeLessThan(gap12)     // danach wieder normal
  })

  it('neuer Part hat größeren Abstand als Taktanfang', () => {
    const notes = [
      makeNote(0,   96),
      makeNote(96,  96, { measureStart: true }),
      makeNote(192, 96, { firstInPart: true }),
    ]
    const song = makeSong(notes)
    const conf = makeConf(0)
    const result = computeBeatCompression(song, [0], conf)

    const gapMeasure = result[96]!  - result[0]!
    const gapPart    = result[192]! - result[96]!

    expect(gapPart).toBeGreaterThan(gapMeasure)
  })

  it('ist Default wenn pack_method nicht gesetzt', () => {
    const conf = new Confstack()
    conf.push({
      layout: {
        DURATION_TO_STYLE,
        BEAT_RESOLUTION,
        packer: { pack_method: 0 },
      },
      notebound: { minc: {} },
    })
    const notes = [makeNote(0, 96), makeNote(96, 96)]
    const song = makeSong(notes)
    const result0 = computeBeatCompression(song, [0], conf)

    const confDefault = new Confstack()
    confDefault.push({
      layout: {
        DURATION_TO_STYLE,
        BEAT_RESOLUTION,
        packer: {},
      },
      notebound: { minc: {} },
    })
    const resultDefault = computeBeatCompression(song, [0], confDefault)

    expect(result0).toEqual(resultDefault)
  })

  it('größere Noten erzeugen größere Abstände', () => {
    const notesSmall = [makeNote(0, 8), makeNote(8, 8)]
    const notesLarge = [makeNote(0, 96), makeNote(96, 96)]
    const songSmall = makeSong(notesSmall)
    const songLarge = makeSong(notesLarge)
    const conf = makeConf(0)

    const resultSmall = computeBeatCompression(songSmall, [0], conf)
    const resultLarge = computeBeatCompression(songLarge, [0], conf)

    const gapSmall = resultSmall[8]!  - resultSmall[0]!
    const gapLarge = resultLarge[96]! - resultLarge[0]!

    expect(gapLarge).toBeGreaterThan(gapSmall)
  })
})

// ---------------------------------------------------------------------------
// Pack-Methode 10 – Legacy Standard
// ---------------------------------------------------------------------------

describe('computeBeatCompression – method 10 (legacy standard)', () => {
  it('Positionen wachsen monoton', () => {
    const notes = [
      makeNote(0,   96),
      makeNote(96,  96),
      makeNote(192, 96),
    ]
    const song = makeSong(notes)
    const conf = makeConf(10)
    const result = computeBeatCompression(song, [0], conf)

    const positions = Object.keys(result).map(Number).sort((a, b) => a - b).map(k => result[k]!)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]!)
    }
  })
})

// ---------------------------------------------------------------------------
// Pack-Methode 1 – Collision
// ---------------------------------------------------------------------------

describe('computeBeatCompression – method 1 (collision)', () => {
  it('Positionen wachsen monoton bei Kollisionen', () => {
    // Gleicher Pitch auf aufeinanderfolgenden Beats → Kollision → Abstand > 0
    const notes = [
      makeNote(0,   96, { pitch: 60 }),
      makeNote(96,  96, { pitch: 60 }),  // gleicher Pitch → Kollision
      makeNote(192, 96, { pitch: 60 }),  // gleicher Pitch → Kollision
    ]
    const song = makeSong(notes)
    const conf = makeConf(1)
    const result = computeBeatCompression(song, [0], conf)

    const positions = Object.keys(result).map(Number).sort((a, b) => a - b).map(k => result[k]!)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]!)
    }
  })

  it('Positionen wachsen monoton mit pack_min_increment > 0', () => {
    const conf = new Confstack()
    conf.push({
      layout: {
        DURATION_TO_STYLE,
        BEAT_RESOLUTION,
        packer: { pack_method: 1, pack_min_increment: 0.5 },
      },
      notebound: { minc: {} },
    })
    const notes = [
      makeNote(0,   96, { pitch: 60, prevPitch: undefined, nextPitch: 62 }),
      makeNote(96,  96, { pitch: 62, prevPitch: 60, nextPitch: 64 }),
      makeNote(192, 96, { pitch: 64, prevPitch: 62, nextPitch: undefined }),
    ]
    const song = makeSong(notes)
    const result = computeBeatCompression(song, [0], conf)

    const positions = Object.keys(result).map(Number).sort((a, b) => a - b).map(k => result[k]!)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]!)
    }
  })
})

// ---------------------------------------------------------------------------
// Pack-Methode 3 – Collision v2
// ---------------------------------------------------------------------------

describe('computeBeatCompression – method 3 (collision v2)', () => {
  it('Positionen wachsen monoton bei Kollisionen', () => {
    // Gleicher Pitch auf aufeinanderfolgenden Beats → Kollision → Abstand > 0
    const notes = [
      makeNote(0,   96, { pitch: 60 }),
      makeNote(96,  96, { pitch: 60 }),  // gleicher Pitch → Kollision
      makeNote(192, 96, { pitch: 60 }),  // gleicher Pitch → Kollision
    ]
    const song = makeSong(notes)
    const conf = makeConf(3)
    const result = computeBeatCompression(song, [0], conf)

    const positions = Object.keys(result).map(Number).sort((a, b) => a - b).map(k => result[k]!)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]!)
    }
  })

  it('Positionen wachsen monoton mit pack_min_increment > 0', () => {
    const conf = new Confstack()
    conf.push({
      layout: {
        DURATION_TO_STYLE,
        BEAT_RESOLUTION,
        packer: { pack_method: 3, pack_min_increment: 0.5 },
      },
      notebound: { minc: {} },
    })
    const notes = [
      makeNote(0,   96, { pitch: 60, prevPitch: undefined, nextPitch: 62 }),
      makeNote(96,  96, { pitch: 62, prevPitch: 60, nextPitch: 64 }),
      makeNote(192, 96, { pitch: 64, prevPitch: 62, nextPitch: undefined }),
    ]
    const song = makeSong(notes)
    const result = computeBeatCompression(song, [0], conf)

    const positions = Object.keys(result).map(Number).sort((a, b) => a - b).map(k => result[k]!)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]!)
    }
  })
})

// ---------------------------------------------------------------------------
// prevPitch/nextPitch – AbcToSong-Integration
// ---------------------------------------------------------------------------

describe('prevPitch/nextPitch auf Playables', () => {
  it('AbcParser befüllt prevPitch/nextPitch', async () => {
    const { AbcParser } = await import('../../AbcParser.js')
    const { AbcToSong } = await import('../../AbcToSong.js')
    const { defaultTestConfig } = await import('../defaultConfig.js')

    const abc = `X:1\nT:Test\nM:4/4\nL:1/4\nK:C\nC D E F|`
    const parser = new AbcParser()
    const model = parser.parse(abc)
    const transformer = new AbcToSong()
    const song = transformer.transform(model, defaultTestConfig)

    const playables = song.voices[0]!.entities.filter(
      (e): e is PlayableEntity => 'pitch' in e && 'duration' in e,
    )

    // Erste Note hat kein prevPitch, aber nextPitch
    expect(playables[0]!.prevPitch).toBeUndefined()
    expect(playables[0]!.nextPitch).toBeDefined()

    // Mittlere Note hat beide
    expect(playables[1]!.prevPitch).toBeDefined()
    expect(playables[1]!.nextPitch).toBeDefined()

    // Letzte Note hat prevPitch, aber kein nextPitch
    const last = playables[playables.length - 1]!
    expect(last.prevPitch).toBeDefined()
    expect(last.nextPitch).toBeUndefined()
  })
})
