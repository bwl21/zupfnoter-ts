import { onBeforeUnmount, watch, type Ref } from 'vue'

import type { SelectionTextRange } from '@zupfnoter/types'

const SELECTION_HIGHLIGHT_CLASS = 'zn-selection-highlight'
const SELECTION_BOX_CLASS = 'zn-selection-box'

function clearSelectionBox(element: Element): void {
  element.querySelectorAll(`.${SELECTION_BOX_CLASS}`).forEach((box) => box.remove())
}

function toRootBounds(nodes: Element[], svg: SVGSVGElement): DOMRect | undefined {
  const rootTransform = svg.getScreenCTM()
  if (rootTransform === null) return undefined
  const inverse = rootTransform.inverse()
  const points = nodes.flatMap((node) => {
    const screenBounds = node.getBoundingClientRect()
    return [
      new DOMPoint(screenBounds.left, screenBounds.top).matrixTransform(inverse),
      new DOMPoint(screenBounds.right, screenBounds.top).matrixTransform(inverse),
      new DOMPoint(screenBounds.left, screenBounds.bottom).matrixTransform(inverse),
      new DOMPoint(screenBounds.right, screenBounds.bottom).matrixTransform(inverse),
    ]
  })
  const minX = Math.min(...points.map((point) => point.x)) - 1
  const minY = Math.min(...points.map((point) => point.y)) - 1
  const maxX = Math.max(...points.map((point) => point.x)) + 1
  const maxY = Math.max(...points.map((point) => point.y)) + 1
  return new DOMRect(minX, minY, Math.max(0, maxX - minX), Math.max(0, maxY - minY))
}

function addAnnotationSelectionBox(element: HTMLElement): void {
  const annotationShapes = [...element.querySelectorAll<SVGGraphicsElement>('.zupfnoter-shape--annotation')]
  if (annotationShapes.length === 0) return
  const svg = annotationShapes[0]?.ownerSVGElement
  if (svg === null || svg === undefined) return
  const selectionId = element.getAttribute('id')
  if (selectionId === null) return
  svg.querySelectorAll<SVGRectElement>(`.${SELECTION_BOX_CLASS}`).forEach((box) => {
    if (box.dataset.selectionFor === selectionId) box.remove()
  })

  try {
    const bounds = toRootBounds(annotationShapes, svg)
    if (bounds === undefined) return
    const box = element.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect')
    box.setAttribute('class', SELECTION_BOX_CLASS)
    box.setAttribute('x', `${bounds.x}`)
    box.setAttribute('y', `${bounds.y}`)
    box.setAttribute('width', `${bounds.width}`)
    box.setAttribute('height', `${bounds.height}`)
    box.setAttribute('pointer-events', 'none')
    box.dataset.selectionFor = selectionId
    svg.append(box)
  } catch {
    return
  }
}

function syncAnnotationHitboxes(root: HTMLElement): void {
  const groups = [...root.querySelectorAll<HTMLElement>('.zupfnoter-element[data-conf-key]')]

  for (const annotationGroup of groups) {
    const annotationShapes = [...annotationGroup.querySelectorAll<SVGGraphicsElement>('.zupfnoter-shape--annotation')]
    if (annotationShapes.length === 0) continue
    const svg = annotationShapes[0]?.ownerSVGElement
    if (svg === null || svg === undefined) continue
    const confKey = annotationGroup.dataset.confKey
    if (confKey === undefined) continue

    const backgroundGroup = groups.find((candidate) => (
      candidate !== annotationGroup
      && candidate.classList.contains('zupfnoter-role--barover')
      && candidate.dataset.confKey === confKey
    ))
    if (backgroundGroup === undefined) continue
    const background = backgroundGroup.querySelector<SVGRectElement>('rect.zupfnoter-shape--rect')
    if (background === null) continue

    const bounds = toRootBounds(annotationShapes, svg)
    if (bounds === undefined || bounds.width <= 0 || bounds.height <= 0) continue
    background.setAttribute('x', `${bounds.x}`)
    background.setAttribute('y', `${bounds.y}`)
    background.setAttribute('width', `${bounds.width}`)
    background.setAttribute('height', `${bounds.height}`)
  }
}
function applyHighlightClass(element: HTMLElement): void {
  element.classList.add(SELECTION_HIGHLIGHT_CLASS)
  const parent = element.classList.contains('zupfnoter-hitbox')
    ? element.closest<HTMLElement>('.zupfnoter-element')
    : element
  parent?.classList.add(SELECTION_HIGHLIGHT_CLASS)
  if (parent !== null && parent !== undefined) addAnnotationSelectionBox(parent)
  const hitboxes = element.matches('.zupfnoter-hitbox')
    ? [element]
    : [...element.querySelectorAll<HTMLElement>('.zupfnoter-hitbox')]

  if (hitboxes.length === 0) return

  hitboxes.forEach((hitbox) => {
    hitbox.classList.add(SELECTION_HIGHLIGHT_CLASS)
  })
}

function clearSelectionHighlight(root: HTMLElement): void {
  root.querySelectorAll(`.${SELECTION_HIGHLIGHT_CLASS}`).forEach((element) => {
    element.classList.remove(SELECTION_HIGHLIGHT_CLASS)
    clearSelectionBox(element)
  })
  root.querySelectorAll(`.${SELECTION_BOX_CLASS}`).forEach((element) => element.remove())
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
  const selectedConfKeys = new Set(selection.confKeys)

  root.querySelectorAll<HTMLElement>('[data-zn-id], [data-conf-key], [data-start-char][data-end-char]').forEach((element) => {
    const confKey = element.dataset.confKey
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
    syncAnnotationHitboxes(root)
    applySelectionHighlight(root, selection.value ?? { znIds: [], confKeys: [], textRanges: [] })
  }

  watch(
    rootRef,
    (root) => {
      observer?.disconnect()
      observer = undefined
      if (root === null) return
      observer = new MutationObserver(() => {
        observer?.disconnect()
        sync()
        observer?.observe(root, { childList: true, subtree: true })
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
