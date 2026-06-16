import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import type {
  PlaybackHighlight,
  PlaybackMode,
  PlaybackPlayerEvent,
  PlaybackState,
} from '@zupfnoter/types'

import { useSelectionStore } from './selection'
import {
  createEmptyPlaybackHighlight,
  createPlaybackHighlightFromEvent,
  resolvePlaybackMode,
} from '../workbench/playback'
import { textRangeKey } from '../workbench/selectionIndex'

const SPEED_STEP = 0.1

function createPlaybackState(): PlaybackState {
  return {
    status: 'stopped',
    speedFactor: 1,
    activeExtract: 0,
    documentVersion: 0,
    totalPassCount: undefined,
  }
}

function clampSpeed(speedFactor: number): number {
  return Math.min(4, Math.max(0.25, Math.round(speedFactor * 100) / 100))
}

export const usePlaybackStore = defineStore('playback', () => {
  const selectionStore = useSelectionStore()
  const state = ref<PlaybackState>(createPlaybackState())
  const highlight = ref<PlaybackHighlight>(createEmptyPlaybackHighlight())

  const mode = computed<PlaybackMode>(() => resolvePlaybackMode(
    selectionStore.selection,
    selectionStore.sheetObjectIndex,
    state.value.activeExtract,
  ))

  function syncMode(): void {
    state.value = {
      ...state.value,
      mode: mode.value,
    }
  }

  function setActiveExtract(activeExtract: number): void {
    state.value = {
      ...state.value,
      activeExtract,
    }
    syncMode()
  }

  function setSpeedFactor(nextSpeedFactor: number): void {
    state.value = {
      ...state.value,
      speedFactor: clampSpeed(nextSpeedFactor),
    }
  }

  function increaseSpeed(): void {
    setSpeedFactor(state.value.speedFactor + SPEED_STEP)
  }

  function decreaseSpeed(): void {
    setSpeedFactor(state.value.speedFactor - SPEED_STEP)
  }

  function resetSpeed(): void {
    setSpeedFactor(1)
  }

  function startPlayback(baseTempoFromQ?: number, totalPassCount?: number): void {
    state.value = {
      ...state.value,
      status: 'playing',
      baseTempoFromQ,
      totalPassCount,
      mode: mode.value,
    }
  }

  function pausePlayback(): void {
    state.value = {
      ...state.value,
      status: 'paused',
    }
  }

  function stopPlayback(): void {
    state.value = {
      ...state.value,
      status: 'stopped',
      totalPassCount: undefined,
    }
    highlight.value = createEmptyPlaybackHighlight()
  }

  function addHighlightRanges(ranges: PlaybackHighlight['activeTextRanges']): void {
    const current = new Map(highlight.value.activeTextRanges.map((range) => [textRangeKey(range), range] as const))
    for (const range of ranges) {
      current.set(textRangeKey(range), { ...range })
    }
    highlight.value = {
      ...highlight.value,
      activeTextRanges: [...current.values()],
    }
  }

  function removeHighlightRanges(ranges: PlaybackHighlight['activeTextRanges']): void {
    const removeKeys = new Set(ranges.map((range) => textRangeKey(range)))
    highlight.value = {
      ...highlight.value,
      activeTextRanges: highlight.value.activeTextRanges.filter((range) => !removeKeys.has(textRangeKey(range))),
    }
  }

  function markDocumentChanged(): void {
    state.value = {
      ...state.value,
      documentVersion: state.value.documentVersion + 1,
    }
    stopPlayback()
  }

  function handlePlayerEvent(event: PlaybackPlayerEvent): void {
    if (event.kind === 'current-notes') {
      highlight.value = createPlaybackHighlightFromEvent(event)
      return
    }

    if (event.kind === 'pause') {
      pausePlayback()
      return
    }

    if (event.kind === 'stop') {
      stopPlayback()
      return
    }

    highlight.value = createEmptyPlaybackHighlight()
  }

  watch(
    () => selectionStore.selection,
    () => {
      syncMode()
    },
    { deep: true, immediate: true },
  )

  return {
    state,
    highlight,
    mode,
    setActiveExtract,
    setSpeedFactor,
    increaseSpeed,
    decreaseSpeed,
    resetSpeed,
    startPlayback,
    pausePlayback,
    stopPlayback,
    addHighlightRanges,
    removeHighlightRanges,
    markDocumentChanged,
    handlePlayerEvent,
  }
})
