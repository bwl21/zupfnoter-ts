import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type {
  SelectionLineColumn,
  SelectionSource,
  SelectionState,
  SheetObjectIndex,
} from '@zupfnoter/types'

import {
  resolveSelectionByConfKey,
  resolveSelectionByIndexes,
  resolveSelectionByLineColumnRange,
  resolveSelectionByMusicRange,
  resolveSelectionByTextRange,
  resolveSelectionByZnId,
} from '../workbench/selectionManager'

function createSelectionState(): SelectionState {
  return {
    selectedIndexes: [],
    source: 'command',
  }
}

function normalizeIndexes(indexes: number[]): number[] {
  return [...new Set(indexes)].sort((left, right) => left - right)
}

export const useSelectionStore = defineStore('selection', () => {
  const selection = ref<SelectionState>(createSelectionState())
  const sheetObjectIndex = ref<SheetObjectIndex | undefined>(undefined)

  function setSelection(nextSelection: SelectionState): void {
    selection.value = {
      ...nextSelection,
      selectedIndexes: normalizeIndexes(nextSelection.selectedIndexes),
      anchorIndex: nextSelection.anchorIndex ?? nextSelection.selectedIndexes[0],
    }
  }

  function clearSelection(source: SelectionSource = 'command'): void {
    selection.value = {
      selectedIndexes: [],
      source,
    }
  }

  function setSheetObjectIndex(nextSheetObjectIndex: SheetObjectIndex | undefined): void {
    sheetObjectIndex.value = nextSheetObjectIndex
    clearSelection(selection.value.source)
  }

  function selectIndexes(selectedIndexes: number[], source: SelectionSource = 'command'): void {
    selection.value = resolveSelectionByIndexes(selectedIndexes, source)
  }

  function selectZnId(znId: string, source: SelectionSource = 'command'): void {
    selection.value = resolveSelectionByZnId(sheetObjectIndex.value, znId, source)
  }

  function selectMusicRange(znIds: string[], source: SelectionSource = 'command'): void {
    selection.value = resolveSelectionByMusicRange(sheetObjectIndex.value, znIds, source)
  }

  function selectTextRange(
    startpos: number,
    endpos: number,
    source: SelectionSource = 'abc-editor',
  ): void {
    selection.value = resolveSelectionByTextRange(
      sheetObjectIndex.value,
      startpos,
      endpos,
      source,
    )
  }

  function selectLineColumnRange(
    start: SelectionLineColumn,
    end: SelectionLineColumn,
    source: SelectionSource = 'abc-editor',
  ): void {
    selection.value = resolveSelectionByLineColumnRange(
      sheetObjectIndex.value,
      start,
      end,
      source,
    )
  }

  function selectConfigKey(confKey: string, source: SelectionSource = 'command'): void {
    selection.value = resolveSelectionByConfKey(sheetObjectIndex.value, confKey, source)
  }

  const hasSelection = computed(() => selection.value.selectedIndexes.length > 0)

  return {
    selection,
    sheetObjectIndex,
    hasSelection,
    setSelection,
    setSheetObjectIndex,
    clearSelection,
    selectIndexes,
    selectMusicRange,
    selectZnId,
    selectTextRange,
    selectLineColumnRange,
    selectConfigKey,
  }
})
