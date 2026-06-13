import { onBeforeUnmount, watch, type Ref } from 'vue'

import type { PlaybackHighlight } from '@zupfnoter/types'

const PLAYBACK_HIGHLIGHT_CLASS = 'zn-playback-highlight'

function applyHighlightClass(element: HTMLElement): void {
  const hitboxes = element.matches('.zupfnoter-hitbox')
    ? [element]
    : [...element.querySelectorAll<HTMLElement>('.zupfnoter-hitbox')]

  if (hitboxes.length === 0) {
    element.classList.add(PLAYBACK_HIGHLIGHT_CLASS)
    return
  }

  hitboxes.forEach((hitbox) => {
    hitbox.classList.add(PLAYBACK_HIGHLIGHT_CLASS)
  })
}

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
  if (highlight.activeTextRanges.length === 0) return
  const textRanges = highlight.activeTextRanges
  root.querySelectorAll<HTMLElement>('.zupfnoter-hitbox[data-start-char][data-end-char]').forEach((element) => {
    const startChar = Number(element.dataset.startChar)
    const endChar = Number(element.dataset.endChar)
    if (Number.isNaN(startChar) || Number.isNaN(endChar)) return
    const overlaps = textRanges.some((tr) => endChar > tr.startpos && startChar < tr.endpos)
    if (!overlaps) return
    applyHighlightClass(element)
    element.dataset.playbackActive = 'true'
  })
}

export function usePlaybackSvgHighlight(
  rootRef: Ref<HTMLElement | null>,
  svgSource: Ref<string>,
  playbackHighlight: Ref<PlaybackHighlight | undefined>,
): void {
  let observer: MutationObserver | undefined

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
    rootRef,
    (root) => {
      observer?.disconnect()
      observer = undefined
      if (root === null) return
      observer = new MutationObserver(() => {
        sync()
      })
      observer.observe(root, { childList: true, subtree: true })
    },
    { immediate: true },
  )

  watch(
    [rootRef, svgSource, playbackHighlight],
    sync,
    { immediate: true, deep: true, flush: 'post' },
  )

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = undefined
    const root = rootRef.value
    if (root === null) return
    clearPlaybackHighlight(root)
  })
}
