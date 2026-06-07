import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

import type { SelectionTextRange } from '@zupfnoter/types'

function clearTextRangeHighlight(root: HTMLElement, highlightClass: string): void {
  root.querySelectorAll(`.${highlightClass}`).forEach((element) => {
    element.classList.remove(highlightClass)
  })
}

function applyTextRangeHighlight(
  root: HTMLElement,
  textRange: SelectionTextRange,
  highlightClass: string,
): void {
  clearTextRangeHighlight(root, highlightClass)

  root.querySelectorAll<HTMLElement>('[data-start-char][data-end-char]').forEach((element) => {
    const startChar = Number(element.dataset.startChar)
    const endChar = Number(element.dataset.endChar)
    if (Number.isNaN(startChar) || Number.isNaN(endChar)) return
    if (endChar < textRange.startpos || startChar > textRange.endpos) return
    element.classList.add(highlightClass)
  })
}

export function useTextRangeSvgHighlight(
  rootRef: Ref<HTMLElement | null>,
  svgSource: Ref<string>,
  textRange: Ref<SelectionTextRange | undefined>,
  highlightClass: string,
): void {
  const sync = (): void => {
    const root = rootRef.value
    if (root === null) return
    if (textRange.value === undefined) {
      clearTextRangeHighlight(root, highlightClass)
      return
    }
    applyTextRangeHighlight(root, textRange.value, highlightClass)
  }

  watch(
    [rootRef, svgSource, textRange],
    () => {
      void nextTick().then(sync)
    },
    { immediate: true, deep: true },
  )

  onBeforeUnmount(() => {
    const root = rootRef.value
    if (root === null) return
    clearTextRangeHighlight(root, highlightClass)
  })
}
