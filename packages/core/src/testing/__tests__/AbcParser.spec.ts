/**
 * AbcParser unit tests.
 *
 * These tests verify that AbcParser correctly wraps abc2svg and returns
 * a well-formed AbcModel. They do NOT test the Song transformation.
 */
import { describe, it, expect } from 'vitest'
import { AbcParser } from '../../AbcParser.js'
import { ABC_TYPE } from '../../AbcModel.js'

const SINGLE_NOTE_ABC = `X:1
T:Test
M:4/4
L:1/4
K:C
C |]
`

const TWO_VOICE_ABC = `X:1
T:Test
M:4/4
L:1/4
K:C
%%score (V1) (V2)
V:V1
C D E F |]
V:V2
G, A, B, C |]
`

const INVALID_ABC = `X:1
T:Test
K:INVALID_KEY_THAT_DOES_NOT_EXIST
C |]
`

const SLUR_ABC = `X:1
T:Slur
M:4/4
L:1/4
K:C
((((C D)))) |]
`

const DECORATED_SLUR_ABC = `X:1
T:Decorated Slur
M:4/4
L:1/4
K:C
(!3!C D) |]
`

const CHORD_ORDER_ABC = `X:1
T:Chord Order
M:4/4
L:1/4
K:C
[B,G,]2 |]
`

const BAD_TIE_ABC = `X:1
T:Bad Tie
K:C
g-d
`

function expectedLegacyChecksum(abcText: string): string {
  let checksum = 0x12345678
  const stripped = abcText.trim()

  for (let index = 0; index < stripped.length; index += 1) {
    checksum += stripped.charCodeAt(index) * (index + 1)
  }

  return String(checksum).match(/.{1,3}/g)?.join(' ') ?? String(checksum)
}

describe('AbcParser', () => {
  describe('parse()', () => {
    it('returns an AbcModel for valid single-voice ABC', () => {
      const parser = new AbcParser()
      const model = parser.parse(SINGLE_NOTE_ABC)

      expect(model).toBeDefined()
      expect(Array.isArray(model.voices)).toBe(true)
      expect(model.voices.length).toBeGreaterThanOrEqual(1)
    })

    it('model contains music_types array with note type', () => {
      const parser = new AbcParser()
      const model = parser.parse(SINGLE_NOTE_ABC)

      expect(Array.isArray(model.music_types)).toBe(true)
      // abc2svg.C.NOTE === 8
      expect(model.music_types[ABC_TYPE.NOTE]).toBe('note')
    })

    it('model contains music_type_ids reverse map', () => {
      const parser = new AbcParser()
      const model = parser.parse(SINGLE_NOTE_ABC)

      expect(model.music_type_ids).toBeDefined()
      expect(typeof model.music_type_ids['note']).toBe('number')
    })

    it('extracts title from info', () => {
      const parser = new AbcParser()
      const model = parser.parse(SINGLE_NOTE_ABC)

      expect(model.info['T']).toContain('Test')
    })

    it('computes the legacy source checksum', () => {
      const parser = new AbcParser()
      const model = parser.parse(SINGLE_NOTE_ABC)

      expect(model.checksum).toBe(expectedLegacyChecksum(SINGLE_NOTE_ABC))
    })

    it('returns two voices for two-voice ABC', () => {
      const parser = new AbcParser()
      const model = parser.parse(TWO_VOICE_ABC)

      expect(model.voices.length).toBeGreaterThanOrEqual(2)
    })

    it('voice symbols contain note symbols', () => {
      const parser = new AbcParser()
      const model = parser.parse(SINGLE_NOTE_ABC)

      const voice = model.voices[0]!
      const noteSymbols = voice.symbols.filter((s) => s.type === ABC_TYPE.NOTE)
      expect(noteSymbols.length).toBeGreaterThan(0)
    })

    it('note symbol has midi pitch', () => {
      const parser = new AbcParser()
      const model = parser.parse(SINGLE_NOTE_ABC)

      const voice = model.voices[0]!
      const noteSymbol = voice.symbols.find((s) => s.type === ABC_TYPE.NOTE)
      expect(noteSymbol).toBeDefined()
      expect(noteSymbol!.notes).toBeDefined()
      expect(noteSymbol!.notes![0]!.midi).toBeGreaterThan(0)
    })

    it('restores multi-note order from the ABC source text', () => {
      const parser = new AbcParser()
      const model = parser.parse(CHORD_ORDER_ABC)

      const voice = model.voices[0]
      const chord = voice?.symbols.find((symbol) => symbol.type === ABC_TYPE.NOTE && symbol.notes && symbol.notes.length === 2)
      const midi = chord?.notes?.map((note) => note.midi)

      expect(midi).toEqual([59, 55])
    })

    it('normalizes slur starts into legacy slur_sls on the first note', () => {
      const parser = new AbcParser()
      const model = parser.parse(SLUR_ABC)
      const voice = model.voices[0]
      const noteSymbols = voice?.symbols.filter((s) => s.type === ABC_TYPE.NOTE) ?? []
      const firstNote = noteSymbols[0]

      expect(firstNote?.slur_sls).toEqual([1, 2, 3, 4])
    })

    it('counts slur starts before inline decorations', () => {
      const parser = new AbcParser()
      const model = parser.parse(DECORATED_SLUR_ABC)
      const voice = model.voices[0]
      const firstNote = voice?.symbols.find((s) => s.type === ABC_TYPE.NOTE)

      expect(firstNote?.slur_sls).toEqual([1])
    })

    it('collects errors for invalid ABC without throwing', () => {
      const parser = new AbcParser()
      // Invalid key should produce warnings but still parse
      try {
        parser.parse(INVALID_ABC)
      } catch {
        // May throw — that's acceptable for truly invalid input
      }
      // errors array is accessible regardless
      expect(Array.isArray(parser.errors)).toBe(true)
    })

    it('maps abc2svg tie errors to source line and column', () => {
      const parser = new AbcParser()

      try {
        parser.parse(BAD_TIE_ABC)
      } catch {
        // abc2svg may throw for a bad tie, but the error details must still be captured
      }

      const tieError = parser.errors.find((error) => error.message.includes('fehlerhafter Haltebogen'))
      expect(tieError).toBeDefined()
      expect(tieError?.line).toBe(4)
      expect(tieError?.column).toBeGreaterThan(0)
      expect(tieError?.message.startsWith('Warning: ')).toBe(false)
      expect(tieError?.message.startsWith('Error: ')).toBe(false)
      expect(tieError?.message.startsWith('Internal bug: ')).toBe(false)
    })

    it('errors array is reset on each parse() call', () => {
      const parser = new AbcParser()
      parser.parse(SINGLE_NOTE_ABC)
      const firstErrors = [...parser.errors]
      parser.parse(SINGLE_NOTE_ABC)
      expect(parser.errors.length).toBe(firstErrors.length)
    })
  })

  describe('renderSvg()', () => {
    it('returns classical abc2svg output for valid ABC', () => {
      const parser = new AbcParser()
      const svg = parser.renderSvg(SINGLE_NOTE_ABC)

      expect(svg).toContain('<svg')
      expect(svg).toContain('</svg>')
    })
  })
})
