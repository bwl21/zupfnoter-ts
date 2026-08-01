<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, toRef, watch } from 'vue'
import tippy, { type Instance as TippyInstance } from 'tippy.js'

import {
  bezierControlToLegacyValue,
  makeBezierPathData,
  makeJumplinePathData,
  type BezierPathInfo,
  type JumplinePathInfo,
} from '@zupfnoter/core'
import type { CommandArgumentValue } from '@zupfnoter/core'
import type { PlaybackHighlight, SelectionOrigin, SelectionTextRange, SheetObjectIndex } from '@zupfnoter/types'

import { ZnIcon, ZnMaximizeButton, ZnPanel, ZnTabs, ZnZoomControl, type ZnIconName } from '@zupfnoter/design-system'
import { resolveSelectionOriginByZnId } from '../selectionIndex'
import { RESOURCE_DRAG_MIME } from '../resourceDrag'
import type { HarpPreviewDragEnd } from '../multiWindow/harpMirrorChannel'
import HarpMagnifierPopover from './HarpMagnifierPopover.vue'
import { useZoomableSvgPreview } from './useZoomableSvgPreview'
import { usePlaybackSvgHighlight } from './usePlaybackSvgHighlight'
import { useSelectionSvgHighlight } from './useSelectionSvgHighlight'
import { loadConfigHelpTexts, resolveConfigHelpHtml, type ConfigHelpTexts } from './configHelp'
import {
  buildSvgContextMenuEntries,
  parseSvgContextMenuEntries,
  type SvgContextMenuEntry,
} from './svgContextMenu'

/** Rasterweite für dragbare Layout-Positionen in SVG-/Layout-Millimetern. */
const DRAG_GRID_MM = 1

const props = defineProps<{
  svg: string
  errorMessage?: string
  pdfUrl?: string
  pdfLoading?: boolean
  pdfError?: string
  playbackHighlight?: PlaybackHighlight
  selection?: {
    znIds: string[]
    confKeys: string[]
    textRanges: SelectionTextRange[]
  }
  sheetObjectIndex?: SheetObjectIndex
  allowWheelZoomWithoutModifier?: boolean
  maximized?: boolean
}>()

const emit = defineEmits<{
  (event: 'select-text-range', payload: {
    startpos: number
    endpos: number
    extend: boolean
    origin?: SelectionOrigin
    source: 'harp-preview'
  }): void
  (event: 'clear-selection'): void
  (event: 'scroll', payload: { scrollLeft: number; scrollTop: number }): void
  (event: 'drag-end', payload: HarpPreviewDragEnd): void
  (event: 'context-menu', payload: {
    action: 'set' | 'edit' | 'reset-shape' | 'delete-shape'
    path: string
    value?: CommandArgumentValue
  }): void
  (event: 'config-hover', payload: { confKey?: string }): void
  (event: 'resource-drop', payload: { resourceKey: string; targetConfKey?: string; position: [number, number] }): void
  (event: 'toggle-maximize'): void
}>()

type HarpPreviewMode = 'gross' | 'normal' | 'klein' | 'eingepasst' | 'pdf'

const mode = defineModel<HarpPreviewMode>('mode', {
  default: 'normal',
})
const fitToViewport = computed(() => mode.value === 'eingepasst')
const pdfDocumentStyle = computed(() => ({
  width: `${zoom.value}%`,
  height: `${zoom.value}%`,
}))
const magnifierOpen = ref(false)
const magnifierSession = ref(0)
const magnifierAnchor = ref<{ x: number; y: number } | null>(null)
const magnifierSourcePoint = ref<{ x: number, y: number } | null>(null)
const magnifierViewport = ref<{ width: number, height: number } | null>(null)
const magnifierZoom = 800
const pointerDownPosition = ref<{ x: number; y: number } | null>(null)
const pointerDownTarget = ref<EventTarget | null>(null)
type ImageResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface ActiveDrag {
  pointerId: number
  confKey: string
  handler: string
  value?: number | [number, number]
  grid?: number
  jumpline?: JumplinePathInfo
  bezier?: BezierPathInfo
  bezierControl?: 'cp1' | 'cp2'
  pathElement?: SVGPathElement
  controlLineElement?: SVGPathElement
  polygonElement?: SVGPathElement
  originalPathData?: string
  originalControlPathData?: string
  originalPolygonPathData?: string
  imageResize?: {
    corner: ImageResizeCorner
    positionConfKey: string
    heightConfKey: string
    bounds: { x: number; y: number; width: number; height: number }
  }
  element: Element
  startClient: { x: number; y: number }
}

interface ContextMenuState {
  left: number
  top: number
  entries: SvgContextMenuEntry[]
}

const dragState = ref<ActiveDrag | null>(null)
const contextMenu = ref<ContextMenuState | null>(null)
const hoveredConfigKey = ref<string | undefined>(undefined)
const contextMenuHelpTexts = ref<ConfigHelpTexts>({})
const contextMenuTooltips = new Map<HTMLElement, TippyInstance>()
const zoom = defineModel<number>('zoom', {
  default: 100,
})

const preview = useZoomableSvgPreview(
  toRef(props, 'svg'),
  zoom,
  {
    fitToWidth: true,
    fitToViewport,
    allowWheelZoomWithoutModifier: props.allowWheelZoomWithoutModifier === true,
  },
)

const {
  canvasRef,
  canvasStyle,
  displayScale,
  eventToFramePoint,
  framePointToSourcePoint,
  frameRef,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  setZoom,
} = preview

watch(mode, (value) => {
  const presetZoom: Record<Exclude<HarpPreviewMode, 'pdf'>, number> = {
    gross: 130,
    normal: 100,
    klein: 70,
    eingepasst: 100,
  }
  if (value !== 'pdf') setZoom(presetZoom[value])
})

function syncImageResizeHandles(): void {
  const canvas = canvasRef.value
  if (canvas === null) return
  const elements = new Set<HTMLElement>()
  for (const handle of canvas.querySelectorAll<SVGRectElement>('[data-image-resize-corner]')) {
    const element = handle.closest<HTMLElement>('.zupfnoter-element')
    if (element !== null) elements.add(element)
  }
  for (const element of elements) {
    const image = element.querySelector<SVGImageElement>('image.zupfnoter-shape--image')
    if (image === null) continue
    try {
      const source = image.getAttribute('href') ?? image.getAttribute('xlink:href')
      if (source !== null && image.dataset.imageSizeResolved !== 'true') {
        const probe = new window.Image()
        probe.addEventListener('load', () => {
          const height = Number(image.getAttribute('height'))
          if (probe.naturalWidth > 0 && probe.naturalHeight > 0 && Number.isFinite(height)) {
            image.setAttribute('width', String(height * probe.naturalWidth / probe.naturalHeight))
            image.dataset.imageSizeResolved = 'true'
            syncImageResizeHandles()
          }
        }, { once: true })
        probe.src = source
      }
      const bounds = image.getBBox()
      for (const handle of element.querySelectorAll<SVGRectElement>('[data-image-resize-corner]')) {
        const corner = handle.getAttribute('data-image-resize-corner')
        const point: [number, number] = corner === 'top-left'
          ? [bounds.x, bounds.y]
          : corner === 'top-right'
            ? [bounds.x + bounds.width, bounds.y]
            : corner === 'bottom-left'
              ? [bounds.x, bounds.y + bounds.height]
              : [bounds.x + bounds.width, bounds.y + bounds.height]
        handle.setAttribute('x', String(point[0] - 2))
        handle.setAttribute('y', String(point[1] - 2))
      }
      const moveHandle = element.querySelector<SVGGElement>('[data-image-move-handle]')
      moveHandle?.setAttribute('transform', `translate(${bounds.x + bounds.width / 2} ${bounds.y + bounds.height / 2})`)
    } catch {
      // getBBox() is unavailable until an SVG image has been laid out.
    }
  }
}

watch(() => props.svg, () => {
  void nextTick().then(syncImageResizeHandles)
}, { flush: 'post' })

watch(contextMenu, () => {
  void syncContextMenuTooltips()
})
usePlaybackSvgHighlight(
  canvasRef,
  toRef(props, 'svg'),
  toRef(props, 'playbackHighlight'),
)
useSelectionSvgHighlight(
  canvasRef,
  toRef(props, 'svg'),
  toRef(props, 'selection'),
)

function emitSelectionFromEvent(target: EventTarget | null, extend: boolean): void {
  if (!(target instanceof Element)) return
  const element = target.closest('.zupfnoter-hitbox[data-start-char][data-end-char]')
  if (element === null) {
    emit('clear-selection')
    return
  }
  const startChar = element?.getAttribute('data-start-char')
  const endChar = element?.getAttribute('data-end-char')
  const znId = element?.getAttribute('data-zn-id') ?? undefined
  if (startChar === null || endChar === null) return
  const startpos = Number(startChar)
  const endpos = Number(endChar)
  if (Number.isNaN(startpos) || Number.isNaN(endpos)) return
  const origin = znId === undefined ? undefined : resolveSelectionOriginByZnId(props.sheetObjectIndex, znId)
  emit('select-text-range', {
    startpos,
    endpos,
    extend,
    origin,
    source: 'harp-preview',
  })
}

function closeContextMenu(): void {
  contextMenu.value = null
}

function configKeyAtElement(element: Element | null): string | undefined {
  const drawable = element?.closest<HTMLElement>('.zupfnoter-element[data-conf-key]')
  const confKey = drawable?.getAttribute('data-conf-key')?.trim()
  if (confKey === undefined || confKey === '') return undefined
  return confKey
}

function updateConfigHover(target: EventTarget | null): void {
  const confKey = target instanceof Element ? configKeyAtElement(target) : undefined
  if (confKey === hoveredConfigKey.value) return
  hoveredConfigKey.value = confKey
  emit('config-hover', confKey === undefined ? {} : { confKey })
}

function handleResourceDragOver(event: DragEvent): void {
  if (event.dataTransfer?.types.includes(RESOURCE_DRAG_MIME) !== true || mode.value === 'pdf') return
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy'
}

function handleResourceDrop(event: DragEvent): void {
  if (event.dataTransfer?.types.includes(RESOURCE_DRAG_MIME) !== true || mode.value === 'pdf') return
  const resourceKey = event.dataTransfer.getData(RESOURCE_DRAG_MIME).trim()
  if (resourceKey === '') return
  const framePoint = eventToFramePoint(event)
  if (framePoint === null) return
  const sourcePoint = framePointToSourcePoint(framePoint)
  if (sourcePoint === null) return
  event.preventDefault()
  event.stopPropagation()
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('.zupfnoter-element[data-type="Image"][data-conf-key]')
    : null
  const targetConfKey = target?.getAttribute('data-conf-key')?.trim() || undefined
  emit('resource-drop', { resourceKey, targetConfKey, position: [sourcePoint.x, sourcePoint.y] })
}

function contextMenuEntries(element: Element): SvgContextMenuEntry[] {
  // Pointer events on notes normally target the transparent hitbox. Its
  // interaction metadata belongs to the enclosing drawable group.
  const drawable = element.closest<HTMLElement>('.zupfnoter-element[data-conf-key]')
  if (drawable === null) return []
  const confKey = drawable.getAttribute('data-conf-key')?.trim() ?? ''
  const dragConfKey = drawable.getAttribute('data-drag-conf-key')?.trim() ?? ''
  const bezier = parseBezierInfo(drawable.getAttribute('data-drag-bezier'))
  const resetShapeValue = bezier === undefined ? undefined : {
    cp1: bezierControlToLegacyValue(
      bezier.from,
      bezier.to,
      [
        bezier.from[0] + (bezier.to[0] - bezier.from[0]) / 3,
        bezier.from[1] + (bezier.to[1] - bezier.from[1]) / 3,
      ],
    ),
    cp2: bezierControlToLegacyValue(
      bezier.from,
      bezier.to,
      [
        bezier.from[0] + (bezier.to[0] - bezier.from[0]) * 2 / 3,
        bezier.from[1] + (bezier.to[1] - bezier.from[1]) * 2 / 3,
      ],
      'to',
    ),
  }
  return buildSvgContextMenuEntries(
    confKey,
    parseSvgContextMenuEntries(drawable.getAttribute('data-more-conf-keys')),
    {
      resetShapePath: drawable.getAttribute('data-drag-handler') === 'bezier' ? dragConfKey : undefined,
      resetShapeValue,
      deleteShapePath: drawable.getAttribute('data-drag-handler') === 'bezier' ? dragConfKey : undefined,
    },
  )
}

function handleContextMenu(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof Element)) return
  const entries = contextMenuEntries(target)
  if (entries.length === 0) return
  const frame = frameRef.value
  if (frame === null) return
  event.preventDefault()
  event.stopPropagation()
  const frameRect = frame.getBoundingClientRect()
  contextMenu.value = {
    left: event.clientX - frameRect.left + frame.scrollLeft,
    top: event.clientY - frameRect.top + frame.scrollTop,
    entries,
  }
}

function executeContextMenuEntry(entry: SvgContextMenuEntry): void {
  if (entry.disabled) return
  if (entry.action === 'set' && entry.value !== undefined && entry.path !== undefined) {
    emit('context-menu', { action: 'set', path: entry.path, value: entry.value })
  } else if (entry.action === 'reset-shape' && entry.path !== undefined && entry.value !== undefined) {
    emit('context-menu', { action: 'reset-shape', path: entry.path, value: entry.value })
  } else if (entry.action === 'delete-shape' && entry.path !== undefined) {
    emit('context-menu', { action: 'delete-shape', path: entry.path })
  } else if (entry.action === 'edit' && entry.path !== undefined) {
    emit('context-menu', { action: 'edit', path: entry.path })
  }
  closeContextMenu()
}

function resolveContextMenuIcon(icon: string | undefined): ZnIconName | undefined {
  const icons: Record<string, ZnIconName> = {
    'fa fa-arrow-down': 'shiftDown',
    'fa fa-arrow-left': 'shiftLeft',
    'fa fa-arrow-right': 'shiftRight',
    'fa fa-arrow-up': 'shiftUp',
    'fa fa-arrows-v': 'verticalAdjust',
    'fa fa-gear': 'settings',
    'fa fa-refresh': 'undo',
    'fa fa-trash': 'delete',
  }
  return icon === undefined ? undefined : icons[icon]
}

function destroyContextMenuTooltips(): void {
  for (const instance of contextMenuTooltips.values()) instance.destroy()
  contextMenuTooltips.clear()
}

async function syncContextMenuTooltips(): Promise<void> {
  destroyContextMenuTooltips()
  if (contextMenu.value === null) return
  if (Object.keys(contextMenuHelpTexts.value).length === 0) {
    contextMenuHelpTexts.value = await loadConfigHelpTexts()
  }
  await nextTick()
  const frame = frameRef.value
  if (frame === null || contextMenu.value === null) return
  const elements = frame.querySelectorAll<HTMLElement>('[data-context-menu-help-key]')
  for (const element of elements) {
    const helpKey = element.dataset.contextMenuHelpKey
    if (helpKey === undefined || helpKey === '') continue
    const helpHtml = resolveConfigHelpHtml(helpKey, contextMenuHelpTexts.value)
    contextMenuTooltips.set(element, tippy(element, {
      content: helpHtml ?? `Konfiguration: ${helpKey}`,
      allowHTML: helpHtml !== undefined,
      interactive: true,
      trigger: 'mouseenter focus',
      theme: 'zn-config-help',
      placement: 'right-start',
      maxWidth: 560,
    }))
  }
}

function findJumplineAtEvent(event: PointerEvent): HTMLElement | null {
  const canvas = canvasRef.value
  if (canvas === null) return null
  const target = event.target
  if (!(target instanceof Element)) return null

  const candidates = canvas.querySelectorAll<HTMLElement>('.zupfnoter-element[data-drag-handler="jumpline"][data-conf-key]')
  for (const candidate of candidates) {
    const path = candidate.querySelector<SVGPathElement>('path:not([data-drag-hitbox])')
    if (path === null) continue
    const svg = path.ownerSVGElement
    if (svg === null) continue
    const matrix = path.getScreenCTM()
    if (matrix === null) continue
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const localPoint = point.matrixTransform(matrix.inverse())
    const length = path.getTotalLength()
    const samples = Math.max(16, Math.ceil(length / 8))
    let closestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index <= samples; index += 1) {
      const pathPoint = path.getPointAtLength(length * index / samples)
      closestDistance = Math.min(closestDistance, Math.hypot(pathPoint.x - localPoint.x, pathPoint.y - localPoint.y))
    }
    if (closestDistance <= 5) return candidate
  }
  return null
}

function handlePointerDown(event: PointerEvent): void {
  if (event.button === 0 && event.shiftKey) {
    const framePoint = eventToFramePoint(event)
    const sourcePoint = framePoint === null ? null : framePointToSourcePoint(framePoint)
    if (sourcePoint !== null) {
      magnifierAnchor.value = { x: event.clientX, y: event.clientY }
      magnifierSourcePoint.value = sourcePoint
      magnifierSession.value += 1
      magnifierOpen.value = true
      event.preventDefault()
      event.stopPropagation()
      return
    }
  }
  if (event.button === 0 && event.target instanceof Element) {
    const directDraggable = event.target.closest<HTMLElement>('.zupfnoter-element[data-drag-enabled="true"][data-conf-key]')
    const draggable = directDraggable ?? findJumplineAtEvent(event)
    const resizeHandle = event.target.closest<SVGRectElement>('[data-image-resize-corner]')
    const image = event.target.closest<SVGImageElement>('image.zupfnoter-shape--image')
      ?? draggable?.querySelector<SVGImageElement>('image.zupfnoter-shape--image')
    const positionConfKey = draggable?.getAttribute('data-drag-conf-key')
    const imageHeightConfKey = draggable?.getAttribute('data-drag-height-conf-key')
      ?? (positionConfKey?.endsWith('.pos') === true ? positionConfKey.replace(/\.pos$/, '.height') : null)
    const resizeCornerValue = resizeHandle?.getAttribute('data-image-resize-corner')
    const imageResizeCorner: ImageResizeCorner | undefined = resizeCornerValue === 'top-left'
      || resizeCornerValue === 'top-right'
      || resizeCornerValue === 'bottom-left'
      || resizeCornerValue === 'bottom-right'
      ? resizeCornerValue
      : image === null || image === undefined ? undefined : resolveImageResizeCorner(event, image)
    const imageResize = (resizeHandle !== null || imageResizeCorner !== undefined)
      && typeof imageHeightConfKey === 'string'
      && typeof positionConfKey === 'string'
    const confKey = imageResize && typeof imageHeightConfKey === 'string'
      ? imageHeightConfKey
      : draggable?.getAttribute('data-drag-conf-key') ?? draggable?.getAttribute('data-conf-key')
    const handler = imageResize ? 'image-resize' : draggable?.getAttribute('data-drag-handler')
    const dragGridText = draggable?.getAttribute('data-drag-grid')
    const dragGrid = typeof dragGridText === 'string' ? Number(dragGridText) : Number.NaN
    const jumplineText = draggable?.getAttribute('data-drag-jumpline')
    const jumpline = parseJumplineInfo(jumplineText ?? null)
    const bezier = parseBezierInfo(draggable?.getAttribute('data-drag-bezier') ?? null)
    const bezierControl = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-bezier-control]')?.dataset.bezierControl
      : undefined
    if ((handler === 'bezier' || handler === 'tuplet') && bezierControl !== 'cp1' && bezierControl !== 'cp2') return
    const pathElement = (jumpline !== undefined || bezier !== undefined)
      ? draggable?.querySelector<SVGPathElement>('path:not([data-drag-hitbox]):not([data-bezier-polygon]):not([data-bezier-control])')
      : undefined
    const controlLineElement = bezierControl === 'cp1' || bezierControl === 'cp2'
      ? draggable?.querySelector<SVGPathElement>(`path[data-bezier-control="${bezierControl}"]`) ?? undefined
      : undefined
    const polygonElement = bezier !== undefined
      ? draggable?.querySelector<SVGPathElement>('path[data-bezier-polygon="true"]') ?? undefined
      : undefined
    const dragValueText = imageResize
      ? draggable?.getAttribute('data-drag-height-value') ?? image?.getAttribute('height')
      : draggable?.getAttribute('data-drag-value')
    let dragValue: number | [number, number] | undefined
    if (typeof dragValueText === 'string') {
      try {
        const parsed: unknown = JSON.parse(dragValueText)
        if (typeof parsed === 'number') dragValue = parsed
        if (Array.isArray(parsed) && parsed.length === 2) {
          const first = parsed[0]
          const second = parsed[1]
          if (typeof first === 'number' && typeof second === 'number') {
            dragValue = [first, second]
          }
        }
      } catch {
        dragValue = undefined
      }
    }
    if (draggable !== null && typeof confKey === 'string' && typeof handler === 'string' && displayScale.value > 0) {
      if (image !== null && image !== undefined && !imageResize && !isImageMoveCenter(event, image)) return
      dragState.value = {
        pointerId: event.pointerId,
        confKey,
        handler,
        value: dragValue,
        ...(Number.isFinite(dragGrid) && dragGrid > 0 ? { grid: dragGrid } : {}),
        ...(jumpline !== undefined && pathElement instanceof SVGPathElement
          ? {
            jumpline,
            pathElement,
            originalPathData: pathElement.getAttribute('d') ?? undefined,
          }
          : {}),
        ...(bezier !== undefined && pathElement instanceof SVGPathElement && (bezierControl === 'cp1' || bezierControl === 'cp2')
          ? {
            bezier,
            bezierControl,
            pathElement,
            controlLineElement,
            polygonElement,
            originalPathData: pathElement.getAttribute('d') ?? undefined,
            originalControlPathData: controlLineElement?.getAttribute('d') ?? undefined,
            originalPolygonPathData: polygonElement?.getAttribute('d') ?? undefined,
          }
          : {}),
        ...(imageResize && image !== null && image !== undefined && imageResizeCorner !== undefined && typeof imageHeightConfKey === 'string'
          ? {
            imageResize: {
              corner: imageResizeCorner,
              positionConfKey,
              heightConfKey: imageHeightConfKey,
              bounds: image.getBBox(),
            },
          }
          : {}),
        element: draggable,
        startClient: { x: event.clientX, y: event.clientY },
      }
      if (handler === 'bezier' || handler === 'tuplet' || handler === 'image-resize') draggable.setAttribute('data-drag-active', 'true')
      frameRef.value?.setPointerCapture(event.pointerId)
      event.preventDefault()
      event.stopPropagation()
      return
    }
  }
  pointerDownPosition.value = {
    x: event.clientX,
    y: event.clientY,
  }
  pointerDownTarget.value = event.target
  onPointerDown(event)
}

function resolveImageResizeCorner(event: PointerEvent, image: SVGImageElement): ImageResizeCorner | undefined {
  const bounds = image.getBoundingClientRect()
  const nearLeft = Math.abs(event.clientX - bounds.left) <= 18
  const nearRight = Math.abs(event.clientX - bounds.right) <= 18
  const nearTop = Math.abs(event.clientY - bounds.top) <= 18
  const nearBottom = Math.abs(event.clientY - bounds.bottom) <= 18
  if (nearLeft && nearTop) return 'top-left'
  if (nearRight && nearTop) return 'top-right'
  if (nearLeft && nearBottom) return 'bottom-left'
  if (nearRight && nearBottom) return 'bottom-right'
  return undefined
}

function isImageMoveCenter(event: PointerEvent, image: SVGImageElement): boolean {
  const bounds = image.getBoundingClientRect()
  const insetX = Math.min(bounds.width / 3, Math.max(18, bounds.width * 0.2))
  const insetY = Math.min(bounds.height / 3, Math.max(18, bounds.height * 0.2))
  return event.clientX > bounds.left + insetX
    && event.clientX < bounds.right - insetX
    && event.clientY > bounds.top + insetY
    && event.clientY < bounds.bottom - insetY
}

function handlePointerMove(event: PointerEvent): void {
  updateConfigHover(event.target)
  const activeDrag = dragState.value
  if (activeDrag?.pointerId === event.pointerId) {
    const delta = screenDeltaToSvgDelta(
      activeDrag.element,
      event.clientX - activeDrag.startClient.x,
      event.clientY - activeDrag.startClient.y,
    )
    if (delta !== null) {
      const [deltaX, deltaY] = snapDragDelta(activeDrag, delta)
      updateLiveDrag(activeDrag, deltaX, deltaY)
    }
    event.preventDefault()
    return
  }
  updateJumplineHover(event)
  onPointerMove(event)
}

function updateJumplineHover(event: PointerEvent): void {
  const frame = frameRef.value
  if (frame === null) return
  const target = event.target
  const directJumpline = target instanceof Element
    && target.closest('.zupfnoter-element[data-drag-handler="jumpline"][data-conf-key]') !== null
  frame.classList.toggle('harp-preview__frame--jumpline-hover', directJumpline || findJumplineAtEvent(event) !== null)
}

function clearJumplineHover(): void {
  frameRef.value?.classList.remove('harp-preview__frame--jumpline-hover')
  if (hoveredConfigKey.value !== undefined) {
    hoveredConfigKey.value = undefined
    emit('config-hover', {})
  }
}

function handlePointerUp(event: PointerEvent): void {
  const activeDrag = dragState.value
  if (activeDrag?.pointerId === event.pointerId) {
    const delta = screenDeltaToSvgDelta(
      activeDrag.element,
      event.clientX - activeDrag.startClient.x,
      event.clientY - activeDrag.startClient.y,
    )
    activeDrag.element.removeAttribute('data-drag-active')
    dragState.value = null
    if (frameRef.value?.hasPointerCapture(event.pointerId) === true) {
      frameRef.value.releasePointerCapture(event.pointerId)
    }
    event.preventDefault()
    event.stopPropagation()
    if (delta !== null) {
      const [deltaX, deltaY] = snapDragDelta(activeDrag, delta)
      updateLiveDrag(activeDrag, deltaX, deltaY)
      emit('drag-end', {
        confKey: activeDrag.bezier !== undefined && activeDrag.bezierControl !== undefined
          ? `${activeDrag.confKey}.${activeDrag.bezierControl}`
          : activeDrag.confKey,
        handler: activeDrag.handler,
        delta: [deltaX, deltaY],
        ...(activeDrag.imageResize !== undefined
          ? {
            updates: (() => {
              const geometry = imageResizeGeometry(activeDrag.imageResize, deltaY)
              return [
                { confKey: activeDrag.imageResize.positionConfKey, value: [geometry.x, geometry.y] as [number, number] },
                { confKey: activeDrag.imageResize.heightConfKey, value: geometry.height },
              ]
            })(),
          }
          : {}),
        ...(activeDrag.bezier !== undefined && activeDrag.bezierControl !== undefined
          ? {
            value: bezierControlToLegacyValue(
              activeDrag.bezier.from,
              activeDrag.bezier.to,
              activeDrag.bezier[activeDrag.bezierControl].map((value, index) => value + (index === 0 ? deltaX : deltaY)) as [number, number],
              activeDrag.bezierControl === 'cp1' ? 'from' : 'to',
            ),
          }
          : activeDrag.value !== undefined
          ? {
            value: activeDrag.imageResize !== undefined
              ? imageResizeGeometry(activeDrag.imageResize, deltaY).height
              : typeof activeDrag.value === 'number'
              && activeDrag.handler === 'jumpline' && activeDrag.grid !== undefined
                ? snapJumplineConfigValue(activeDrag.value, deltaX, activeDrag.grid)
                : typeof activeDrag.value === 'number'
                  ? activeDrag.value + deltaY
                  : [
                    activeDrag.value[0] + deltaX,
                    activeDrag.value[1] + deltaY,
                  ] as [number, number],
          }
          : {}),
        source: 'harp-preview',
      })
    }
    return
  }
  const start = pointerDownPosition.value
  const target = pointerDownTarget.value
  onPointerUp(event)
  pointerDownPosition.value = null
  pointerDownTarget.value = null
  if (start === null) return
  const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
  if (distance > 4) return
  emitSelectionFromEvent(target, event.shiftKey)
}

function snapDragDelta(activeDrag: ActiveDrag, delta: [number, number]): [number, number] {
  if (activeDrag.handler === 'jumpline' && activeDrag.grid !== undefined) {
    return [Math.round(delta[0] / activeDrag.grid) * activeDrag.grid, 0]
  }
  if (
    (activeDrag.handler !== 'annotation' && activeDrag.handler !== 'image')
    || !Array.isArray(activeDrag.value)
  ) {
    return delta
  }

  return [
    snapToDragGrid(activeDrag.value[0] + delta[0]) - activeDrag.value[0],
    snapToDragGrid(activeDrag.value[1] + delta[1]) - activeDrag.value[1],
  ]
}

function updateLiveDrag(activeDrag: ActiveDrag, deltaX: number, deltaY: number): void {
  if (activeDrag.handler === 'image-resize' && activeDrag.imageResize !== undefined && typeof activeDrag.value === 'number') {
    const image = activeDrag.element.querySelector<SVGImageElement>('image.zupfnoter-shape--image')
    if (image !== null) {
      const geometry = imageResizeGeometry(activeDrag.imageResize, deltaY)
      image.setAttribute('x', String(geometry.x))
      image.setAttribute('y', String(geometry.y))
      image.setAttribute('width', String(geometry.width))
      image.setAttribute('height', String(geometry.height))
      for (const handle of activeDrag.element.querySelectorAll<SVGRectElement>('[data-image-resize-corner]')) {
        const corner = handle.getAttribute('data-image-resize-corner')
        const point: [number, number] = corner === 'top-left'
          ? [geometry.x, geometry.y]
          : corner === 'top-right'
            ? [geometry.x + geometry.width, geometry.y]
            : corner === 'bottom-left'
              ? [geometry.x, geometry.y + geometry.height]
              : [geometry.x + geometry.width, geometry.y + geometry.height]
        handle.setAttribute('x', String(point[0] - 2))
        handle.setAttribute('y', String(point[1] - 2))
      }
      activeDrag.element.querySelector<SVGGElement>('[data-image-move-handle]')?.setAttribute(
        'transform',
        `translate(${geometry.x + geometry.width / 2} ${geometry.y + geometry.height / 2})`,
      )
    }
    return
  }
  if (activeDrag.jumpline !== undefined && activeDrag.pathElement !== undefined) {
    activeDrag.pathElement.setAttribute('d', makeJumplinePathData({
      ...activeDrag.jumpline,
      vertical: activeDrag.jumpline.vertical + deltaX,
    }).outlinePathData)
    return
  }
  if (activeDrag.bezier !== undefined && activeDrag.bezierControl !== undefined && activeDrag.pathElement !== undefined) {
    const control = activeDrag.bezier[activeDrag.bezierControl]
    const updated: BezierPathInfo = {
      ...activeDrag.bezier,
      [activeDrag.bezierControl]: [control[0] + deltaX, control[1] + deltaY],
    }
    activeDrag.pathElement.setAttribute('d', makeBezierPathData(updated))
    if (activeDrag.controlLineElement !== undefined) {
      const endpoint = activeDrag.bezierControl === 'cp1' ? updated.from : updated.to
      const control = updated[activeDrag.bezierControl]
      activeDrag.controlLineElement.setAttribute('d', `M${endpoint[0]} ${endpoint[1]}L${control[0]} ${control[1]}`)
    }
    if (activeDrag.polygonElement !== undefined) {
      activeDrag.polygonElement.setAttribute('d', `M${updated.from[0]} ${updated.from[1]}L${updated.cp1[0]} ${updated.cp1[1]}L${updated.cp2[0]} ${updated.cp2[1]}L${updated.to[0]} ${updated.to[1]}Z`)
    }
    return
  }
  activeDrag.element.setAttribute('transform', `translate(${deltaX} ${deltaY})`)
}

function imageResizeGeometry(
  resize: NonNullable<ActiveDrag['imageResize']>,
  deltaY: number,
): { x: number; y: number; width: number; height: number } {
  const { bounds, corner } = resize
  const heightDelta = corner.startsWith('top-') ? -deltaY : deltaY
  const height = Math.max(1, bounds.height + heightDelta)
  const width = Math.max(1, bounds.width * height / Math.max(1, bounds.height))
  const x = corner.endsWith('left') ? bounds.x + bounds.width - width : bounds.x
  const y = corner.startsWith('top') ? bounds.y + bounds.height - height : bounds.y
  return { x, y, width, height }
}

function parseJumplineInfo(value: string | null): JumplinePathInfo | undefined {
  if (value === null) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
    return parsed as JumplinePathInfo
  } catch {
    return undefined
  }
}

function parseBezierInfo(value: string | null): BezierPathInfo | undefined {
  if (value === null) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
    const info = parsed as Record<string, unknown>
    if (!isPoint(info.from) || !isPoint(info.to) || !isPoint(info.cp1) || !isPoint(info.cp2)) return undefined
    return {
      from: info.from,
      to: info.to,
      cp1: info.cp1,
      cp2: info.cp2,
    }
  } catch {
    return undefined
  }
}

function isPoint(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && typeof value[0] === 'number'
    && typeof value[1] === 'number'
}

function snapJumplineConfigValue(verticalOffset: number, deltaX: number, grid: number): number {
  const value = Math.round((verticalOffset + deltaX) / grid)
  return value <= 0 ? value - 1 : value
}

function snapToDragGrid(value: number): number {
  return Math.round(value / DRAG_GRID_MM) * DRAG_GRID_MM
}

function screenDeltaToSvgDelta(element: Element, screenX: number, screenY: number): [number, number] | null {
  const svg = element.closest('svg')
  if (!(svg instanceof SVGSVGElement)) return null
  const matrix = svg?.getScreenCTM()
  if (matrix === null || matrix === undefined) {
    if (displayScale.value <= 0) return null
    return [screenX / displayScale.value, screenY / displayScale.value]
  }

  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (determinant === 0) return null
  return [
    (matrix.d * screenX - matrix.c * screenY) / determinant,
    (-matrix.b * screenX + matrix.a * screenY) / determinant,
  ]
}

function handlePointerCancel(event: PointerEvent): void {
  if (dragState.value?.pointerId === event.pointerId) {
    if (dragState.value.pathElement !== undefined && dragState.value.originalPathData !== undefined) {
      dragState.value.pathElement.setAttribute('d', dragState.value.originalPathData)
    }
    if (dragState.value.controlLineElement !== undefined && dragState.value.originalControlPathData !== undefined) {
      dragState.value.controlLineElement.setAttribute('d', dragState.value.originalControlPathData)
    }
    if (dragState.value.polygonElement !== undefined && dragState.value.originalPolygonPathData !== undefined) {
      dragState.value.polygonElement.setAttribute('d', dragState.value.originalPolygonPathData)
    }
    dragState.value.element.removeAttribute('transform')
    dragState.value.element.removeAttribute('data-drag-active')
    dragState.value = null
    if (frameRef.value?.hasPointerCapture(event.pointerId) === true) {
      frameRef.value.releasePointerCapture(event.pointerId)
    }
    event.preventDefault()
    event.stopPropagation()
    return
  }
  onPointerCancel(event)
}

function handleScroll(): void {
  const frame = frameRef.value
  if (frame === null) return
  emit('scroll', { scrollLeft: frame.scrollLeft, scrollTop: frame.scrollTop })
}

function closeMagnifier(): void {
  magnifierOpen.value = false
  magnifierAnchor.value = null
  magnifierSourcePoint.value = null
  magnifierViewport.value = null
}

function handleMagnifierDragEnd(payload: HarpPreviewDragEnd): void {
  emit('drag-end', payload)
}

function onMagnifierViewportResize(size: { width: number, height: number }): void {
  magnifierViewport.value = size
}

const magnifierFocusStyle = computed(() => {
  if (!magnifierOpen.value || magnifierSourcePoint.value === null || magnifierViewport.value === null) {
    return undefined
  }

  if (displayScale.value <= 0 || magnifierZoom <= 0) {
    return undefined
  }

  const width = magnifierViewport.value.width * displayScale.value / magnifierZoom
  const height = magnifierViewport.value.height * displayScale.value / magnifierZoom

  return {
    left: `${magnifierSourcePoint.value.x * displayScale.value - width / 2}px`,
    top: `${magnifierSourcePoint.value.y * displayScale.value - height / 2}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
})

const magnifierPopupStyle = computed(() => {
  const anchor = magnifierAnchor.value
  if (!magnifierOpen.value || anchor === null) {
    return undefined
  }

  const size = 320
  const margin = 12
  const centerX = Math.min(Math.max(margin + size / 2, anchor.x), Math.max(margin + size / 2, window.innerWidth - margin - size / 2))
  const centerY = Math.min(Math.max(margin + size / 2, anchor.y), Math.max(margin + size / 2, window.innerHeight - margin - size / 2))

  return {
    left: `${centerX}px`,
    top: `${centerY}px`,
  }
})

onBeforeUnmount(() => {
  destroyContextMenuTooltips()
})
</script>

<template>
  <ZnPanel variant="workspace">
    <div class="harp-preview">
      <div class="harp-preview__header">
        <ZnTabs
          v-model="mode"
          :fill-height="false"
          :items="[
            { id: 'gross', label: 'groß' },
            { id: 'normal', label: 'normal' },
            { id: 'klein', label: 'klein' },
            { id: 'eingepasst', label: 'eingepasst' },
            { id: 'pdf', label: 'Pdf-Vorschau' },
          ]"
        />
        <div class="harp-preview__controls">
          <ZnZoomControl :model-value="zoom" @update:model-value="setZoom" />
          <ZnMaximizeButton
            :maximized="props.maximized"
            maximize-label="Harfenpanel maximieren"
            restore-label="Harfenpanel wiederherstellen"
            @toggle="emit('toggle-maximize')"
          />
        </div>
      </div>
      <div
        ref="frameRef"
        class="harp-preview__frame"
        :class="{ 'harp-preview__frame--pdf': mode === 'pdf' }"
        @scroll="handleScroll"
        @dragover="handleResourceDragOver"
        @drop="handleResourceDrop"
        @pointercancel="handlePointerCancel"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointerleave="clearJumplineHover"
        @wheel="onWheel"
        @contextmenu="handleContextMenu"
        @click="closeContextMenu"
      >
        <div v-if="mode === 'pdf'" class="harp-preview__pdf">
          <p v-if="pdfLoading" class="harp-preview__pdf-status" role="status">PDF-Vorschau wird geladen …</p>
          <p v-else-if="pdfError" class="harp-preview__error">{{ pdfError }}</p>
          <iframe
            v-else-if="pdfUrl"
            class="harp-preview__pdf-document"
            :style="pdfDocumentStyle"
            :src="pdfUrl"
            title="PDF-Vorschau der Harfennoten"
          />
          <p v-else class="harp-preview__pdf-status">Keine PDF-Vorschau verfügbar.</p>
        </div>
        <div v-else-if="errorMessage" class="harp-preview__error">
          {{ errorMessage }}
        </div>
        <div
          v-else
          ref="canvasRef"
          class="harp-preview__svg"
          :style="canvasStyle"
          v-html="svg"
        />
        <div
          v-if="magnifierFocusStyle"
          class="harp-preview__magnifier-spot"
          :style="magnifierFocusStyle"
        />
        <div
          v-if="contextMenu !== null"
          class="harp-preview__context-menu"
          :style="{ left: `${contextMenu.left}px`, top: `${contextMenu.top}px` }"
          role="menu"
          @pointerdown.stop
          @click.stop
        >
          <button
            v-for="(entry, index) in contextMenu.entries"
            :key="`${entry.text}-${index}`"
            type="button"
            class="harp-preview__context-menu-entry"
            :class="{ 'is-disabled': entry.disabled }"
            :disabled="entry.disabled"
            :data-context-menu-help-key="entry.helpPath ?? entry.path"
            :title="entry.helpPath ?? entry.path ?? entry.text"
            role="menuitem"
            @click="executeContextMenuEntry(entry)"
          >
            <span class="harp-preview__context-menu-icon" aria-hidden="true">
              <ZnIcon v-if="resolveContextMenuIcon(entry.icon) !== undefined" :name="resolveContextMenuIcon(entry.icon) as ZnIconName" />
              <span v-else>•</span>
            </span>
            <span>{{ entry.text }}</span>
          </button>
        </div>
      </div>
      <HarpMagnifierPopover
        :key="magnifierSession"
        :error-message="errorMessage"
        :open="magnifierOpen"
        :position-style="magnifierPopupStyle"
        :source-point="magnifierSourcePoint"
        :zoom-level="magnifierZoom"
        :svg="svg"
        @viewport-resize="onMagnifierViewportResize"
        @drag-end="handleMagnifierDragEnd"
        @close="closeMagnifier"
      />
    </div>
  </ZnPanel>
</template>

<style scoped>
.harp-preview {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
  height: 100%;
}

.harp-preview__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--zn-space-3);
}

.harp-preview__header :deep(.zn-tabs__panel) {
  display: none;
}

.harp-preview__controls {
  display: flex;
  justify-content: flex-end;
  flex: 0 0 auto;
  padding-top: 0.1rem;
}

.harp-preview__frame {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-sm);
  background: var(--zn-bg-surface);
  overflow: auto;
  /* Der Pfeil lässt die schmale Drag-Zielfläche sichtbar. */
  cursor: default;
  user-select: none;
}

.harp-preview__frame--pdf {
  overflow: auto;
}

.harp-preview__pdf {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--zn-bg-surface);
}

.harp-preview__pdf-document {
  display: block;
  min-width: 100%;
  min-height: 100%;
  border: 0;
  background: white;
}

.harp-preview__pdf-status {
  margin: var(--zn-space-4);
  color: var(--zn-muted);
}

.harp-preview__frame--jumpline-hover {
  cursor: pointer;
}

.harp-preview__svg {
  display: block;
  max-width: none;
}

.harp-preview__svg :deep(svg) {
  display: block;
  max-width: none;
}

/* Nur explizit freigegebene Drawables zeigen Drag-Affordance. */
.harp-preview__svg :deep(.zupfnoter-element[data-drag-enabled="true"]),
.harp-preview__svg :deep(.zupfnoter-element[data-drag-enabled="true"] *) {
  cursor: pointer;
}

.harp-preview__svg :deep(.zupfnoter-element[data-drag-enabled="true"]:active),
.harp-preview__svg :deep(.zupfnoter-element[data-drag-enabled="true"]:active *) {
  cursor: pointer;
}

/* Sprunglinien verwenden die geometrische 5-mm-Prüfung statt der Wrapper-Bounding-Box. */
.harp-preview__svg :deep(.zupfnoter-element[data-drag-handler="jumpline"]),
.harp-preview__svg :deep(.zupfnoter-element[data-drag-handler="jumpline"] *) {
  cursor: default;
}

.harp-preview__frame--jumpline-hover .harp-preview__svg :deep(.zupfnoter-element[data-drag-handler="jumpline"]),
.harp-preview__frame--jumpline-hover .harp-preview__svg :deep(.zupfnoter-element[data-drag-handler="jumpline"] *) {
  cursor: pointer;
}

.harp-preview__svg :deep(.zupfnoter-element[data-drag-enabled="true"]:hover .zupfnoter-hitbox) {
  opacity: 0.12;
  fill: var(--zn-accent);
  stroke: var(--zn-accent-strong);
  stroke-width: 0.8;
}

.harp-preview__svg :deep(.zupfnoter-hitbox.zn-playback-highlight) {
  fill: color-mix(in srgb, var(--zn-accent) 22%, transparent);
  fill-opacity: 1;
  stroke: color-mix(in srgb, var(--zn-accent-strong) 78%, white);
  stroke-width: 1.1;
  opacity: 1;
  vector-effect: non-scaling-stroke;
  shape-rendering: geometricPrecision;
  stroke-linejoin: miter;
}

.harp-preview__svg :deep(.zupfnoter-hitbox.zn-selection-highlight) {
  fill: color-mix(in srgb, var(--zn-danger) 12%, transparent);
  fill-opacity: 1;
  stroke: color-mix(in srgb, var(--zn-danger) 88%, white);
  stroke-width: 1.5;
  opacity: 1;
  vector-effect: non-scaling-stroke;
  shape-rendering: geometricPrecision;
  stroke-linejoin: miter;
}

.harp-preview__svg :deep(.zupfnoter-element.zn-selection-highlight .zupfnoter-bezier-controls) {
  opacity: 1;
  stroke: var(--zn-danger);
  stroke-width: 1.6;
}

.harp-preview__svg :deep(.zupfnoter-element.zn-selection-highlight > .zupfnoter-shape) {
  stroke: var(--zn-danger);
  stroke-width: 1.5;
}

.harp-preview__svg :deep(.zupfnoter-image-resize-handle) {
  opacity: 0;
  fill: color-mix(in srgb, var(--zn-danger) 72%, white);
  stroke: color-mix(in srgb, var(--zn-danger) 55%, transparent);
  stroke-width: 0.35;
  cursor: nwse-resize !important;
  transform-box: fill-box;
  transform-origin: center;
  transition: opacity 120ms ease, transform 120ms ease;
}

.harp-preview__svg :deep(.zupfnoter-shape--image) {
  cursor: move;
}

.harp-preview__svg :deep(.zupfnoter-image-move-handle) {
  opacity: 0;
  color: var(--zn-danger);
  cursor: move !important;
  transform-box: fill-box;
  transform-origin: center;
  transition: opacity 120ms ease, transform 120ms ease;
}

.harp-preview__svg :deep(.zupfnoter-element:hover .zupfnoter-image-move-handle),
.harp-preview__svg :deep(.zupfnoter-element[data-drag-active="true"] .zupfnoter-image-move-handle) {
  opacity: 0.86;
}

.harp-preview__svg :deep(.zupfnoter-image-resize-handle[data-image-resize-corner="top-left"]),
.harp-preview__svg :deep(.zupfnoter-image-resize-handle[data-image-resize-corner="bottom-right"]) {
  cursor: nwse-resize !important;
}

.harp-preview__svg :deep(.zupfnoter-image-resize-handle[data-image-resize-corner="top-right"]),
.harp-preview__svg :deep(.zupfnoter-image-resize-handle[data-image-resize-corner="bottom-left"]) {
  cursor: nesw-resize !important;
}

.harp-preview__svg :deep(.zupfnoter-element:hover .zupfnoter-image-resize-handle),
.harp-preview__svg :deep(.zupfnoter-image-resize-handle:hover),
.harp-preview__svg :deep(.zupfnoter-element[data-drag-active="true"] .zupfnoter-image-resize-handle) {
  opacity: 0.86;
  stroke-width: 0.45;
  transform: scale(1.12);
}

.harp-preview__svg :deep(.zupfnoter-element.zn-selection-highlight .zupfnoter-bezier-drag-polygon) {
  opacity: 0.18;
  fill: var(--zn-danger);
  stroke: var(--zn-danger);
}

.harp-preview__svg :deep(.zupfnoter-element.zn-selection-highlight .zupfnoter-shape--image) {
  opacity: 0.72;
  filter: drop-shadow(0 0 0.7px var(--zn-danger));
}

.harp-preview__error {
  padding: var(--zn-space-3);
  color: var(--zn-danger);
  font-family: var(--zn-font-mono);
  font-size: 0.78rem;
  white-space: pre-wrap;
}

.harp-preview__magnifier-spot {
  position: absolute;
  border: 2px solid var(--zn-accent-strong);
  border-radius: 0.2rem;
  background: rgba(74, 97, 132, 0.08);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.45) inset;
  pointer-events: none;
}

.harp-preview__context-menu {
  position: absolute;
  z-index: 20;
  display: grid;
  min-width: 13rem;
  padding: 0.35rem;
  border: 1px solid var(--zn-panel-border, #ccd5e2);
  border-radius: 0.45rem;
  background: var(--zn-surface, #ffffff);
  box-shadow: 0 0.5rem 1.4rem rgba(25, 38, 58, 0.22);
}

.harp-preview__context-menu-entry {
  display: grid;
  grid-template-columns: 1.2rem 1fr;
  gap: 0.45rem;
  align-items: center;
  width: 100%;
  padding: 0.45rem 0.55rem;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  color: var(--zn-text, #1d2a3a);
  text-align: left;
  cursor: pointer;
}

.harp-preview__context-menu-entry:hover:not(:disabled) {
  background: var(--zn-surface-muted, #edf2f8);
}

.harp-preview__context-menu-entry:disabled {
  color: var(--zn-text-muted, #8a96a6);
  cursor: default;
}

.harp-preview__context-menu-icon {
  color: var(--zn-accent, #46658d);
  text-align: center;
}
</style>
