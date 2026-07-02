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
  resolveSelectionWithVoiceScope,
  resolveSelectionByZnId,
} from '../workbench/selectionManager'

function createSelectionState(): SelectionState {
  return {
    selectedIndexes: [],
    baseSelectedIndexes: [],
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
  const activeVoiceIds = ref<string[]>([])

  function setSelection(nextSelection: SelectionState): void {
    const normalizedSelectedIndexes = normalizeIndexes(nextSelection.selectedIndexes)
    const normalizedBaseSelectedIndexes = normalizeIndexes(
      nextSelection.baseSelectedIndexes.length > 0
        ? nextSelection.baseSelectedIndexes
        : nextSelection.selectedIndexes,
    )
    selection.value = {
      ...nextSelection,
      selectedIndexes: normalizedSelectedIndexes,
      baseSelectedIndexes: normalizedBaseSelectedIndexes,
      anchorIndex: nextSelection.anchorIndex ?? normalizedSelectedIndexes[0],
      voiceScope: nextSelection.voiceScope,
    }
  }

  function clearSelection(source: SelectionSource = 'command'): void {
    selection.value = {
      selectedIndexes: [],
      baseSelectedIndexes: [],
      source,
      voiceScope: selection.value.voiceScope,
    }
  }

  function setVoiceScope(voiceScope: SelectionVoiceScope): void {
    selection.value = resolveSelectionWithVoiceScope(
      sheetObjectIndex.value,
      selection.value,
      voiceScope,
      {
        activeVoiceIds: activeVoiceIds.value,
      },
    )
  }

  function setActiveVoiceIds(nextActiveVoiceIds: string[]): void {
    activeVoiceIds.value = [...new Set(nextActiveVoiceIds)]
    if (selection.value.selectedIndexes.length === 0) return
    if (selection.value.voiceScope !== 'extract-voices') return
    selection.value = resolveSelectionWithVoiceScope(
      sheetObjectIndex.value,
      selection.value,
      selection.value.voiceScope,
      {
        activeVoiceIds: activeVoiceIds.value,
      },
    )
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
    activeVoiceIds,
    hasSelection,
    setSelection,
    setSheetObjectIndex,
    setVoiceScope,
    setActiveVoiceIds,
    clearSelection,
    selectIndexes,
    selectMusicRange,
    selectZnId,
    selectTextRange,
    selectLineColumnRange,
    selectConfigKey,
  }
})
