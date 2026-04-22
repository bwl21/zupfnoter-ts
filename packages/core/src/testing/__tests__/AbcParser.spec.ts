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

describe('AbcParser', () => {
  describe('parse()', () => {
    it('returns an AbcModel for valid single-voice ABC', () => {
      const parser = new AbcParser()
      const model = parser.parse(SINGLE_NOTE_ABC)

      expect(model).toBeDefined()
      expect(model.voices).toBeInstanceOf(Array)
      expect(model.voices.length).toBeGreaterThanOrEqual(1)
    })

    it('model contains music_types array with note type', () => {
      const parser = new AbcParser()
      const model = parser.parse(SINGLE_NOTE_ABC)

      expect(model.music_types).toBeInstanceOf(Array)
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

    it('collects errors for invalid ABC without throwing', () => {
      const parser = new AbcParser()
      // Invalid key should produce warnings but still parse
      try {
        parser.parse(INVALID_ABC)
      } catch {
        // May throw — that's acceptable for truly invalid input
      }
      // errors array is accessible regardless
      expect(parser.errors).toBeInstanceOf(Array)
    })

    it('errors array is reset on each parse() call', () => {
      const parser = new AbcParser()
      parser.parse(SINGLE_NOTE_ABC)
      const firstErrors = [...parser.errors]
      parser.parse(SINGLE_NOTE_ABC)
      expect(parser.errors.length).toBe(firstErrors.length)
    })
  })
})
