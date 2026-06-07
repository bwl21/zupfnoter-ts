import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

const SELECTION_HIGHLIGHT_CLASS = 'zn-selection-highlight'

function clearSelectionHighlight(root: HTMLElement): void {
  root.querySelectorAll(`.${SELECTION_HIGHLIGHT_CLASS}`).forEach((element) => {
    element.classList.remove(SELECTION_HIGHLIGHT_CLASS)
  })
}

function applySelectionHighlight(root: HTMLElement, selectedZnIds: string[]): void {
  clearSelectionHighlight(root)
  if (selectedZnIds.length === 0) return
  const selectedIds = new Set(selectedZnIds)
  root.querySelectorAll<HTMLElement>('[data-zn-id]').forEach((element) => {
    const znId = element.dataset.znId
    if (znId === undefined || !selectedIds.has(znId)) return
    element.classList.add(SELECTION_HIGHLIGHT_CLASS)
  })
}

export function useSelectionSvgHighlight(
  rootRef: Ref<HTMLElement | null>,
  svgSource: Ref<string>,
  selectedZnIds: Ref<string[] | undefined>,
): void {
  const sync = (): void => {
    const root = rootRef.value
    if (root === null) return
    applySelectionHighlight(root, selectedZnIds.value ?? [])
  }

  watch(
    [rootRef, svgSource, selectedZnIds],
    () => {
      void nextTick().then(sync)
    },
    { immediate: true, deep: true },
  )

  onBeforeUnmount(() => {
    const root = rootRef.value
    if (root === null) return
    clearSelectionHighlight(root)
  })
}
