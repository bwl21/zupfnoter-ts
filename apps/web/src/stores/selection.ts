import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type {
  SelectionIndex,
  SelectionLineColumn,
  SelectionState,
  SelectionTextRange,
} from '@zupfnoter/types'

import {
  normalizeLineColumnRange,
  projectLineColumnRangeToTextRange,
  projectTextRangeToLineColumnRange,
  projectTextRangeToZnIds,
  projectZnIdsToTextRange,
} from '../workbench/selectionIndex'

function createSelectionState(): SelectionState {
  return {
    kind: 'none',
    znIds: [],
    source: 'command',
  }
}

function cloneLineColumn(position: SelectionLineColumn): SelectionLineColumn {
  return {
    line: position.line,
    column: position.column,
  }
}

function cloneTextRange(range: SelectionTextRange | undefined): SelectionTextRange | undefined {
  if (range === undefined) return undefined
  return { ...range }
}

function cloneSelection(selection: SelectionState): SelectionState {
  return {
    ...selection,
    znIds: [...selection.znIds],
    textRange: cloneTextRange(selection.textRange),
    lineColumnRange: selection.lineColumnRange === undefined
      ? undefined
      : {
        start: cloneLineColumn(selection.lineColumnRange.start),
        end: cloneLineColumn(selection.lineColumnRange.end),
      },
  }
}

function normalizeTextRange(startpos: number, endpos: number): SelectionTextRange {
  return startpos <= endpos
    ? { startpos, endpos }
    : { startpos: endpos, endpos: startpos }
}

function enrichSelection(selectionIndex: SelectionIndex | undefined, selection: SelectionState): SelectionState {
  if (selection.kind === 'none') {
    return {
      kind: 'none',
      znIds: [],
      source: selection.source,
    }
  }

  const nextSelection = cloneSelection(selection)

  if (selection.kind === 'music-range') {
    nextSelection.textRange = projectZnIdsToTextRange(selectionIndex, selection.znIds)
    nextSelection.lineColumnRange = nextSelection.textRange === undefined
      ? undefined
      : projectTextRangeToLineColumnRange(selectionIndex, nextSelection.textRange)
    nextSelection.startChar = nextSelection.textRange?.startpos
    return nextSelection
  }

  if (selection.kind === 'abc-range') {
    const textRange = selection.textRange ?? (
      selection.lineColumnRange === undefined
        ? undefined
        : projectLineColumnRangeToTextRange(selectionIndex, selection.lineColumnRange)
    )
    nextSelection.textRange = textRange
    nextSelection.lineColumnRange = selection.lineColumnRange === undefined
      ? textRange === undefined
        ? undefined
        : projectTextRangeToLineColumnRange(selectionIndex, textRange)
      : normalizeLineColumnRange(selection.lineColumnRange.start, selection.lineColumnRange.end)
    nextSelection.znIds = textRange === undefined ? [] : projectTextRangeToZnIds(selectionIndex, textRange)
    nextSelection.startChar = textRange?.startpos
    return nextSelection
  }

  if (selection.kind === 'config-object') {
    nextSelection.textRange = undefined
    nextSelection.lineColumnRange = undefined
    nextSelection.startChar = undefined
    nextSelection.znIds = []
    return nextSelection
  }

  nextSelection.textRange = undefined
  nextSelection.lineColumnRange = undefined
  nextSelection.startChar = undefined
  nextSelection.znIds = []
  return nextSelection
}

export const useSelectionStore = defineStore('selection', () => {
  const selection = ref<SelectionState>(createSelectionState())
  const selectionIndex = ref<SelectionIndex | undefined>(undefined)

  function setSelection(nextSelection: SelectionState): void {
    selection.value = enrichSelection(selectionIndex.value, nextSelection)
  }

  function setSelectionIndex(nextSelectionIndex: SelectionIndex | undefined): void {
    selectionIndex.value = nextSelectionIndex
    selection.value = enrichSelection(nextSelectionIndex, selection.value)
  }

  function clearSelection(source: SelectionState['source'] = 'command'): void {
    selection.value = {
      kind: 'none',
      znIds: [],
      source,
    }
  }

  function selectMusicRange(znIds: string[], source: SelectionState['source'] = 'command'): void {
    setSelection({
      kind: 'music-range',
      znIds: [...znIds],
      source,
    })
  }

  function selectZnId(znId: string, source: SelectionState['source'] = 'command'): void {
    selectMusicRange([znId], source)
  }

  function selectTextRange(startpos: number, endpos: number, source: SelectionState['source'] = 'abc-editor'): void {
    setSelection({
      kind: 'abc-range',
      znIds: [],
      textRange: normalizeTextRange(startpos, endpos),
      source,
    })
  }

  function selectLineColumnRange(
    start: SelectionLineColumn,
    end: SelectionLineColumn,
    source: SelectionState['source'] = 'abc-editor',
  ): void {
    setSelection({
      kind: 'abc-range',
      znIds: [],
      lineColumnRange: normalizeLineColumnRange(start, end),
      source,
    })
  }

  function selectConfigKey(confKey: string, source: SelectionState['source'] = 'command'): void {
    setSelection({
      kind: 'config-object',
      znIds: [],
      confKey,
      source,
    })
  }

  function selectAbcElement(abcElementKind: string, source: SelectionState['source'] = 'abc-editor'): void {
    setSelection({
      kind: 'abc-element',
      znIds: [],
      abcElementKind,
      source,
    })
  }

  const hasSelection = computed(() => selection.value.kind !== 'none')

  return {
    selection,
    selectionIndex,
    hasSelection,
    setSelection,
    setSelectionIndex,
    clearSelection,
    selectMusicRange,
    selectZnId,
    selectTextRange,
    selectLineColumnRange,
    selectConfigKey,
    selectAbcElement,
  }
})
