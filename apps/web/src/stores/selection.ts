import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type {
  SelectionLineColumn,
  SelectionSource,
  SelectionState,
  SheetObjectIndex,
} from '@zupfnoter/types'

import {
  normalizeLineColumnRange,
  projectLineColumnRangeToTextRange,
  resolveIndexesByConfKey,
  resolveIndexesByTextRangeAndKind,
  resolveIndexesByTextRange,
  resolveIndexesByZnId,
} from '../workbench/selectionIndex'

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
    const normalized = normalizeIndexes(selectedIndexes)
    selection.value = {
      selectedIndexes: normalized,
      anchorIndex: normalized[0],
      source,
    }
  }

  function selectZnId(znId: string, source: SelectionSource = 'command'): void {
    selectIndexes(resolveIndexesByZnId(sheetObjectIndex.value, znId), source)
  }

  function selectMusicRange(znIds: string[], source: SelectionSource = 'command'): void {
    selectIndexes(znIds.flatMap((znId) => resolveIndexesByZnId(sheetObjectIndex.value, znId)), source)
  }

  function selectTextRange(
    startpos: number,
    endpos: number,
    source: SelectionSource = 'abc-editor',
  ): void {
    const exactOrOverlapIndexes = source === 'score-preview'
      ? (() => {
        const exactScoreObjectIndexes = resolveIndexesByTextRangeAndKind(
          sheetObjectIndex.value,
          { startpos, endpos },
          'score-object',
          'score',
          'exact',
        )
        if (exactScoreObjectIndexes.length > 0) return exactScoreObjectIndexes

        const overlapScoreObjectIndexes = resolveIndexesByTextRangeAndKind(
          sheetObjectIndex.value,
          { startpos, endpos },
          'score-object',
          'score',
          'overlap',
        )
        if (overlapScoreObjectIndexes.length > 0) return overlapScoreObjectIndexes

        const exactIndexes = resolveIndexesByTextRange(sheetObjectIndex.value, { startpos, endpos }, undefined, 'exact')
        return exactIndexes.length > 0
          ? exactIndexes
          : resolveIndexesByTextRange(sheetObjectIndex.value, { startpos, endpos }, undefined, 'overlap')
      })()
      : source === 'abc-editor'
        ? (() => {
          const overlapScoreObjectIndexes = resolveIndexesByTextRangeAndKind(
            sheetObjectIndex.value,
            { startpos, endpos },
            'score-object',
            'editor',
            'overlap',
          )
          return overlapScoreObjectIndexes.length > 0
            ? overlapScoreObjectIndexes
            : resolveIndexesByTextRange(sheetObjectIndex.value, { startpos, endpos }, undefined, 'overlap')
        })()
        : resolveIndexesByTextRange(sheetObjectIndex.value, { startpos, endpos }, undefined, 'overlap')

    selectIndexes(exactOrOverlapIndexes, source)
  }

  function selectLineColumnRange(
    start: SelectionLineColumn,
    end: SelectionLineColumn,
    source: SelectionSource = 'abc-editor',
  ): void {
    const textRange = projectLineColumnRangeToTextRange(
      sheetObjectIndex.value,
      normalizeLineColumnRange(start, end),
    )
    if (textRange === undefined) {
      clearSelection(source)
      return
    }

    selectTextRange(textRange.startpos, textRange.endpos, source)
  }

  function selectConfigKey(confKey: string, source: SelectionSource = 'command'): void {
    selectIndexes(resolveIndexesByConfKey(sheetObjectIndex.value, confKey), source)
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
