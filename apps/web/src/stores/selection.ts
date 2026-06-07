import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { SelectionState } from '@zupfnoter/types'

function createSelectionState(): SelectionState {
  return {
    kind: 'none',
    znIds: [],
    source: 'command',
  }
}

function cloneSelection(selection: SelectionState): SelectionState {
  return {
    ...selection,
    znIds: [...selection.znIds],
    textRange: selection.textRange === undefined
      ? undefined
      : { ...selection.textRange },
  }
}

export const useSelectionStore = defineStore('selection', () => {
  const selection = ref<SelectionState>(createSelectionState())

  function setSelection(nextSelection: SelectionState): void {
    selection.value = cloneSelection(nextSelection)
  }

  function clearSelection(source: SelectionState['source'] = 'command'): void {
    selection.value = {
      kind: 'none',
      znIds: [],
      source,
    }
  }

  function selectMusicRange(znIds: string[], source: SelectionState['source'] = 'command'): void {
    selection.value = {
      kind: 'music-range',
      znIds: [...znIds],
      source,
    }
  }

  function selectZnId(znId: string, source: SelectionState['source'] = 'command'): void {
    selectMusicRange([znId], source)
  }

  function selectTextRange(startpos: number, endpos: number, source: SelectionState['source'] = 'abc-editor'): void {
    selection.value = {
      kind: 'abc-range',
      znIds: [],
      textRange: { startpos, endpos },
      source,
    }
  }

  function selectConfigKey(confKey: string, source: SelectionState['source'] = 'command'): void {
    selection.value = {
      kind: 'config-object',
      znIds: [],
      confKey,
      source,
    }
  }

  function selectAbcElement(abcElementKind: string, source: SelectionState['source'] = 'abc-editor'): void {
    selection.value = {
      kind: 'abc-element',
      znIds: [],
      abcElementKind,
      source,
    }
  }

  const hasSelection = computed(() => selection.value.kind !== 'none')

  return {
    selection,
    hasSelection,
    setSelection,
    clearSelection,
    selectMusicRange,
    selectZnId,
    selectTextRange,
    selectConfigKey,
    selectAbcElement,
  }
})
