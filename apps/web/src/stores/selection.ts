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
    selection.value = dispatchSelectionStateEvent(event, {
      selection: selection.value,
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
