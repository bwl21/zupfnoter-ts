import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type {
  SelectionLineColumn,
  SelectionSource,
  SelectionState,
  SelectionVoiceScope,
  SheetObjectIndex,
} from '@zupfnoter/types'

import {
  resolveSelectionByConfKey,
  resolveSelectionByIndexes,
  resolveSelectionByLineColumnRange,
  resolveSelectionByMusicRange,
  resolveSelectionEditorRange,
  resolveSelectionByTextRange,
  resolveSelectionByZnId,
} from '../workbench/selectionManager'

function createSelectionState(): SelectionState {
  return {
    selectedIndexes: [],
    source: 'command',
    voiceScope: 'single-voice',
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
      voiceScope: nextSelection.voiceScope,
    }
  }

  function clearSelection(source: SelectionSource = 'command'): void {
    selection.value = {
      selectedIndexes: [],
      source,
      voiceScope: selection.value.voiceScope,
    }
  }

  function setVoiceScope(voiceScope: SelectionVoiceScope): void {
    selection.value = {
      ...selection.value,
      voiceScope,
    }
  }

  function setSheetObjectIndex(nextSheetObjectIndex: SheetObjectIndex | undefined): void {
    const previousSelection = selection.value
    const previousEditorRange = previousSelection.source === 'abc-editor'
      ? resolveSelectionEditorRange(sheetObjectIndex.value, previousSelection)
      : undefined
    sheetObjectIndex.value = nextSheetObjectIndex
    if (previousEditorRange !== undefined && nextSheetObjectIndex !== undefined) {
      selection.value = resolveSelectionByTextRange(
        nextSheetObjectIndex,
        previousEditorRange.startpos,
        previousEditorRange.endpos,
        'abc-editor',
        previousSelection.voiceScope,
      )
      return
    }
    clearSelection(previousSelection.source)
  }

  function selectIndexes(selectedIndexes: number[], source: SelectionSource = 'command'): void {
    selection.value = resolveSelectionByIndexes(selectedIndexes, source, selection.value.voiceScope)
  }

  function selectZnId(znId: string, source: SelectionSource = 'command'): void {
    selection.value = resolveSelectionByZnId(sheetObjectIndex.value, znId, source, selection.value.voiceScope)
  }

  function selectMusicRange(znIds: string[], source: SelectionSource = 'command'): void {
    selection.value = resolveSelectionByMusicRange(sheetObjectIndex.value, znIds, source, selection.value.voiceScope)
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
      selection.value.voiceScope,
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
      selection.value.voiceScope,
    )
  }

  function selectConfigKey(confKey: string, source: SelectionSource = 'command'): void {
    selection.value = resolveSelectionByConfKey(sheetObjectIndex.value, confKey, source, selection.value.voiceScope)
  }

  const hasSelection = computed(() => selection.value.selectedIndexes.length > 0)

  return {
    selection,
    sheetObjectIndex,
    hasSelection,
    setSelection,
    setSheetObjectIndex,
    setVoiceScope,
    clearSelection,
    selectIndexes,
    selectMusicRange,
    selectZnId,
    selectTextRange,
    selectLineColumnRange,
    selectConfigKey,
  }
})
