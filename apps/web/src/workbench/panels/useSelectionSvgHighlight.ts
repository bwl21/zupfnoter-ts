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

function rectBounds(rect: SVGRectElement): DOMRect | undefined {
  const x = Number(rect.getAttribute('x'))
  const y = Number(rect.getAttribute('y'))
  const width = Number(rect.getAttribute('width'))
  const height = Number(rect.getAttribute('height'))
  if (![x, y, width, height].every(Number.isFinite)) return undefined
  return new DOMRect(x, y, Math.max(0, width), Math.max(0, height))
}

function annotationBackground(
  element: HTMLElement,
  svg: SVGSVGElement,
): SVGRectElement | undefined {
  const confKey = element.dataset.confKey
  if (confKey === undefined) return undefined
  const backgroundGroup = [...svg.querySelectorAll<HTMLElement>('.zupfnoter-element')].find((candidate) => (
    candidate !== element
    && candidate.classList.contains('zupfnoter-role--barover')
    && candidate.dataset.confKey === confKey
  ))
  return backgroundGroup?.querySelector<SVGRectElement>('rect.zupfnoter-shape--rect') ?? undefined
}

function addSelectionBox(element: HTMLElement): void {
  // Background drawables share the annotation confKey. The annotation's
  // box already uses the background bounds, so the background must not add a
  // second visible selection box of its own.
  if (element.classList.contains('zupfnoter-role--barover')) return
  if (element.dataset.confKey?.includes('.c_jumplines.') === true
    && element.dataset.dragHandler !== 'jumpline') return

  const selectionShapes = [...element.querySelectorAll<SVGGraphicsElement>(
    '.zupfnoter-shape:not(.zupfnoter-shape--background)',
  )]
  if (selectionShapes.length === 0) return
  const svg = selectionShapes[0]?.ownerSVGElement
  if (svg === null || svg === undefined) return
  const selectionId = element.getAttribute('id')
  if (selectionId === null) return
  svg.querySelectorAll<SVGRectElement>(`.${SELECTION_BOX_CLASS}`).forEach((box) => {
    if (box.dataset.selectionFor === selectionId) box.remove()
  })

  try {
    const background = annotationBackground(element, svg)
    const bounds = background === undefined
      ? toRootBounds(selectionShapes, svg)
      : rectBounds(background)
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

function applyHighlightClass(element: HTMLElement): void {
  element.classList.add(SELECTION_HIGHLIGHT_CLASS)
  const parent = element.classList.contains('zupfnoter-hitbox')
    ? element.closest<HTMLElement>('.zupfnoter-element')
    : element
  parent?.classList.add(SELECTION_HIGHLIGHT_CLASS)
  if (parent !== null && parent !== undefined) addSelectionBox(parent)
  const hitboxSelector = '.zupfnoter-hitbox, .zupfnoter-jumpline-hitbox'
  const hitboxes = element.matches(hitboxSelector)
    ? [element]
    : [...element.querySelectorAll<HTMLElement>(hitboxSelector)]

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
