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
    selectionStore.setSheetObjectIndex(sheetObjectIndex)
    selectionStore.selectTextRange(4, 6, 'abc-editor')

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
    selectionStore.setSheetObjectIndex(sheetObjectIndex)
    selectionStore.selectTextRange(0, 3, 'score-preview')

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

  it('resolves config selections into svg-addressable entries', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.setSheetObjectIndex(sheetObjectIndex)
    selectionStore.selectConfigKey('extract.0.note-1')

    expect(selectionStore.selection.selectedIndexes).toEqual([2])
    expect(projectIndexesToEntries(selectionStore.sheetObjectIndex, selectionStore.selection.selectedIndexes))
      .toEqual([sheetObjectIndex.entries[2]])
  })

  it('resolves harp selections into svg-addressable entries', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.setSheetObjectIndex(sheetObjectIndex)
    selectionStore.selectZnId('note-1', 'harp-preview')

    expect(selectionStore.selection.selectedIndexes).toEqual([0, 2])
    expect(resolveSvgSelection(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual({
        znIds: ['note-1'],
        confKeys: ['extract.0.note-1'],
        textRanges: [{ startpos: 4, endpos: 6 }],
      })
  })

  it('keeps harp playback znIds on the directly selected note when another voice shares the same text range', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.setSheetObjectIndex(sheetObjectIndex)
    selectionStore.selectZnId('note-3', 'harp-preview')

    expect(resolveSelectedZnIds(selectionStore.sheetObjectIndex, selectionStore.selection))
      .toEqual(['note-3'])
  })

  it('projects score-addressable text selections into svg-addressable harp entries', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.setSheetObjectIndex(sheetObjectIndex)
    selectionStore.selectIndexes([4], 'abc-editor')

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
    selectionStore.setSheetObjectIndex(sheetObjectIndex)
    selectionStore.selectTextRange(10, 12, 'abc-editor')

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
    selectionStore.setSheetObjectIndex({
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
    })
    selectionStore.selectIndexes([5], 'abc-editor')

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
    selectionStore.setSheetObjectIndex(sheetObjectIndex)
    selectionStore.selectZnId('note-1', 'harp-preview')
    expect(selectionStore.selection.selectedIndexes).toEqual([0, 2])

    selectionStore.setSheetObjectIndex({
      ...sheetObjectIndex,
      version: 2,
    })

    expect(selectionStore.selection.selectedIndexes).toEqual([])
  })

  it('reprojects an editor selection when a new render index arrives', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.setSheetObjectIndex(sheetObjectIndex)
    selectionStore.selectTextRange(4, 6, 'abc-editor')

    selectionStore.setSheetObjectIndex({
      ...sheetObjectIndex,
      version: 2,
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

  it('projects editor selections across all voices when the scope is switched', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.setSheetObjectIndex({
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
    })
    selectionStore.setVoiceScope('all-voices')
    selectionStore.selectIndexes([5], 'abc-editor')

    expect(resolveSvgSelection(selectionStore.sheetObjectIndex, selectionStore.selection, {
      voiceScope: selectionStore.selection.voiceScope,
    })).toEqual({
      znIds: [],
      confKeys: [
        'extract.0.note-3',
        'extract.0.notebound.nconf.v_1.t_384.n_0.***',
        'extract.0.notebound.nconf.v_2.t_384.n_0.***',
        'extract.0.note-4',
      ],
      textRanges: [{ startpos: 10, endpos: 12 }],
    })
  })

  it('expands the stored selection across the active extract voices when the scope changes', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.setSheetObjectIndex(sheetObjectIndex)
    selectionStore.setActiveVoiceIds(['1', '2'])
    selectionStore.selectIndexes([5], 'abc-editor')

    expect(selectionStore.selection.selectedIndexes).toEqual([5])

    selectionStore.setVoiceScope('extract-voices')

    expect(selectionStore.selection.selectedIndexes).toEqual([5, 6, 7, 8, 9])
    expect(selectionStore.selection.baseSelectedIndexes).toEqual([5])
    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection, {
      voiceScope: selectionStore.selection.voiceScope,
      activeVoiceIds: selectionStore.activeVoiceIds,
    })).toEqual([{ startpos: 10, endpos: 12 }])
  })

  it('collapses an all-voice selection back to the original voice when the scope switches to single voice', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.setSheetObjectIndex(sheetObjectIndex)
    selectionStore.selectIndexes([5], 'abc-editor')

    selectionStore.setVoiceScope('all-voices')

    expect(selectionStore.selection.selectedIndexes).toEqual([5, 6, 7, 8, 9])
    expect(selectionStore.selection.baseSelectedIndexes).toEqual([5])

    selectionStore.setVoiceScope('single-voice')

    expect(selectionStore.selection.selectedIndexes).toEqual([5])
    expect(selectionStore.selection.baseSelectedIndexes).toEqual([5])
  })

  it('limits editor block selection to the active extract voices', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.setSheetObjectIndex({
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
    })
    selectionStore.setVoiceScope('extract-voices')
    selectionStore.selectIndexes([5], 'abc-editor')

    expect(resolveSvgSelection(selectionStore.sheetObjectIndex, selectionStore.selection, {
      voiceScope: selectionStore.selection.voiceScope,
      activeVoiceIds: ['2'],
    })).toEqual({
      znIds: [],
      confKeys: [
        'extract.0.note-3',
        'extract.0.notebound.nconf.v_2.t_384.n_0.***',
        'extract.0.note-4',
      ],
      textRanges: [{ startpos: 10, endpos: 12 }],
    })
  })
})
