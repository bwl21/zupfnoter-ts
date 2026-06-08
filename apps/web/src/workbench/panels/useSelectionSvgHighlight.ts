import { onBeforeUnmount, watch, type Ref } from 'vue'

import type { SelectionTextRange } from '@zupfnoter/types'

const SELECTION_HIGHLIGHT_CLASS = 'zn-selection-highlight'

function applyHighlightClass(element: HTMLElement): void {
  const hitboxes = element.matches('.zupfnoter-hitbox')
    ? [element]
    : [...element.querySelectorAll<HTMLElement>('.zupfnoter-hitbox')]

  if (hitboxes.length === 0) {
    element.classList.add(SELECTION_HIGHLIGHT_CLASS)
    return
  }

  hitboxes.forEach((hitbox) => {
    hitbox.classList.add(SELECTION_HIGHLIGHT_CLASS)
  })
}

function clearSelectionHighlight(root: HTMLElement): void {
  root.querySelectorAll(`.${SELECTION_HIGHLIGHT_CLASS}`).forEach((element) => {
    element.classList.remove(SELECTION_HIGHLIGHT_CLASS)
  })
}

function applySelectionHighlight(
  root: HTMLElement,
  selection: {
    znIds: string[]
    confKeys: string[]
    textRanges: SelectionTextRange[]
  },
): void {
  clearSelectionHighlight(root)
  const selectedIds = new Set(selection.znIds)
  const selectedConfKeys = new Set(selection.confKeys)

  root.querySelectorAll<HTMLElement>('[data-zn-id], [data-conf-key]').forEach((element) => {
    const znId = element.dataset.znId
    const confKey = element.dataset.confKey
    if (znId !== undefined && selectedIds.has(znId)) {
      applyHighlightClass(element)
      return
    }
    if (confKey !== undefined && selectedConfKeys.has(confKey)) {
      applyHighlightClass(element)
      return
    }
    if (selection.textRanges.length === 0) return
    const startChar = Number(element.dataset.startChar)
    const endChar = Number(element.dataset.endChar)
    if (Number.isNaN(startChar) || Number.isNaN(endChar)) return
    const overlaps = selection.textRanges.some((textRange) => !(endChar < textRange.startpos || startChar > textRange.endpos))
    if (!overlaps) return
    applyHighlightClass(element)
  })
}

export function useSelectionSvgHighlight(
  rootRef: Ref<HTMLElement | null>,
  svgSource: Ref<string>,
  selection: Ref<{ znIds: string[]; confKeys: string[]; textRanges: SelectionTextRange[] } | undefined>,
): void {
  let observer: MutationObserver | undefined

  const sync = (): void => {
    const root = rootRef.value
    if (root === null) return
    applySelectionHighlight(root, selection.value ?? { znIds: [], confKeys: [], textRanges: [] })
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
    [rootRef, svgSource, selection],
    sync,
    { immediate: true, deep: true, flush: 'post' },
  )

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = undefined
    const root = rootRef.value
    if (root === null) return
    clearSelectionHighlight(root)
  })
}
