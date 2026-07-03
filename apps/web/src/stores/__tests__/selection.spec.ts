import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import type { SheetObjectIndex } from '@zupfnoter/types'

import { useSelectionStore } from '../selection'
import {
  projectIndexesToEntries,
  resolveEditorSelectionRange,
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
