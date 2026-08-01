import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type {
  SelectionEvent,
  SheetObjectIndex,
} from '@zupfnoter/types'

import {
  createClearedSelectionState,
  dispatchSelectionEvent as dispatchSelectionStateEvent,
} from '../workbench/selectionManager'

export const useSelectionStore = defineStore('selection', () => {
  const selection = ref(createClearedSelectionState())
  const sheetObjectIndex = ref<SheetObjectIndex | undefined>(undefined)
  const activeVoiceIds = ref<string[]>([])

  function dispatchSelectionEvent(event: SelectionEvent): void {
    const previousSheetObjectIndex = sheetObjectIndex.value
    if (event.type === 'selection.render-refreshed') {
      sheetObjectIndex.value = event.nextIndex
    }
    if (event.type === 'selection.extract-changed') {
      activeVoiceIds.value = [...new Set(event.activeVoiceIds)]
    }
    const selectionForEvent = event.type === 'selection.render-refreshed'
      && selection.value.source === 'harp-preview'
      ? createClearedSelectionState(selection.value.source, selection.value.voiceScope)
      : selection.value
    selection.value = dispatchSelectionStateEvent(event, {
      selection: selectionForEvent,
      sheetObjectIndex: previousSheetObjectIndex,
      activeVoiceIds: activeVoiceIds.value,
    })
  }

  const hasSelection = computed(() => selection.value.selectedIndexes.length > 0)

  return {
    selection,
    sheetObjectIndex,
    activeVoiceIds,
    hasSelection,
    dispatchSelectionEvent,
  }
})
