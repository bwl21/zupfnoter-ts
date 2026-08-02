import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import type { SheetObjectIndex } from '@zupfnoter/types'

import { useSelectionStore } from '../selection'
import {
  projectIndexesToEntries,
  resolveEditorSelectionRange,
  resolveEditorSelectionRanges,
  resolveScoreSelectionRanges,
  resolveSelectedZnIds,
  resolveSvgSelection,
} from '../../workbench/selectionIndex'
import { renderWorkbenchPreviews } from '../../workbench/rendering/renderPipeline'

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
    'note-2': [1],
    'note-3': [6, 7],
    'note-4': [8, 9],
  },
  byConfKey: {
    'extract.0.note-1': [2],
    'extract.0.note-3': [7],
    'extract.0.note-4': [9],
  },
  byTextRange: {
    '4:6': [0, 2],
    '7:8': [1],
    '10:12': [5, 6, 8],
  },
  byMusicTime: {
    '64': [0],
    '96': [1],
    '128': [6, 8],
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
      kind: 'music-entity',
      znId: 'note-2',
      voiceId: '1',
      musicTime: 96,
      textRange: { startpos: 7, endpos: 8 },
      startPos: { line: 2, column: 4 },
      endPos: { line: 2, column: 5 },
      addressableIn: { editor: true, score: true, svg: true },
    },
    {
      kind: 'sheet-object',
      znId: 'note-1',
      confKey: 'extract.0.note-1',
      addressableIn: { editor: false, score: false, svg: true },
    },
    {
      kind: 'score-object',
      textRange: { startpos: 0, endpos: 3 },
      startPos: { line: 1, column: 1 },
      endPos: { line: 1, column: 4 },
      addressableIn: { editor: true, score: true, svg: false },
    },
    {
      kind: 'score-object',
      textRange: { startpos: 4, endpos: 6 },
      startPos: { line: 2, column: 1 },
      endPos: { line: 2, column: 3 },
      addressableIn: { editor: true, score: true, svg: false },
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
      confKey: 'extract.0.note-3',
      addressableIn: { editor: false, score: false, svg: true },
    },
    {
      kind: 'music-entity',
      znId: 'note-4',
      voiceId: '2',
      musicTime: 128,
      textRange: { startpos: 10, endpos: 12 },
      startPos: { line: 3, column: 2 },
      endPos: { line: 3, column: 4 },
      addressableIn: { editor: true, score: true, svg: true },
    },
    {
      kind: 'sheet-object',
      znId: 'note-4',
      confKey: 'extract.0.note-4',
      addressableIn: { editor: false, score: false, svg: true },
    },
  ],
}

describe('selection store', () => {
  it('lets the selection manager clear a selection after a preview background click', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 4,
      endpos: 6,
      source: 'score-preview',
    })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.preview-background-clicked',
      source: 'harp-preview',
    })

    expect(selectionStore.selection.selectedIndexes).toEqual([])
    expect(selectionStore.selection.source).toBe('harp-preview')
  })

  it('creates and extends independent selection segments across preview panels', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 4,
      endpos: 6,
      origin: { voiceId: '1', musicTime: 64, znId: 'note-1' },
      source: 'score-preview',
    })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 7,
      endpos: 8,
      origin: { voiceId: '1', musicTime: 96, znId: 'note-2' },
      startNewSegment: true,
      source: 'harp-preview',
    })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 10,
      endpos: 12,
      origin: { voiceId: '1', musicTime: 128, znId: 'note-3' },
      extend: true,
      source: 'harp-preview',
    })

    expect(selectionStore.selection.segments).toHaveLength(2)
    expect(selectionStore.selection.activeSegmentIndex).toBe(1)
    expect(selectionStore.selection.segments?.[0]?.textRanges).toEqual([
      { startpos: 4, endpos: 6 },
    ])
    expect(selectionStore.selection.segments?.[1]?.textRanges).toEqual([
      { startpos: 7, endpos: 12 },
    ])
    expect(selectionStore.selection.segments?.[0]?.selectedIndexes).not.toContain(1)
    expect(selectionStore.selection.segments?.[1]?.selectedIndexes).not.toContain(0)
    expect(resolveEditorSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual([
        { startpos: 4, endpos: 6 },
        { startpos: 7, endpos: 12 },
      ])
  })

  it('keeps segment boundaries when the voice scope expands', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 4,
      endpos: 6,
      origin: { voiceId: '1', musicTime: 64, znId: 'note-1' },
      source: 'score-preview',
    })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 10,
      endpos: 12,
      origin: { voiceId: '1', musicTime: 128, znId: 'note-3' },
      startNewSegment: true,
      source: 'score-preview',
    })

    selectionStore.dispatchSelectionEvent({
      type: 'selection.scope-changed',
      voiceScope: 'all-voices',
    })

    expect(selectionStore.selection.segments).toHaveLength(2)
    expect(selectionStore.selection.segments?.[0]?.musicTimeRange).toEqual({ start: 64, end: 64 })
    expect(selectionStore.selection.segments?.[1]?.musicTimeRange).toEqual({ start: 128, end: 128 })
    expect(selectionStore.selection.segments?.[0]?.textRanges).not.toContainEqual({ startpos: 10, endpos: 12 })
    expect(selectionStore.selection.segments?.[1]?.textRanges).not.toContainEqual({ startpos: 4, endpos: 6 })
    expect(resolveEditorSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual([
        { startpos: 4, endpos: 6 },
        { startpos: 10, endpos: 12 },
      ])
  })

  it('starts another segment after an existing multi-voice projection', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 4,
      endpos: 6,
      origin: { voiceId: '1', musicTime: 64, znId: 'note-1' },
      source: 'score-preview',
    })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 10,
      endpos: 12,
      origin: { voiceId: '1', musicTime: 128, znId: 'note-3' },
      startNewSegment: true,
      source: 'score-preview',
    })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.scope-changed',
      voiceScope: 'all-voices',
    })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 7,
      endpos: 8,
      origin: { voiceId: '1', musicTime: 96, znId: 'note-2' },
      startNewSegment: true,
      source: 'score-preview',
    })

    expect(selectionStore.selection.activeSegmentIndex).toBe(2)
    expect(selectionStore.selection.segments).toHaveLength(3)
    expect(selectionStore.selection.segments?.map((segment) => segment.musicTimeRange)).toEqual([
      { start: 64, end: 64 },
      { start: 128, end: 128 },
      { start: 96, end: 96 },
    ])
  })

  it('does not feed editor segment envelopes back into score projection', () => {
    setActivePinia(createPinia())

    const envelopeIndex: SheetObjectIndex = {
      ...sheetObjectIndex,
      byTextRange: {
        ...sheetObjectIndex.byTextRange,
        '6:7': [10],
      },
      entries: [
        ...sheetObjectIndex.entries,
        {
          kind: 'score-object',
          textRange: { startpos: 6, endpos: 7 },
          startPos: { line: 2, column: 3 },
          endPos: { line: 2, column: 4 },
          addressableIn: { editor: true, score: true, svg: false },
        },
      ],
    }
    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: envelopeIndex })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 4,
      endpos: 6,
      origin: { voiceId: '1', musicTime: 64, znId: 'note-1' },
      source: 'score-preview',
    })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 10,
      endpos: 12,
      origin: { voiceId: '1', musicTime: 128, znId: 'note-3' },
      startNewSegment: true,
      source: 'score-preview',
    })

    expect(selectionStore.selection.textRanges).toContainEqual({ startpos: 4, endpos: 6 })
    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection))
      .not.toContainEqual({ startpos: 6, endpos: 7 })
  })

  it('extends by music time and synchronizes measure bars across extract voices', () => {
    setActivePinia(createPinia())

    const timedIndex: SheetObjectIndex = {
      version: 1,
      lineStarts: [0, 4, 20],
      voiceByLine: { 1: undefined, 2: '1', 3: '2' },
      byZnId: {
        'v1-start': [0],
        'v1-bar': [1],
        'v1-end': [2],
        'v2-start': [3],
        'v2-bar': [4],
        'v2-end': [5],
      },
      byConfKey: {},
      byTextRange: {
        '4:5': [0, 6],
        '6:7': [1, 7],
        '8:9': [2, 8],
        '20:21': [3, 9],
        '22:23': [4, 10],
        '24:25': [5, 11],
      },
      byMusicTime: {
        '0': [0, 3],
        '10': [1, 4],
        '20': [2, 5],
      },
      musicTimes: [0, 10, 20],
      entries: [
        ...[
          ['v1-start', '1', 0, 4],
          ['v1-bar', '1', 10, 6],
          ['v1-end', '1', 20, 8],
          ['v2-start', '2', 0, 20],
          ['v2-bar', '2', 10, 22],
          ['v2-end', '2', 20, 24],
        ].map(([znId, voiceId, musicTime, startpos]) => ({
          kind: 'music-entity' as const,
          znId: String(znId),
          voiceId: String(voiceId),
          musicTime: Number(musicTime),
          textRange: { startpos: Number(startpos), endpos: Number(startpos) + 1 },
          addressableIn: { editor: true, score: true, svg: true },
        })),
        ...[4, 6, 8, 20, 22, 24].map((startpos) => ({
          kind: 'score-object' as const,
          textRange: { startpos, endpos: startpos + 1 },
          addressableIn: { editor: true, score: true, svg: false },
        })),
      ],
    }

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: timedIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.extract-changed', activeVoiceIds: ['1', '2'] })
    selectionStore.dispatchSelectionEvent({ type: 'selection.scope-changed', voiceScope: 'extract-voices' })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 4,
      endpos: 5,
      origin: { voiceId: '1', musicTime: 0, znId: 'v1-start' },
      source: 'score-preview',
    })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 8,
      endpos: 9,
      origin: { voiceId: '1', musicTime: 20, znId: 'v1-end' },
      extend: true,
      source: 'score-preview',
    })

    expect(selectionStore.selection.originSelectedIndexes).toEqual([0, 1, 2])
    expect(selectionStore.selection.selectedIndexes).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toContainEqual({ startpos: 6, endpos: 7 })
    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toContainEqual({ startpos: 22, endpos: 23 })
  })

  it('treats option-shift-click without an existing selection like a normal click', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: 4,
      endpos: 6,
      origin: { voiceId: '1', musicTime: 64, znId: 'note-1' },
      startNewSegment: true,
      source: 'harp-preview',
    })

    expect(selectionStore.selection.selectedIndexes).toEqual([0])
    expect(selectionStore.selection.segments).toBeUndefined()
  })

  it('keeps disjoint editor segments separate within the same voice', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.scope-changed', voiceScope: 'all-voices' })
    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-ranges-selected',
      ranges: [
        { startpos: 4, endpos: 6 },
        { startpos: 10, endpos: 12 },
      ],
      source: 'abc-editor',
    })

    expect(selectionStore.selection.textRanges).toEqual([
      { startpos: 4, endpos: 6 },
      { startpos: 10, endpos: 12 },
    ])
    expect(resolveEditorSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual([
        { startpos: 4, endpos: 6 },
        { startpos: 10, endpos: 12 },
        { startpos: 10, endpos: 12 },
      ])
  })

  it('resolves text selections to index entries and pane-specific highlights', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.text-range-selected', startpos: 4, endpos: 6, source: 'abc-editor' })

    expect(selectionStore.selection.selectedIndexes).toEqual([0])
    expect(resolveEditorSelectionRange(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual({ startpos: 4, endpos: 6 })
    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual([{ startpos: 4, endpos: 6 }])
    expect(resolveSvgSelection(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual({
        znIds: [],
        confKeys: [],
        textRanges: [{ startpos: 4, endpos: 6 }],
      })
    expect(selectionStore.selection.voiceScope).toBe('single-voice')
  })

  it('resolves score-only selections back into the editor through score objects', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.text-range-selected', startpos: 0, endpos: 3, source: 'score-preview' })

    expect(selectionStore.selection.selectedIndexes).toEqual([3])
    expect(resolveEditorSelectionRange(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual({ startpos: 0, endpos: 3 })
    expect(resolveSvgSelection(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual({
        znIds: [],
        confKeys: [],
        textRanges: [],
      })
  })

  it('extends score selections with shift-click into a contiguous text range', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.text-range-selected', startpos: 4, endpos: 6, source: 'score-preview' })
    selectionStore.dispatchSelectionEvent({ type: 'selection.text-range-selected', startpos: 10, endpos: 12, source: 'score-preview', extend: true })

    expect(resolveEditorSelectionRange(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual({ startpos: 4, endpos: 12 })
    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual([
        { startpos: 4, endpos: 6 },
        { startpos: 7, endpos: 8 },
        { startpos: 10, endpos: 12 },
      ])
  })

  it('keeps a score shift-selection on the anchor voice instead of expanding to all voices', () => {
    setActivePinia(createPinia())

    const scoreAnchorIndex: SheetObjectIndex = {
      version: 2,
      lineStarts: [0, 4, 9, 14, 19],
      voiceByLine: {
        1: undefined,
        2: '1',
        3: '2',
        4: '3',
        5: '3',
      },
      byZnId: {
        'v1-a': [0],
        'v2-a': [2],
        'v3-a': [4],
        'v3-b': [6],
      },
      byConfKey: {},
      byTextRange: {
        '4:6': [0, 1],
        '10:12': [2, 3],
        '20:22': [4, 5],
        '30:32': [6, 7],
      },
      byMusicTime: {
        '64': [0],
        '96': [2],
        '128': [4],
        '160': [6],
      },
      entries: [
        {
          kind: 'music-entity',
          znId: 'v1-a',
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
          kind: 'music-entity',
          znId: 'v2-a',
          voiceId: '2',
          musicTime: 96,
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
        {
          kind: 'music-entity',
          znId: 'v3-a',
          voiceId: '3',
          musicTime: 128,
          textRange: { startpos: 20, endpos: 22 },
          startPos: { line: 4, column: 1 },
          endPos: { line: 4, column: 3 },
          addressableIn: { editor: true, score: true, svg: true },
        },
        {
          kind: 'score-object',
          textRange: { startpos: 20, endpos: 22 },
          startPos: { line: 4, column: 1 },
          endPos: { line: 4, column: 3 },
          addressableIn: { editor: true, score: true, svg: false },
        },
        {
          kind: 'music-entity',
          znId: 'v3-b',
          voiceId: '3',
          musicTime: 160,
          textRange: { startpos: 30, endpos: 32 },
          startPos: { line: 5, column: 1 },
          endPos: { line: 5, column: 3 },
          addressableIn: { editor: true, score: true, svg: true },
        },
        {
          kind: 'score-object',
          textRange: { startpos: 30, endpos: 32 },
          startPos: { line: 5, column: 1 },
          endPos: { line: 5, column: 3 },
          addressableIn: { editor: true, score: true, svg: false },
        },
      ],
    }

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: scoreAnchorIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.text-range-selected', startpos: 20, endpos: 22, source: 'score-preview' })
    selectionStore.dispatchSelectionEvent({ type: 'selection.text-range-selected', startpos: 30, endpos: 32, source: 'score-preview', extend: true })

    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual([
        { startpos: 20, endpos: 22 },
        { startpos: 30, endpos: 32 },
      ])
  })

  it('resolves config selections into svg-addressable entries', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.confkey-selected', confKey: 'extract.0.note-1' })

    expect(selectionStore.selection.selectedIndexes).toEqual([2])
    expect(projectIndexesToEntries(selectionStore.sheetObjectIndex, selectionStore.selection.selectedIndexes))
      .toEqual([sheetObjectIndex.entries[2]])
  })

  it('resolves harp selections into svg-addressable entries', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.znid-selected', znId: 'note-1', source: 'harp-preview' })

    expect(selectionStore.selection.selectedIndexes).toEqual([0, 2])
    expect(resolveSvgSelection(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual({
        znIds: ['note-1'],
        confKeys: ['extract.0.note-1'],
        textRanges: [{ startpos: 4, endpos: 6 }],
      })
  })

  it('extends harp selections with shift-click across the covered source range', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.text-range-selected', startpos: 4, endpos: 6, source: 'harp-preview' })
    selectionStore.dispatchSelectionEvent({ type: 'selection.text-range-selected', startpos: 10, endpos: 12, source: 'harp-preview', extend: true })

    expect(resolveEditorSelectionRange(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual({ startpos: 4, endpos: 12 })
    expect(resolveSvgSelection(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual({
        znIds: ['note-1', 'note-2', 'note-3'],
        confKeys: ['extract.0.note-1'],
        textRanges: [
          { startpos: 4, endpos: 6 },
          { startpos: 7, endpos: 8 },
          { startpos: 10, endpos: 12 },
        ],
      })
  })

  it('keeps harp playback znIds on the directly selected note when another voice shares the same text range', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.znid-selected', znId: 'note-3', source: 'harp-preview' })

    expect(resolveSelectedZnIds(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual(['note-3'])
  })

  it('projects score-addressable text selections into svg-addressable harp entries', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.indexes-selected', selectedIndexes: [4], source: 'abc-editor' })

    expect(resolveSvgSelection(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual({
        znIds: [],
        confKeys: [],
        textRanges: [{ startpos: 4, endpos: 6 }],
      })
  })

  it('keeps editor text selections on the originating line when multiple voices share a text range', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.text-range-selected', startpos: 10, endpos: 12, source: 'abc-editor' })

    expect(resolveSvgSelection(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual({
        znIds: [],
        confKeys: [],
        textRanges: [{ startpos: 10, endpos: 12 }],
      })
  })

  it('filters editor-driven confKeys to the active ABC voice of the selected line', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({
      type: 'selection.render-refreshed',
      nextIndex: {
      ...sheetObjectIndex,
      byZnId: {
        ...sheetObjectIndex.byZnId,
        'note-3': [6, 7, 10, 11],
      },
      byConfKey: {
        ...sheetObjectIndex.byConfKey,
        'extract.0.notebound.nconf.v_1.t_384.n_0.***': [10],
        'extract.0.notebound.nconf.v_2.t_384.n_0.***': [11],
      },
      entries: [
        ...sheetObjectIndex.entries,
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
      },
    })
    selectionStore.dispatchSelectionEvent({ type: 'selection.indexes-selected', selectedIndexes: [5], source: 'abc-editor' })

    expect(resolveSvgSelection(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual({
        znIds: [],
        confKeys: [],
        textRanges: [{ startpos: 10, endpos: 12 }],
      })
  })

  it('clears transient selection when a new render index arrives', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.znid-selected', znId: 'note-1', source: 'harp-preview' })
    expect(selectionStore.selection.selectedIndexes).toEqual([0, 2])

    selectionStore.dispatchSelectionEvent({
      type: 'selection.render-refreshed',
      nextIndex: {
      ...sheetObjectIndex,
      version: 2,
      },
    })

    expect(selectionStore.selection.selectedIndexes).toEqual([])
  })

  it('reprojects an editor selection when a new render index arrives', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.text-range-selected', startpos: 4, endpos: 6, source: 'abc-editor' })

    selectionStore.dispatchSelectionEvent({
      type: 'selection.render-refreshed',
      nextIndex: {
      ...sheetObjectIndex,
      version: 2,
      },
    })

    expect(selectionStore.selection.source).toBe('abc-editor')
    expect(selectionStore.selection.selectedIndexes).toEqual([0])
    expect(resolveSvgSelection(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual({
        znIds: [],
        confKeys: [],
        textRanges: [{ startpos: 4, endpos: 6 }],
      })
  })

  it('keeps the origin excerpt when an extract-scoped editor selection is rebound to a new render index', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    const extractScopedIndex: SheetObjectIndex = {
      version: 1,
      lineStarts: [0, 4, 9, 14],
      voiceByLine: {
        1: undefined,
        2: '1',
        3: '2',
        4: '2',
      },
      byZnId: {
        'note-a': [0],
        'note-b': [1],
        'note-c': [2],
        'note-d': [3],
      },
      byConfKey: {},
      byTextRange: {
        '4:6': [0],
        '7:8': [1],
        '10:12': [2],
        '13:14': [3],
      },
      byMusicTime: {
        '64': [0, 2],
        '96': [1, 3],
      },
      entries: [
        {
          kind: 'music-entity',
          znId: 'note-a',
          voiceId: '1',
          musicTime: 64,
          textRange: { startpos: 4, endpos: 6 },
          startPos: { line: 2, column: 1 },
          endPos: { line: 2, column: 3 },
          addressableIn: { editor: true, score: true, svg: true },
        },
        {
          kind: 'music-entity',
          znId: 'note-b',
          voiceId: '1',
          musicTime: 96,
          textRange: { startpos: 7, endpos: 8 },
          startPos: { line: 2, column: 4 },
          endPos: { line: 2, column: 5 },
          addressableIn: { editor: true, score: true, svg: true },
        },
        {
          kind: 'music-entity',
          znId: 'note-c',
          voiceId: '2',
          musicTime: 64,
          textRange: { startpos: 10, endpos: 12 },
          startPos: { line: 3, column: 1 },
          endPos: { line: 3, column: 3 },
          addressableIn: { editor: true, score: true, svg: true },
        },
        {
          kind: 'music-entity',
          znId: 'note-d',
          voiceId: '2',
          musicTime: 96,
          textRange: { startpos: 13, endpos: 14 },
          startPos: { line: 3, column: 4 },
          endPos: { line: 3, column: 5 },
          addressableIn: { editor: true, score: true, svg: true },
        },
      ],
    }

    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: extractScopedIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.extract-changed', activeVoiceIds: ['1', '2'] })
    selectionStore.dispatchSelectionEvent({ type: 'selection.indexes-selected', selectedIndexes: [0, 1], source: 'abc-editor' })
    selectionStore.dispatchSelectionEvent({ type: 'selection.scope-changed', voiceScope: 'extract-voices' })

    expect(selectionStore.selection.originSelectedIndexes).toEqual([0, 1])
    expect(selectionStore.selection.selectedIndexes).toEqual([0, 1, 2, 3])

    selectionStore.dispatchSelectionEvent({
      type: 'selection.render-refreshed',
      nextIndex: {
      ...extractScopedIndex,
      version: 2,
      },
    })

    expect(selectionStore.selection.originSelectedIndexes).toEqual([0, 1])
    expect(selectionStore.selection.selectedIndexes).toEqual([0, 1, 2, 3])
    expect(resolveEditorSelectionRange(selectionStore.sheetObjectIndex, {
      ...selectionStore.selection,
      selectedIndexes: selectionStore.selection.originSelectedIndexes,
    })).toEqual({
      startpos: 4,
      endpos: 8,
    })
  })

  it('projects editor selection to score ranges of all active extract voices when scope is extract', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    const extractScopedIndex: SheetObjectIndex = {
      version: 1,
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

    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: extractScopedIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.extract-changed', activeVoiceIds: ['1', '2'] })
    selectionStore.dispatchSelectionEvent({ type: 'selection.text-range-selected', startpos: 4, endpos: 6, source: 'abc-editor' })
    selectionStore.dispatchSelectionEvent({ type: 'selection.scope-changed', voiceScope: 'extract-voices' })

    expect(selectionStore.selection.selectedIndexes).toEqual([0, 1, 2, 3])
    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection, {
      voiceScope: selectionStore.selection.voiceScope,
      activeVoiceIds: selectionStore.activeVoiceIds,
    })).toEqual([
      { startpos: 4, endpos: 6 },
      { startpos: 10, endpos: 12 },
    ])
  })

  it('expands editor-driven text selection immediately when the current scope is extract voices', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    const extractScopedIndex: SheetObjectIndex = {
      version: 1,
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

    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: extractScopedIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.extract-changed', activeVoiceIds: ['1', '2'] })
    selectionStore.dispatchSelectionEvent({ type: 'selection.scope-changed', voiceScope: 'extract-voices' })
    selectionStore.dispatchSelectionEvent({ type: 'selection.text-range-selected', startpos: 4, endpos: 6, source: 'abc-editor' })

    expect(selectionStore.selection.originSelectedIndexes).toEqual([0])
    expect(selectionStore.selection.selectedIndexes).toEqual([0, 1, 2, 3])
    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection, {
      voiceScope: selectionStore.selection.voiceScope,
      activeVoiceIds: selectionStore.activeVoiceIds,
    })).toEqual([
      { startpos: 4, endpos: 6 },
      { startpos: 10, endpos: 12 },
    ])
  })

  it('projects editor selections across all voices when the scope is switched', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({
      type: 'selection.render-refreshed',
      nextIndex: {
      ...sheetObjectIndex,
      byZnId: {
        ...sheetObjectIndex.byZnId,
        'note-3': [6, 7, 10, 11],
      },
      byConfKey: {
        ...sheetObjectIndex.byConfKey,
        'extract.0.notebound.nconf.v_1.t_384.n_0.***': [10],
        'extract.0.notebound.nconf.v_2.t_384.n_0.***': [11],
      },
      entries: [
        ...sheetObjectIndex.entries,
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
      },
    })
    selectionStore.dispatchSelectionEvent({ type: 'selection.scope-changed', voiceScope: 'all-voices' })
    selectionStore.dispatchSelectionEvent({ type: 'selection.indexes-selected', selectedIndexes: [5], source: 'abc-editor' })

    expect(resolveSvgSelection(selectionStore.sheetObjectIndex, selectionStore.selection, {
      voiceScope: selectionStore.selection.voiceScope,
    })).toEqual({
      znIds: [],
      confKeys: [
        'extract.0.note-3',
        'extract.0.note-4',
        'extract.0.notebound.nconf.v_1.t_384.n_0.***',
        'extract.0.notebound.nconf.v_2.t_384.n_0.***',
      ],
      textRanges: [{ startpos: 10, endpos: 12 }],
    })
  })

  it('expands the stored selection across the active extract voices when the scope changes', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.extract-changed', activeVoiceIds: ['1', '2'] })
    expect(selectionStore.activeVoiceIds).toEqual(['1', '2'])
    selectionStore.dispatchSelectionEvent({ type: 'selection.indexes-selected', selectedIndexes: [5], source: 'abc-editor' })

    expect(selectionStore.selection.selectedIndexes).toEqual([5])

    selectionStore.dispatchSelectionEvent({ type: 'selection.scope-changed', voiceScope: 'extract-voices' })

    expect(selectionStore.selection.selectedIndexes).toEqual([5, 6, 7, 8, 9])
    expect(selectionStore.selection.originSelectedIndexes).toEqual([5])
    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection, {
      voiceScope: selectionStore.selection.voiceScope,
      activeVoiceIds: selectionStore.activeVoiceIds,
    })).toEqual([{ startpos: 10, endpos: 12 }])
  })

  it('collapses an all-voice selection back to the original voice when the scope switches to single voice', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.indexes-selected', selectedIndexes: [5], source: 'abc-editor' })

    selectionStore.dispatchSelectionEvent({ type: 'selection.scope-changed', voiceScope: 'all-voices' })

    expect(selectionStore.selection.selectedIndexes).toEqual([5, 6, 7, 8, 9])
    expect(selectionStore.selection.originSelectedIndexes).toEqual([5])

    selectionStore.dispatchSelectionEvent({ type: 'selection.scope-changed', voiceScope: 'single-voice' })

    expect(selectionStore.selection.selectedIndexes).toEqual([5])
    expect(selectionStore.selection.originSelectedIndexes).toEqual([5])
  })

  it('limits editor block selection to the active extract voices', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({
      type: 'selection.render-refreshed',
      nextIndex: {
      ...sheetObjectIndex,
      byZnId: {
        ...sheetObjectIndex.byZnId,
        'note-3': [6, 7, 10, 11],
      },
      byConfKey: {
        ...sheetObjectIndex.byConfKey,
        'extract.0.notebound.nconf.v_1.t_384.n_0.***': [10],
        'extract.0.notebound.nconf.v_2.t_384.n_0.***': [11],
      },
      entries: [
        ...sheetObjectIndex.entries,
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
      },
    })
    selectionStore.dispatchSelectionEvent({ type: 'selection.scope-changed', voiceScope: 'extract-voices' })
    selectionStore.dispatchSelectionEvent({ type: 'selection.indexes-selected', selectedIndexes: [5], source: 'abc-editor' })

    expect(resolveSvgSelection(selectionStore.sheetObjectIndex, selectionStore.selection, {
      voiceScope: selectionStore.selection.voiceScope,
      activeVoiceIds: ['2'],
    })).toEqual({
      znIds: [],
      confKeys: [
        'extract.0.note-3',
        'extract.0.note-4',
        'extract.0.notebound.nconf.v_2.t_384.n_0.***',
      ],
      textRanges: [{ startpos: 10, endpos: 12 }],
    })
  })

  it('keeps extract-scoped score projection aligned with fachliche voice ids when song voice 0 is duplicated for legacy layouting', () => {
    setActivePinia(createPinia())

    const abcText = `X:1
T:Extract Scope
%%score 1 2 3 4
L:1/4
M:4/4
K:C
V:1 treble
V:2 treble
V:3 bass
V:4 bass
V:1
C
V:2
D
V:3
E
V:4
F

%%%%zupfnoter.config
{
  "extract": {
    "2": {
      "voices": [1, 3, 4]
    }
  }
}`

    const result = renderWorkbenchPreviews(abcText, 2)
    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: result.sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.extract-changed', activeVoiceIds: result.activeVoiceIds })

    const sopranoEntry = result.sheetObjectIndex?.entries.find((entry) =>
      entry.kind === 'music-entity'
      && entry.voiceId === '1'
      && entry.textRange !== undefined)

    expect(result.activeVoiceIds).toEqual(['1', '3', '4'])
    expect(result.allVoiceIds).toEqual(['1', '2', '3', '4'])
    expect(sopranoEntry?.textRange).toBeDefined()

    const textRange = sopranoEntry?.textRange
    if (textRange === undefined) return
    const expectedRanges = ['1', '3', '4']
      .map((voiceId) => result.sheetObjectIndex?.entries.find((entry) =>
        entry.kind === 'music-entity'
        && entry.voiceId === voiceId
        && entry.textRange !== undefined)?.textRange)
      .filter((range): range is { startpos: number, endpos: number } => range !== undefined)

    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: textRange.startpos,
      endpos: textRange.endpos,
      source: 'abc-editor',
    })
    selectionStore.dispatchSelectionEvent({ type: 'selection.scope-changed', voiceScope: 'extract-voices' })

    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection, {
      voiceScope: selectionStore.selection.voiceScope,
      activeVoiceIds: selectionStore.activeVoiceIds,
    })).toEqual(expectedRanges)
  })

  it('expands score-origin selections to all extract voices when the scope changes', () => {
    setActivePinia(createPinia())

    const abcText = `X:1
T:Extract Scope
%%score 1 2 3 4
L:1/4
M:4/4
K:C
V:1 treble
V:2 treble
V:3 bass
V:4 bass
V:1
C
V:2
D
V:3
E
V:4
F

%%%%zupfnoter.config
{
  "extract": {
    "2": {
      "voices": [1, 3, 4]
    }
  }
}`

    const result = renderWorkbenchPreviews(abcText, 2)
    const selectionStore = useSelectionStore()
    selectionStore.dispatchSelectionEvent({ type: 'selection.render-refreshed', nextIndex: result.sheetObjectIndex })
    selectionStore.dispatchSelectionEvent({ type: 'selection.extract-changed', activeVoiceIds: result.activeVoiceIds })

    const sopranoEntry = result.sheetObjectIndex?.entries.find((entry) =>
      entry.kind === 'music-entity'
      && entry.voiceId === '1'
      && entry.textRange !== undefined)

    expect(result.activeVoiceIds).toEqual(['1', '3', '4'])
    expect(sopranoEntry?.textRange).toBeDefined()

    const textRange = sopranoEntry?.textRange
    if (textRange === undefined) return
    const expectedRanges = ['1', '3', '4']
      .map((voiceId) => result.sheetObjectIndex?.entries.find((entry) =>
        entry.kind === 'music-entity'
        && entry.voiceId === voiceId
        && entry.textRange !== undefined)?.textRange)
      .filter((range): range is { startpos: number, endpos: number } => range !== undefined)

    selectionStore.dispatchSelectionEvent({
      type: 'selection.text-range-selected',
      startpos: textRange.startpos,
      endpos: textRange.endpos,
      source: 'score-preview',
    })

    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection, {
      voiceScope: selectionStore.selection.voiceScope,
      activeVoiceIds: selectionStore.activeVoiceIds,
    })).toEqual([textRange])

    selectionStore.dispatchSelectionEvent({ type: 'selection.scope-changed', voiceScope: 'extract-voices' })

    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection, {
      voiceScope: selectionStore.selection.voiceScope,
      activeVoiceIds: selectionStore.activeVoiceIds,
    })).toEqual(expectedRanges)
  })
})
