/**
 * Unit tests for buildNewlineIndex and charposToLineCol.
 *
 * These are pure functions exported from AbcToSong.ts.
 * Also includes an integration test verifying that startPos/endPos on
 * parsed entities are no longer the [1,1] placeholder.
 */
import { describe, it, expect } from 'vitest'
import { buildNewlineIndex, charposToLineCol } from '../../AbcToSong.js'
import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import { defaultTestConfig } from '../defaultConfig.js'

// ---------------------------------------------------------------------------
// buildNewlineIndex
// ---------------------------------------------------------------------------

describe('buildNewlineIndex', () => {
  it('returns empty array for text with no newlines', () => {
    expect(buildNewlineIndex('ABC')).toEqual([])
  })

  it('returns offset of single newline', () => {
    expect(buildNewlineIndex('AB\nCD')).toEqual([2])
  })

  it('returns offsets of multiple newlines', () => {
    expect(buildNewlineIndex('A\nB\nC')).toEqual([1, 3])
  })

  it('handles leading newline', () => {
    expect(buildNewlineIndex('\nABC')).toEqual([0])
  })

  it('handles trailing newline', () => {
    expect(buildNewlineIndex('ABC\n')).toEqual([3])
  })

  it('handles consecutive newlines', () => {
    expect(buildNewlineIndex('A\n\nB')).toEqual([1, 2])
  })

  it('returns empty array for empty string', () => {
    expect(buildNewlineIndex('')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// charposToLineCol
// ---------------------------------------------------------------------------

describe('charposToLineCol', () => {
  // Text: "ABC\nDEF\nGHI"
  //        0123 4567 89A
  // Newlines at: 3, 7
  const text = 'ABC\nDEF\nGHI'
  const idx = buildNewlineIndex(text)

  it('offset 0 → line 1, col 1', () => {
    expect(charposToLineCol(0, idx)).toEqual([1, 1])
  })

  it('offset 2 → line 1, col 3 (last char of first line)', () => {
    expect(charposToLineCol(2, idx)).toEqual([1, 3])
  })

  it('offset 3 → line 1, col 4 (the newline itself)', () => {
    expect(charposToLineCol(3, idx)).toEqual([1, 4])
  })

  it('offset 4 → line 2, col 1 (first char after first newline)', () => {
    expect(charposToLineCol(4, idx)).toEqual([2, 1])
  })

  it('offset 7 → line 2, col 4 (second newline)', () => {
    expect(charposToLineCol(7, idx)).toEqual([2, 4])
  })

  it('offset 8 → line 3, col 1 (first char of third line)', () => {
    expect(charposToLineCol(8, idx)).toEqual([3, 1])
  })

  it('offset 10 → line 3, col 3 (last char)', () => {
    expect(charposToLineCol(10, idx)).toEqual([3, 3])
  })

  it('single-line text: offset 0 → [1, 1]', () => {
    expect(charposToLineCol(0, [])).toEqual([1, 1])
  })

  it('single-line text: offset 5 → [1, 6]', () => {
    expect(charposToLineCol(5, [])).toEqual([1, 6])
  })
})

// ---------------------------------------------------------------------------
// Integration: startPos/endPos are no longer [1,1] placeholders
// ---------------------------------------------------------------------------

describe('AbcToSong – startPos/endPos', () => {
  const ABC = `X:1
T:LineCol Test
M:4/4
L:1/4
K:C
C D E F |]
`

  it('note startPos is not the [1,1] placeholder', () => {
    const model = new AbcParser().parse(ABC)
    const song = new AbcToSong().transform(model, defaultTestConfig)
    const note = song.voices[0]?.entities.find((e) => e.type === 'Note')
    expect(note).toBeDefined()
    if (note?.type === 'Note') {
      // The note "C" is on line 6 of the ABC text — definitely not line 1
      expect(note.startPos[0]).toBeGreaterThan(1)
    }
  })

  it('note startPos column is 1-based and positive', () => {
    const model = new AbcParser().parse(ABC)
    const song = new AbcToSong().transform(model, defaultTestConfig)
    const note = song.voices[0]?.entities.find((e) => e.type === 'Note')
    if (note?.type === 'Note') {
      expect(note.startPos[1]).toBeGreaterThanOrEqual(1)
    }
  })

  it('note endPos >= startPos', () => {
    const model = new AbcParser().parse(ABC)
    const song = new AbcToSong().transform(model, defaultTestConfig)
    const note = song.voices[0]?.entities.find((e) => e.type === 'Note')
    if (note?.type === 'Note') {
      const [startLine, startCol] = note.startPos
      const [endLine, endCol] = note.endPos
      const startFlat = startLine * 10000 + startCol
      const endFlat = endLine * 10000 + endCol
      expect(endFlat).toBeGreaterThanOrEqual(startFlat)
    }
  })

  it('model.abcText is populated by AbcParser', () => {
    const model = new AbcParser().parse(ABC)
    expect(model.abcText).toBe(ABC)
  })
})
