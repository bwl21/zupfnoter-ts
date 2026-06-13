import { onBeforeUnmount, watch, type Ref } from 'vue'

import type { SelectionTextRange } from '@zupfnoter/types'

function clearTextRangeHighlight(root: HTMLElement, highlightClass: string): void {
  root.querySelectorAll(`.${highlightClass}`).forEach((element) => {
    element.classList.remove(highlightClass)
  })
}

function applyTextRangeHighlight(
  root: HTMLElement,
  textRanges: SelectionTextRange[],
  highlightClass: string,
): void {
  clearTextRangeHighlight(root, highlightClass)

  root.querySelectorAll<HTMLElement>('.zn-score-hitbox[data-start-char][data-end-char]').forEach((element) => {
    const startChar = Number(element.dataset.startChar)
    const endChar = Number(element.dataset.endChar)
    if (Number.isNaN(startChar) || Number.isNaN(endChar)) return
    const overlaps = textRanges.some((textRange) => endChar > textRange.startpos && startChar < textRange.endpos)
    if (!overlaps) return
    element.classList.add(highlightClass)
  })
}

export function useTextRangeSvgHighlight(
  rootRef: Ref<HTMLElement | null>,
  svgSource: Ref<string>,
  textRanges: Ref<SelectionTextRange[] | undefined>,
  highlightClass: string,
): void {
  let observer: MutationObserver | undefined

  const sync = (): void => {
    const root = rootRef.value
    if (root === null) return
    if (textRanges.value === undefined || textRanges.value.length === 0) {
      clearTextRangeHighlight(root, highlightClass)
      return
    }
    applyTextRangeHighlight(root, textRanges.value, highlightClass)
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
    [rootRef, svgSource, textRanges],
    sync,
    { immediate: true, deep: true, flush: 'post' },
  )

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = undefined
    const root = rootRef.value
    if (root === null) return
    clearTextRangeHighlight(root, highlightClass)
  })
}
