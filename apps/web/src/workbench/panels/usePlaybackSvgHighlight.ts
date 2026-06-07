import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

import type { PlaybackHighlight } from '@zupfnoter/types'

const PLAYBACK_HIGHLIGHT_CLASS = 'zn-playback-highlight'

function clearPlaybackHighlight(root: HTMLElement): void {
  root.querySelectorAll(`.${PLAYBACK_HIGHLIGHT_CLASS}`).forEach((element) => {
    element.classList.remove(PLAYBACK_HIGHLIGHT_CLASS)
    if (element instanceof HTMLElement) {
      element.dataset.playbackActive = 'false'
    }
  })
}

function applyPlaybackHighlight(root: HTMLElement, highlight: PlaybackHighlight): void {
  clearPlaybackHighlight(root)
  if (highlight.activeZnIds.length === 0) return
  const activeIds = new Set(highlight.activeZnIds)
  root.querySelectorAll<HTMLElement>('[data-zn-id]').forEach((element) => {
    const znId = element.dataset.znId
    if (znId === undefined || !activeIds.has(znId)) return
    element.classList.add(PLAYBACK_HIGHLIGHT_CLASS)
    element.dataset.playbackActive = 'true'
  })
}

export function usePlaybackSvgHighlight(
  rootRef: Ref<HTMLElement | null>,
  svgSource: Ref<string>,
  playbackHighlight: Ref<PlaybackHighlight | undefined>,
): void {
  const sync = (): void => {
    const root = rootRef.value
    if (root === null) return
    if (playbackHighlight.value === undefined) {
      clearPlaybackHighlight(root)
      return
    }
    applyPlaybackHighlight(root, playbackHighlight.value)
  }

  watch(
    [rootRef, svgSource, playbackHighlight],
    () => {
      void nextTick().then(sync)
    },
    { immediate: true, deep: true },
  )

  onBeforeUnmount(() => {
    const root = rootRef.value
    if (root === null) return
    clearPlaybackHighlight(root)
  })
}
