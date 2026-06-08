import { onBeforeUnmount, watch, type Ref } from 'vue'

import type { SheetObjectIndexEntry } from '@zupfnoter/types'
import { textRangeKey } from '../selectionIndex'

function clearHighlight(root: HTMLElement, highlightClass: string): void {
  root.querySelectorAll(`.${highlightClass}`).forEach((element) => {
    element.classList.remove(highlightClass)
  })
}

function applyHighlight(
  root: HTMLElement,
  entries: SheetObjectIndexEntry[],
  highlightClass: string,
): void {
  clearHighlight(root, highlightClass)
  if (entries.length === 0) return

  const keys = new Set<string>()
  for (const entry of entries) {
    if (entry.textRange !== undefined) {
      keys.add(textRangeKey(entry.textRange))
    }
  }
  root.querySelectorAll<HTMLElement>('[data-start-char][data-end-char]').forEach((element) => {
    const startChar = Number(element.dataset.startChar)
    const endChar = Number(element.dataset.endChar)
    if (Number.isNaN(startChar) || Number.isNaN(endChar)) return
    if (!keys.has(textRangeKey({ startpos: startChar, endpos: endChar }))) return
    element.classList.add(highlightClass)
  })
}

export function useSelectionEntriesSvgHighlight(
  rootRef: Ref<HTMLElement | null>,
  svgSource: Ref<string>,
  entries: Ref<SheetObjectIndexEntry[] | undefined>,
  highlightClass: 'zn-selection-highlight-entry' | 'zn-playback-highlight',
): void {
  let observer: MutationObserver | undefined

  const sync = (): void => {
    const root = rootRef.value
    if (root === null) return
    if (entries.value === undefined) {
      clearHighlight(root, highlightClass)
      return
    }
    applyHighlight(root, entries.value, highlightClass)
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
    [rootRef, svgSource, entries],
    sync,
    { immediate: true, deep: true, flush: 'post' },
  )

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = undefined
    const root = rootRef.value
    if (root === null) return
    clearHighlight(root, highlightClass)
  })
}
