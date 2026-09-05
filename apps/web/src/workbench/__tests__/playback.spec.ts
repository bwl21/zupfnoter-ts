import { describe, expect, it } from 'vitest'

import type { SelectionState, SheetObjectIndex } from '@zupfnoter/types'

import {
  buildPlaybackTimeline,
  expireActivePlaybackRanges,
  resolveEffectivePlaybackPartNames,
  resolvePlaybackSteps,
  type PlaybackStep,
  updateActivePlaybackRanges,
} from '../playback'

const timeline: PlaybackStep[] = [
  {
    originVoiceIds: ['1'],
    originPlaybackIds: ['1::note-a-1'],
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
    originVoiceIds: ['1'],
    originPlaybackIds: ['1::note-b-1'],
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
    originVoiceIds: ['1'],
    originPlaybackIds: ['1::note-c'],
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
    originVoiceIds: ['1'],
    originPlaybackIds: ['1::note-a-2'],
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
    originVoiceIds: ['1'],
    originPlaybackIds: ['1::note-b-2'],
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
    originVoiceIds: ['1'],
    originPlaybackIds: ['1::note-d'],
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
  lineStarts: [0, 4],
  voiceByLine: {
    1: '1',
    2: '1',
  },
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
  byMusicTime: {},
  entries: [
    { kind: 'music-entity', znId: 'note-a-1', voiceId: '1', confKey: 'extract.0.note.v_1.note-a-1', textRange: { startpos: 0, endpos: 1 }, startPos: { line: 1, column: 1 }, endPos: { line: 1, column: 2 }, addressableIn: { editor: false, score: false, svg: true } },
    { kind: 'music-entity', znId: 'note-a-2', voiceId: '1', confKey: 'extract.0.note.v_1.note-a-2', textRange: { startpos: 0, endpos: 1 }, startPos: { line: 1, column: 1 }, endPos: { line: 1, column: 2 }, addressableIn: { editor: false, score: false, svg: true } },
    { kind: 'music-entity', znId: 'note-b-1', voiceId: '1', confKey: 'extract.0.note.v_1.note-b-1', textRange: { startpos: 2, endpos: 3 }, startPos: { line: 2, column: 1 }, endPos: { line: 2, column: 2 }, addressableIn: { editor: false, score: false, svg: true } },
    { kind: 'music-entity', znId: 'note-b-2', voiceId: '1', confKey: 'extract.0.note.v_1.note-b-2', textRange: { startpos: 2, endpos: 3 }, startPos: { line: 2, column: 1 }, endPos: { line: 2, column: 2 }, addressableIn: { editor: false, score: false, svg: true } },
    { kind: 'music-entity', znId: 'note-c', voiceId: '1', confKey: 'extract.0.note.v_1.note-c', textRange: { startpos: 4, endpos: 5 }, startPos: { line: 2, column: 3 }, endPos: { line: 2, column: 4 }, addressableIn: { editor: false, score: false, svg: true } },
    { kind: 'music-entity', znId: 'note-d', voiceId: '1', confKey: 'extract.0.note.v_1.note-d', textRange: { startpos: 6, endpos: 7 }, startPos: { line: 2, column: 5 }, endPos: { line: 2, column: 6 }, addressableIn: { editor: false, score: false, svg: true } },
  ],
}

describe('resolvePlaybackSteps', () => {
  it('starts single-note playback at the selected note and keeps only its voice', () => {
    const extractIndex: SheetObjectIndex = {
      ...sheetObjectIndex,
      byZnId: { 'note-b-1': [2] },
      byTextRange: { '2:3': [2] },
      byMusicTime: { '1': [2] },
      entries: [{
        kind: 'music-entity',
        znId: 'note-b-1',
        voiceId: '1',
        musicTime: 1,
        textRange: { startpos: 2, endpos: 3 },
        startPos: { line: 1, column: 1 },
        endPos: { line: 1, column: 2 },
        addressableIn: { editor: true, score: true, svg: true },
      }],
    }
    const firstTimelineStep = timeline[0]
    const secondTimelineStep = timeline[1]
    const thirdTimelineStep = timeline[2]
    if (firstTimelineStep === undefined || secondTimelineStep === undefined || thirdTimelineStep === undefined) {
      throw new Error('Playback test timeline is incomplete')
    }
    const extractTimeline: PlaybackStep[] = [
      {
        ...firstTimelineStep,
        originVoiceIds: ['1', '2'],
        originPlaybackIds: ['1::note-a-1', '2::note-a-1'],
        originZnIds: ['note-a-1', 'note-a-1'],
        sourceTime: 0,
      },
      {
        ...secondTimelineStep,
        originVoiceIds: ['1', '2'],
        originPlaybackIds: ['1::note-b-1', '2::note-b-2'],
        originZnIds: ['note-b-1', 'note-b-2'],
        sourceTime: 1,
      },
      {
        ...thirdTimelineStep,
        originVoiceIds: ['1', '2'],
        originPlaybackIds: ['1::note-c', '2::note-c'],
        originZnIds: ['note-c', 'note-c'],
        sourceTime: 2,
      },
    ]
    const selection: SelectionState = {
      selectedIndexes: [0],
      originSelectedIndexes: [0],
      source: 'abc-editor',
      voiceScope: 'single-voice',
    }

    const steps = resolvePlaybackSteps(selection, extractIndex, extractTimeline, 'range-harp', {
      activeVoiceIds: ['1', '2'],
    })

    expect(steps.map((step) => step.originZnIds)).toEqual([
      ['note-b-1'],
      ['note-c'],
    ])
    expect(steps[0]?.originVoiceIds).toEqual(['1'])
    expect(steps[0]?.originPlaybackIds).toEqual(['1::note-b-1'])
    expect(steps[0]?.playbackStartMs).toBe(0)
  })

  it('continues after one selected harp beat with multiple notes and its SVG object', () => {
    const harpIndex: SheetObjectIndex = {
      ...sheetObjectIndex,
      byZnId: { 'note-b-1': [0, 2], 'note-b-2': [1] },
      byTextRange: { '2:3': [0], '4:5': [1] },
      byMusicTime: { '1': [0, 1] },
      entries: [
        {
          kind: 'music-entity',
          znId: 'note-b-1',
          voiceId: '1',
          musicTime: 1,
          textRange: { startpos: 2, endpos: 3 },
          addressableIn: { editor: true, score: true, svg: true },
        },
        {
          kind: 'music-entity',
          znId: 'note-b-2',
          voiceId: '2',
          musicTime: 1,
          textRange: { startpos: 4, endpos: 5 },
          addressableIn: { editor: true, score: true, svg: true },
        },
        {
          kind: 'sheet-object',
          znId: 'note-b-1',
          addressableIn: { editor: false, score: false, svg: true },
        },
      ],
    }
    const selection: SelectionState = {
      selectedIndexes: [0, 1, 2],
      originSelectedIndexes: [0, 1, 2],
      source: 'harp-preview',
      voiceScope: 'single-voice',
    }

    const steps = resolvePlaybackSteps(selection, harpIndex, timeline, 'range-harp', {
      activeVoiceIds: ['1'],
    })

    expect(steps.map((step) => step.originZnIds[0])).toEqual([
      'note-b-1',
      'note-c',
      'note-a-2',
      'note-b-2',
      'note-d',
    ])
    expect(steps[0]?.playbackStartMs).toBe(0)
  })

  it('keeps overlapping voice highlights until each note duration ends', () => {
    const firstVoiceRange = { startpos: 10, endpos: 12 }
    const secondVoiceRange = { startpos: 20, endpos: 22 }
    const firstTemplate = timeline.find((step) => step.playbackStartMs === 0)
    const secondTemplate = timeline.find((step) => step.playbackStartMs === 120)
    if (firstTemplate === undefined || secondTemplate === undefined) {
      throw new Error('Playback test timeline is incomplete')
    }
    const firstStep: PlaybackStep = {
      ...firstTemplate,
      activeTextRanges: [firstVoiceRange],
      activePlaybackTextRanges: [{ playbackId: '1::long', voiceId: '1', textRange: firstVoiceRange }],
      activeNotes: [{ originVoiceId: '1', originPlaybackId: '1::long', originZnId: 'long', pitch: 60, durationMs: 500, attack: true, pan: 'left' }],
      playbackStartMs: 0,
      durationMs: 120,
    }
    const secondStep: PlaybackStep = {
      ...secondTemplate,
      activeTextRanges: [secondVoiceRange],
      activePlaybackTextRanges: [{ playbackId: '2::short', voiceId: '2', textRange: secondVoiceRange }],
      activeNotes: [{ originVoiceId: '2', originPlaybackId: '2::short', originZnId: 'short', pitch: 64, durationMs: 120, attack: true, pan: 'right' }],
      playbackStartMs: 120,
      durationMs: 120,
    }

    const afterFirst = updateActivePlaybackRanges(new Map(), firstStep)
    const afterSecond = updateActivePlaybackRanges(afterFirst, secondStep)

    expect([...afterSecond.values()].map((range) => range.textRange)).toEqual([
      firstVoiceRange,
      secondVoiceRange,
    ])
  })

  it('expires a highlight at note end before a later repeated occurrence starts', () => {
    const repeatedRange = { startpos: 10, endpos: 12 }
    const firstPassTemplate = timeline.find((step) => step.passIndex === 1)
    if (firstPassTemplate === undefined) {
      throw new Error('Playback test timeline has no first pass')
    }
    const firstPassStep: PlaybackStep = {
      ...firstPassTemplate,
      activeTextRanges: [repeatedRange],
      activePlaybackTextRanges: [{ playbackId: '1::repeated', voiceId: '1', textRange: repeatedRange }],
      activeNotes: [{ originVoiceId: '1', originPlaybackId: '1::repeated', originZnId: 'repeated', pitch: 60, durationMs: 120, attack: true, pan: 'left' }],
      playbackStartMs: 0,
      durationMs: 120,
      passIndex: 1,
    }

    const activeDuringFirstPass = updateActivePlaybackRanges(new Map(), firstPassStep)
    const afterFirstPassNote = expireActivePlaybackRanges(activeDuringFirstPass, 120)

    expect([...afterFirstPassNote.values()]).toEqual([])
  })

  it('limits the playback timeline to the active extract voices', () => {
    const song = {
      metaData: {},
      voices: [
        {
          index: 0,
          showVoice: true,
          showFlowline: true,
          showJumpline: true,
          entities: [{
            type: 'Note' as const,
            beat: 0,
            time: 0,
            sourceOffsets: [0, 1] as [number, number],
            startPos: [1, 1] as [number, number],
            endPos: [1, 2] as [number, number],
            decorations: [],
            barDecorations: [],
            visible: true,
            variant: 0 as const,
            znId: 'voice-1-note',
            duration: 16,
            pitch: 60,
            tieStart: false,
            tieEnd: false,
            tuplet: 1,
            tupletStart: false,
            tupletEnd: false,
            firstInPart: false,
            measureStart: false,
            measureCount: 1,
            jumpStarts: [],
            jumpEnds: [],
            slurStarts: [],
            slurEnds: [],
            countNote: null,
            lyrics: null,
          }],
        },
        {
          index: 2,
          showVoice: true,
          showFlowline: true,
          showJumpline: true,
          entities: [{
            type: 'Note' as const,
            beat: 0,
            time: 0,
            sourceOffsets: [2, 3] as [number, number],
            startPos: [2, 1] as [number, number],
            endPos: [2, 2] as [number, number],
            decorations: [],
            barDecorations: [],
            visible: true,
            variant: 0 as const,
            znId: 'voice-2-note',
            duration: 16,
            pitch: 64,
            tieStart: false,
            tieEnd: false,
            tuplet: 1,
            tupletStart: false,
            tupletEnd: false,
            firstInPart: false,
            measureStart: false,
            measureCount: 1,
            jumpStarts: [],
            jumpEnds: [],
            slurStarts: [],
            slurEnds: [],
            countNote: null,
            lyrics: null,
          }],
        },
      ],
      beatMaps: [],
    }

    const steps = buildPlaybackTimeline(song, [2])

    expect(steps).toHaveLength(1)
    expect(steps[0]?.originVoiceIds).toEqual(['2'])
    expect(steps[0]?.originZnIds).toEqual(['voice-2-note'])
  })

  it('keeps only matching occurrences for range playback inside repeated material', () => {
    const selection: SelectionState = {
      selectedIndexes: [0, 1, 2, 3],
      originSelectedIndexes: [0, 1, 2, 3],
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
    expect(steps.map((step) => step.playbackStartMs)).toEqual([0, 120, 240, 360])
  })

  it('keeps only the selected notes inside a shared playback step', () => {
    const sharedStepTimeline: PlaybackStep[] = [
      {
        originVoiceIds: ['1', '2'],
        originPlaybackIds: ['1::note-a', '2::note-b'],
        originZnIds: ['note-a', 'note-b'],
        activeTextRanges: [
          { startpos: 0, endpos: 1 },
          { startpos: 2, endpos: 3 },
        ],
        activePlaybackTextRanges: [
          { playbackId: '1::note-a', voiceId: '1', textRange: { startpos: 0, endpos: 1 } },
          { playbackId: '2::note-b', voiceId: '2', textRange: { startpos: 2, endpos: 3 } },
        ],
        activeNotes: [
          { originVoiceId: '1', originPlaybackId: '1::note-a', originZnId: 'note-a', pitch: 60, durationMs: 120, attack: true, pan: 'left' },
          { originVoiceId: '2', originPlaybackId: '2::note-b', originZnId: 'note-b', pitch: 64, durationMs: 120, attack: true, pan: 'right' },
        ],
        activeTime: '0',
        playbackStartMs: 240,
        durationMs: 120,
        sourceTime: 0,
        flowIndex: 0,
        passIndex: 1,
      },
    ]
    const sharedStepIndex: SheetObjectIndex = {
      version: 1,
      lineStarts: [0],
      voiceByLine: {},
      byZnId: {
        'note-a': [0],
        'note-b': [1],
      },
      byConfKey: {},
      byTextRange: {},
      byMusicTime: {},
      entries: [
        { kind: 'music-entity', znId: 'note-a', voiceId: '1', confKey: 'extract.0.note.v_1.note-a', textRange: { startpos: 0, endpos: 1 }, startPos: { line: 1, column: 1 }, endPos: { line: 1, column: 2 }, addressableIn: { editor: true, score: true, svg: true } },
        { kind: 'music-entity', znId: 'note-b', voiceId: '2', confKey: 'extract.0.note.v_2.note-b', textRange: { startpos: 2, endpos: 3 }, startPos: { line: 2, column: 1 }, endPos: { line: 2, column: 2 }, addressableIn: { editor: true, score: true, svg: true } },
      ],
    }
    const selection: SelectionState = {
      selectedIndexes: [0],
      originSelectedIndexes: [0],
      source: 'abc-editor',
      voiceScope: 'single-voice',
    }

    const steps = resolvePlaybackSteps(selection, sharedStepIndex, sharedStepTimeline, 'range-harp')

    expect(steps).toHaveLength(1)
    expect(steps[0]?.originPlaybackIds).toEqual(['1::note-a'])
    expect(steps[0]?.originZnIds).toEqual(['note-a'])
    expect(steps[0]?.originVoiceIds).toEqual(['1'])
    expect(steps[0]?.activeTextRanges).toEqual([
      { startpos: 0, endpos: 1 },
    ])
    expect(steps[0]?.activeNotes).toEqual([
      { originVoiceId: '1', originPlaybackId: '1::note-a', originZnId: 'note-a', pitch: 60, durationMs: 120, attack: true, pan: 'left' },
    ])
    expect(steps[0]?.playbackStartMs).toBe(0)
  })

  it('keeps extract-scoped editor playback on all selected voices', () => {
    const extractScopedIndex: SheetObjectIndex = {
      version: 2,
      lineStarts: [0, 4, 9],
      voiceByLine: {
        1: '1',
        2: '1',
        3: '2',
      },
      byZnId: {
        'note-a': [0],
        'note-b': [1],
      },
      byConfKey: {},
      byTextRange: {
        '0:1': [0],
        '2:3': [1],
      },
      byMusicTime: {
        '0': [0, 1],
      },
      entries: [
        { kind: 'music-entity', znId: 'note-a', voiceId: '1', musicTime: 0, confKey: 'extract.0.note.v_1.note-a', textRange: { startpos: 0, endpos: 1 }, startPos: { line: 2, column: 1 }, endPos: { line: 2, column: 2 }, addressableIn: { editor: true, score: true, svg: true } },
        { kind: 'music-entity', znId: 'note-b', voiceId: '2', musicTime: 0, confKey: 'extract.0.note.v_2.note-b', textRange: { startpos: 2, endpos: 3 }, startPos: { line: 3, column: 1 }, endPos: { line: 3, column: 2 }, addressableIn: { editor: true, score: true, svg: true } },
      ],
    }
    const extractScopedSelection: SelectionState = {
      selectedIndexes: [0, 1],
      originSelectedIndexes: [0, 1],
      source: 'abc-editor',
      voiceScope: 'extract-voices',
    }
    const extractScopedTimeline: PlaybackStep[] = [
      {
        originVoiceIds: ['1', '2'],
        originPlaybackIds: ['1::note-a', '2::note-b'],
        originZnIds: ['note-a', 'note-b'],
        activeTextRanges: [
          { startpos: 0, endpos: 1 },
          { startpos: 2, endpos: 3 },
        ],
        activePlaybackTextRanges: [
          { playbackId: '1::note-a', voiceId: '1', textRange: { startpos: 0, endpos: 1 } },
          { playbackId: '2::note-b', voiceId: '2', textRange: { startpos: 2, endpos: 3 } },
        ],
        activeNotes: [
          { originVoiceId: '1', originPlaybackId: '1::note-a', originZnId: 'note-a', pitch: 60, durationMs: 120, attack: true, pan: 'left' },
          { originVoiceId: '2', originPlaybackId: '2::note-b', originZnId: 'note-b', pitch: 64, durationMs: 120, attack: true, pan: 'right' },
        ],
        activeTime: '0',
        playbackStartMs: 0,
        durationMs: 120,
        sourceTime: 0,
        flowIndex: 0,
        passIndex: 1,
      },
    ]

    const steps = resolvePlaybackSteps(extractScopedSelection, extractScopedIndex, extractScopedTimeline, 'range-harp')

    expect(steps).toHaveLength(1)
    expect(steps[0]?.originPlaybackIds).toEqual(['1::note-a', '2::note-b'])
    expect(steps[0]?.activeNotes).toHaveLength(2)
  })

  it('keeps all song voices when nothing is selected and the scope is all voices', () => {
    const selection: SelectionState = {
      selectedIndexes: [],
      originSelectedIndexes: [],
      source: 'command',
      voiceScope: 'all-voices',
    }
    const steps = resolvePlaybackSteps(selection, undefined, [
      {
        originVoiceIds: ['1', '2', '3', '4'],
        originPlaybackIds: ['1::a', '2::b', '3::c', '4::d'],
        originZnIds: ['a', 'b', 'c', 'd'],
        activeTextRanges: [],
        activePlaybackTextRanges: [],
        activeNotes: [
          { originVoiceId: '1', originPlaybackId: '1::a', originZnId: 'a', pitch: 60, durationMs: 120, attack: true, pan: 'left' },
          { originVoiceId: '2', originPlaybackId: '2::b', originZnId: 'b', pitch: 62, durationMs: 120, attack: true, pan: 'left' },
          { originVoiceId: '3', originPlaybackId: '3::c', originZnId: 'c', pitch: 64, durationMs: 120, attack: true, pan: 'right' },
          { originVoiceId: '4', originPlaybackId: '4::d', originZnId: 'd', pitch: 65, durationMs: 120, attack: true, pan: 'right' },
        ],
        activeTime: '0',
        playbackStartMs: 0,
        durationMs: 120,
        sourceTime: 0,
        flowIndex: 0,
        passIndex: 1,
      },
    ], 'all-score', {
      activeVoiceIds: ['1', '2', '3'],
    })

    expect(steps).toHaveLength(1)
    expect(steps[0]?.originVoiceIds).toEqual(['1', '2', '3', '4'])
    expect(steps[0]?.activeNotes).toHaveLength(4)
  })

  it('limits no-selection playback to the active extract voices when the scope is extract', () => {
    const selection: SelectionState = {
      selectedIndexes: [],
      originSelectedIndexes: [],
      source: 'command',
      voiceScope: 'extract-voices',
    }
    const steps = resolvePlaybackSteps(selection, undefined, [
      {
        originVoiceIds: ['1', '2', '3', '4'],
        originPlaybackIds: ['1::a', '2::b', '3::c', '4::d'],
        originZnIds: ['a', 'b', 'c', 'd'],
        activeTextRanges: [],
        activePlaybackTextRanges: [
          { playbackId: '1::a', voiceId: '1', textRange: { startpos: 0, endpos: 1 } },
          { playbackId: '2::b', voiceId: '2', textRange: { startpos: 2, endpos: 3 } },
          { playbackId: '3::c', voiceId: '3', textRange: { startpos: 4, endpos: 5 } },
          { playbackId: '4::d', voiceId: '4', textRange: { startpos: 6, endpos: 7 } },
        ],
        activeNotes: [
          { originVoiceId: '1', originPlaybackId: '1::a', originZnId: 'a', pitch: 60, durationMs: 120, attack: true, pan: 'left' },
          { originVoiceId: '2', originPlaybackId: '2::b', originZnId: 'b', pitch: 62, durationMs: 120, attack: true, pan: 'left' },
          { originVoiceId: '3', originPlaybackId: '3::c', originZnId: 'c', pitch: 64, durationMs: 120, attack: true, pan: 'right' },
          { originVoiceId: '4', originPlaybackId: '4::d', originZnId: 'd', pitch: 65, durationMs: 120, attack: true, pan: 'right' },
        ],
        activeTime: '0',
        playbackStartMs: 0,
        durationMs: 120,
        sourceTime: 0,
        flowIndex: 0,
        passIndex: 1,
      },
    ], 'all-score', {
      activeVoiceIds: ['1', '2', '3'],
    })

    expect(steps).toHaveLength(1)
    expect(steps[0]?.originVoiceIds).toEqual(['1', '2', '3'])
    expect(steps[0]?.activeNotes).toHaveLength(3)
  })
})

describe('resolveEffectivePlaybackPartNames', () => {
  it('keeps a trimmed part name until the next non-empty name', () => {
    const [first, second, third, fourth] = timeline
    if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
      throw new Error('Playback test timeline is incomplete')
    }
    const namedTimeline = [
      { ...first, partName: '  Teil A  ' },
      second,
      { ...third, partName: '   ' },
      { ...fourth, partName: 'Teil B' },
    ]

    const names = resolveEffectivePlaybackPartNames(namedTimeline)

    expect(namedTimeline.map((step) => names.get(step.flowIndex))).toEqual(['Teil A', 'Teil A', 'Teil A', 'Teil B'])
  })
})
