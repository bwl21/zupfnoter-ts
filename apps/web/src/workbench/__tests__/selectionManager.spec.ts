import { describe, expect, it } from 'vitest'

import type { PlaybackHighlight, SelectionState, SheetObjectIndex } from '@zupfnoter/types'

import {
  canTargetCreateSelection,
  getSelectionTargetCapabilities,
  registerSelectionTargetCapabilities,
  resolvePlaybackProjection,
  resolvePlaybackScoreRanges,
  resolveSelectionProjection,
} from '../selectionManager'

const sheetObjectIndex: SheetObjectIndex = {
  version: 1,
  lineStarts: [0, 4, 9],
  voiceByLine: {
    1: undefined,
    2: '1',
    3: '2',
  },
  byZnId: {
    'note-1': [0, 2],
    'note-3': [3, 4, 5, 6],
  },
  byConfKey: {
    'extract.0.note-1': [2],
    'extract.0.notebound.nconf.v_1.t_384.n_0.***': [5],
    'extract.0.notebound.nconf.v_2.t_384.n_0.***': [6],
  },
  byTextRange: {
    '4:6': [0, 1, 2],
    '10:12': [3, 4, 5, 6],
  },
  byMusicTime: {
    '64': [0],
    '128': [4],
  },
  entries: [
    {
      kind: 'music-entity',
      znId: 'note-1',
      voiceId: '1',
      musicTime: 64,
      textRange: { startpos: 4, endpos: 6 },
      startPos: { line: 2, column: 1 },
      endPos: { line: 2, column: 3 },
      addressableIn: { editor: true, score: true, svg: true },
    },
    {
      kind: 'score-object',
      textRange: { startpos: 4, endpos: 6 },
      startPos: { line: 2, column: 1 },
      endPos: { line: 2, column: 3 },
      addressableIn: { editor: true, score: true, svg: false },
    },
    {
      kind: 'sheet-object',
      znId: 'note-1',
      confKey: 'extract.0.note-1',
      addressableIn: { editor: false, score: false, svg: true },
    },
    {
      kind: 'score-object',
      textRange: { startpos: 10, endpos: 12 },
      startPos: { line: 2, column: 6 },
      endPos: { line: 2, column: 8 },
      addressableIn: { editor: true, score: true, svg: false },
    },
    {
      kind: 'music-entity',
      znId: 'note-3',
      voiceId: '1',
      musicTime: 128,
      textRange: { startpos: 10, endpos: 12 },
      startPos: { line: 2, column: 6 },
      endPos: { line: 2, column: 8 },
      addressableIn: { editor: true, score: true, svg: true },
    },
    {
      kind: 'sheet-object',
      znId: 'note-3',
      confKey: 'extract.0.notebound.nconf.v_1.t_384.n_0.***',
      addressableIn: { editor: false, score: false, svg: true },
    },
    {
      kind: 'sheet-object',
      znId: 'note-3',
      confKey: 'extract.0.notebound.nconf.v_2.t_384.n_0.***',
      addressableIn: { editor: false, score: false, svg: true },
    },
  ],
}

describe('selectionManager', () => {
  it('filters projections by target capabilities', () => {
    const selection: SelectionState = {
      selectedIndexes: [1],
      baseSelectedIndexes: [1],
      source: 'abc-editor',
      voiceScope: 'single-voice',
    }

    expect(resolveSelectionProjection(sheetObjectIndex, selection, 'score-preview'))
      .toEqual({
        selectedIndexes: [1],
        textRanges: [{ startpos: 4, endpos: 6 }],
        znIds: [],
        confKeys: [],
      })

    expect(resolveSelectionProjection(sheetObjectIndex, selection, 'harp-preview'))
      .toEqual({
        selectedIndexes: [1],
        textRanges: [{ startpos: 4, endpos: 6 }],
        znIds: [],
        confKeys: [],
      })
  })

  it('keeps editor-driven harp projections on a single voice by default', () => {
    const selection: SelectionState = {
      selectedIndexes: [3],
      baseSelectedIndexes: [3],
      source: 'abc-editor',
      voiceScope: 'single-voice',
    }

    expect(resolveSelectionProjection(sheetObjectIndex, selection, 'harp-preview'))
      .toEqual({
        selectedIndexes: [3],
        textRanges: [{ startpos: 10, endpos: 12 }],
        znIds: [],
        confKeys: [],
      })
  })

  it('can explicitly project editor-driven selections across all matching voices', () => {
    const selection: SelectionState = {
      selectedIndexes: [3],
      baseSelectedIndexes: [3],
      source: 'abc-editor',
      voiceScope: 'all-voices',
    }

    expect(resolveSelectionProjection(sheetObjectIndex, selection, 'harp-preview', {
      voiceScope: 'all-voices',
    })).toEqual({
      selectedIndexes: [3],
      textRanges: [{ startpos: 10, endpos: 12 }],
      znIds: [],
      confKeys: [
        'extract.0.notebound.nconf.v_1.t_384.n_0.***',
        'extract.0.notebound.nconf.v_2.t_384.n_0.***',
      ],
    })
  })

  it('can explicitly project editor-driven score selections across all matching voices', () => {
    const selection: SelectionState = {
      selectedIndexes: [3],
      baseSelectedIndexes: [3],
      source: 'abc-editor',
      voiceScope: 'all-voices',
    }

    expect(resolveSelectionProjection(sheetObjectIndex, selection, 'score-preview', {
      voiceScope: 'all-voices',
    })).toEqual({
      selectedIndexes: [3],
      textRanges: [{ startpos: 10, endpos: 12 }],
      znIds: [],
      confKeys: [],
    })
  })

  it('can project editor-driven selections only across active extract voices', () => {
    const selection: SelectionState = {
      selectedIndexes: [3],
      baseSelectedIndexes: [3],
      source: 'abc-editor',
      voiceScope: 'extract-voices',
    }

    expect(resolveSelectionProjection(sheetObjectIndex, selection, 'harp-preview', {
      voiceScope: 'extract-voices',
      activeVoiceIds: ['2'],
    })).toEqual({
      selectedIndexes: [3],
      textRanges: [{ startpos: 10, endpos: 12 }],
      znIds: [],
      confKeys: [
        'extract.0.notebound.nconf.v_2.t_384.n_0.***',
      ],
    })
  })

  it('projects extract-scoped score selections across different source ranges that share the same music time', () => {
    const scoreScopedIndex: SheetObjectIndex = {
      version: 2,
      lineStarts: [0, 4, 9, 14],
      voiceByLine: {
        1: undefined,
        2: '1',
        3: '2',
        4: '2',
      },
      byZnId: {
        'note-a': [0],
        'note-b': [2],
      },
      byConfKey: {},
      byTextRange: {
        '4:6': [0, 1],
        '10:12': [2, 3],
      },
      byMusicTime: {
        '128': [0, 2],
      },
      entries: [
        {
          kind: 'music-entity',
          znId: 'note-a',
          voiceId: '1',
          musicTime: 128,
          textRange: { startpos: 4, endpos: 6 },
          startPos: { line: 2, column: 1 },
          endPos: { line: 2, column: 3 },
          addressableIn: { editor: true, score: true, svg: true },
        },
        {
          kind: 'score-object',
          textRange: { startpos: 4, endpos: 6 },
          startPos: { line: 2, column: 1 },
          endPos: { line: 2, column: 3 },
          addressableIn: { editor: true, score: true, svg: false },
        },
        {
          kind: 'music-entity',
          znId: 'note-b',
          voiceId: '2',
          musicTime: 128,
          textRange: { startpos: 10, endpos: 12 },
          startPos: { line: 3, column: 1 },
          endPos: { line: 3, column: 3 },
          addressableIn: { editor: true, score: true, svg: true },
        },
        {
          kind: 'score-object',
          textRange: { startpos: 10, endpos: 12 },
          startPos: { line: 3, column: 1 },
          endPos: { line: 3, column: 3 },
          addressableIn: { editor: true, score: true, svg: false },
        },
      ],
    }
    const selection: SelectionState = {
      selectedIndexes: [1],
      baseSelectedIndexes: [1],
      source: 'score-preview',
      voiceScope: 'extract-voices',
    }

    expect(resolveSelectionProjection(scoreScopedIndex, selection, 'score-preview', {
      voiceScope: 'extract-voices',
      activeVoiceIds: ['1', '2'],
    })).toEqual({
      selectedIndexes: [1],
      textRanges: [
        { startpos: 4, endpos: 6 },
        { startpos: 10, endpos: 12 },
      ],
      znIds: [],
      confKeys: [],
    })
  })

  it('resolves playback projections separately from selection projections', () => {
    const highlight: PlaybackHighlight = {
      activeTextRanges: [
        { startpos: 4, endpos: 6 },
        { startpos: 10, endpos: 12 },
      ],
    }

    expect(resolvePlaybackProjection(sheetObjectIndex, highlight, 'harp-preview'))
      .toEqual({
        activeTextRanges: [
          { startpos: 4, endpos: 6 },
          { startpos: 10, endpos: 12 },
        ],
      })

    expect(resolvePlaybackProjection(sheetObjectIndex, highlight, 'abc-editor'))
      .toEqual({
        activeTextRanges: [
          { startpos: 4, endpos: 6 },
          { startpos: 10, endpos: 12 },
        ],
      })

    expect(resolvePlaybackScoreRanges(sheetObjectIndex, highlight))
      .toEqual([
        { startpos: 4, endpos: 6 },
        { startpos: 10, endpos: 12 },
      ])
  })

  it('supports explicit capability registration', () => {
    const originalCapabilities = getSelectionTargetCapabilities('player')
    registerSelectionTargetCapabilities('player', {
      reads: ['textRange'],
      writes: [],
    })

    try {
      expect(canTargetCreateSelection('player', 'znId')).toBe(false)
      expect(resolvePlaybackProjection(sheetObjectIndex, {
        activeTextRanges: [{ startpos: 4, endpos: 6 }],
      }, 'player')).toEqual({
        activeTextRanges: [{ startpos: 4, endpos: 6 }],
      })
    } finally {
      registerSelectionTargetCapabilities('player', originalCapabilities)
    }
  })
})
