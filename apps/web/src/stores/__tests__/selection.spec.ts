import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import type { SheetObjectIndex } from '@zupfnoter/types'

import { useSelectionStore } from '../selection'
import {
  projectIndexesToEntries,
  resolveEditorSelectionRange,
  resolveScoreSelectionRanges,
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
  entries: [
    {
      kind: 'music-entity',
      znId: 'note-1',
      textRange: { startpos: 4, endpos: 6 },
      startPos: { line: 2, column: 1 },
      endPos: { line: 2, column: 3 },
      addressableIn: { editor: true, score: true, svg: true },
    },
    {
      kind: 'music-entity',
      znId: 'note-2',
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

    expect(selectionStore.selection.selectedIndexes).toEqual([4])
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
    selectionStore.selectIndexes([5], 'abc-editor')

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
})
