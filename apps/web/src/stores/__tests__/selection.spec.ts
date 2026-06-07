import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import type { SelectionIndex } from '@zupfnoter/types'

import { useSelectionStore } from '../selection'

const selectionIndex: SelectionIndex = {
  lineStarts: [0, 4, 9],
  byZnId: {
    'note-1': {
      znId: 'note-1',
      textRange: { startpos: 4, endpos: 6 },
      startPos: { line: 2, column: 1 },
      endPos: { line: 2, column: 3 },
    },
    'note-2': {
      znId: 'note-2',
      textRange: { startpos: 7, endpos: 8 },
      startPos: { line: 2, column: 4 },
      endPos: { line: 2, column: 5 },
    },
  },
  entries: [
    {
      znId: 'note-1',
      textRange: { startpos: 4, endpos: 6 },
      startPos: { line: 2, column: 1 },
      endPos: { line: 2, column: 3 },
    },
    {
      znId: 'note-2',
      textRange: { startpos: 7, endpos: 8 },
      startPos: { line: 2, column: 4 },
      endPos: { line: 2, column: 5 },
    },
  ],
}

describe('selection store', () => {
  it('projects znId selections through the selection index', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.setSelectionIndex(selectionIndex)

    selectionStore.selectMusicRange(['note-1', 'note-2'], 'harp-preview')

    expect(selectionStore.selection.kind).toBe('music-range')
    expect(selectionStore.selection.znIds).toEqual(['note-1', 'note-2'])
    expect(selectionStore.selection.textRange).toEqual({ startpos: 4, endpos: 8 })
    expect(selectionStore.selection.lineColumnRange).toEqual({
      start: { line: 2, column: 1 },
      end: { line: 2, column: 5 },
    })
    expect(selectionStore.selection.startChar).toBe(4)
  })

  it('projects text selections back to znIds through the selection index', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.setSelectionIndex(selectionIndex)

    selectionStore.selectTextRange(4, 7)

    expect(selectionStore.selection.kind).toBe('abc-range')
    expect(selectionStore.selection.znIds).toEqual(['note-1', 'note-2'])
    expect(selectionStore.selection.textRange).toEqual({ startpos: 4, endpos: 7 })
    expect(selectionStore.selection.lineColumnRange).toEqual({
      start: { line: 2, column: 1 },
      end: { line: 2, column: 4 },
    })
  })

  it('re-enriches the current selection when a new selection index arrives', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    selectionStore.selectZnId('note-1', 'harp-preview')

    expect(selectionStore.selection.textRange).toBeUndefined()

    selectionStore.setSelectionIndex(selectionIndex)

    expect(selectionStore.selection.textRange).toEqual({ startpos: 4, endpos: 6 })
    expect(selectionStore.selection.lineColumnRange).toEqual({
      start: { line: 2, column: 1 },
      end: { line: 2, column: 3 },
    })
  })
})
