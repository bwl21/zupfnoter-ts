import { describe, expect, it } from 'vitest'

import type { SelectionState, SheetObjectIndex } from '@zupfnoter/types'

import { resolvePlaybackSteps, type PlaybackStep } from '../playback'

const timeline: PlaybackStep[] = [
  {
    originZnIds: ['note-a-1'],
    activeTextRanges: [{ startpos: 0, endpos: 1 }],
    activeNotes: [],
    activeTime: '0',
    playbackStartMs: 0,
    durationMs: 120,
    sourceTime: 0,
    flowIndex: 0,
    passIndex: 1,
  },
  {
    originZnIds: ['note-b-1'],
    activeTextRanges: [{ startpos: 2, endpos: 3 }],
    activeNotes: [],
    activeTime: '1',
    playbackStartMs: 120,
    durationMs: 120,
    sourceTime: 1,
    flowIndex: 1,
    passIndex: 1,
  },
  {
    originZnIds: ['note-c'],
    activeTextRanges: [{ startpos: 4, endpos: 5 }],
    activeNotes: [],
    activeTime: '2',
    playbackStartMs: 240,
    durationMs: 120,
    sourceTime: 2,
    flowIndex: 2,
    passIndex: 1,
    voltaNumber: 1,
  },
  {
    originZnIds: ['note-a-2'],
    activeTextRanges: [{ startpos: 0, endpos: 1 }],
    activeNotes: [],
    activeTime: '0',
    playbackStartMs: 360,
    durationMs: 120,
    sourceTime: 0,
    flowIndex: 3,
    passIndex: 2,
  },
  {
    originZnIds: ['note-b-2'],
    activeTextRanges: [{ startpos: 2, endpos: 3 }],
    activeNotes: [],
    activeTime: '1',
    playbackStartMs: 480,
    durationMs: 120,
    sourceTime: 1,
    flowIndex: 4,
    passIndex: 2,
  },
  {
    originZnIds: ['note-d'],
    activeTextRanges: [{ startpos: 6, endpos: 7 }],
    activeNotes: [],
    activeTime: '3',
    playbackStartMs: 600,
    durationMs: 120,
    sourceTime: 3,
    flowIndex: 5,
    passIndex: 2,
    voltaNumber: 2,
  },
]

const sheetObjectIndex: SheetObjectIndex = {
  version: 1,
  lineStarts: [0],
  voiceByLine: {},
  byZnId: {
    'note-a-1': [0],
    'note-a-2': [1],
    'note-b-1': [2],
    'note-b-2': [3],
    'note-c': [4],
    'note-d': [5],
  },
  byConfKey: {},
  byTextRange: {},
  entries: [
    { kind: 'music-entity', znId: 'note-a-1', textRange: { startpos: 0, endpos: 1 }, addressableIn: { editor: false, score: false, svg: true } },
    { kind: 'music-entity', znId: 'note-a-2', textRange: { startpos: 0, endpos: 1 }, addressableIn: { editor: false, score: false, svg: true } },
    { kind: 'music-entity', znId: 'note-b-1', textRange: { startpos: 2, endpos: 3 }, addressableIn: { editor: false, score: false, svg: true } },
    { kind: 'music-entity', znId: 'note-b-2', textRange: { startpos: 2, endpos: 3 }, addressableIn: { editor: false, score: false, svg: true } },
    { kind: 'music-entity', znId: 'note-c', textRange: { startpos: 4, endpos: 5 }, addressableIn: { editor: false, score: false, svg: true } },
    { kind: 'music-entity', znId: 'note-d', textRange: { startpos: 6, endpos: 7 }, addressableIn: { editor: false, score: false, svg: true } },
  ],
}

describe('resolvePlaybackSteps', () => {
  it('keeps only matching occurrences for range playback inside repeated material', () => {
    const selection: SelectionState = {
      selectedIndexes: [0, 1, 2, 3],
      source: 'harp-preview',
      voiceScope: 'single-voice',
    }

    const steps = resolvePlaybackSteps(selection, sheetObjectIndex, timeline, 'range-harp')

    expect(steps.map((step) => step.originZnIds[0])).toEqual([
      'note-a-1',
      'note-b-1',
      'note-a-2',
      'note-b-2',
    ])
  })
})
