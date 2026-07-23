<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'

import { makeJumplinePathData, type JumplinePathInfo } from '@zupfnoter/core'
import type { PlaybackHighlight, SelectionOrigin, SelectionTextRange, SheetObjectIndex } from '@zupfnoter/types'

import { ZnPanel, ZnTabs, ZnZoomControl } from '@zupfnoter/design-system'
import { resolveSelectionOriginByZnId } from '../selectionIndex'
import type { HarpPreviewDragEnd } from '../multiWindow/harpMirrorChannel'
import HarpMagnifierPopover from './HarpMagnifierPopover.vue'
import { useZoomableSvgPreview } from './useZoomableSvgPreview'
import { usePlaybackSvgHighlight } from './usePlaybackSvgHighlight'
import { useSelectionSvgHighlight } from './useSelectionSvgHighlight'

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
}>()

const emit = defineEmits<{
  (event: 'select-text-range', payload: {
    startpos: number
    endpos: number
    extend: boolean
    origin?: SelectionOrigin
    source: 'harp-preview'
  }): void
  (event: 'scroll', payload: { scrollLeft: number; scrollTop: number }): void
  (event: 'drag-end', payload: HarpPreviewDragEnd): void
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
interface ActiveDrag {
  pointerId: number
  confKey: string
  handler: string
  value?: number | [number, number]
  grid?: number
  jumpline?: JumplinePathInfo
  pathElement?: SVGPathElement
  originalPathData?: string
  element: Element
  startClient: { x: number; y: number }
}

const dragState = ref<ActiveDrag | null>(null)
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
    const confKey = draggable?.getAttribute('data-conf-key')
    const handler = draggable?.getAttribute('data-drag-handler')
    const dragGridText = draggable?.getAttribute('data-drag-grid')
    const dragGrid = typeof dragGridText === 'string' ? Number(dragGridText) : Number.NaN
    const jumplineText = draggable?.getAttribute('data-drag-jumpline')
    const jumpline = parseJumplineInfo(jumplineText ?? null)
    const pathElement = jumpline === undefined
      ? undefined
      : draggable?.querySelector<SVGPathElement>('path:not([data-drag-hitbox])')
    const dragValueText = draggable?.getAttribute('data-drag-value')
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
        element: draggable,
        startClient: { x: event.clientX, y: event.clientY },
      }
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

function handlePointerMove(event: PointerEvent): void {
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
}

function handlePointerUp(event: PointerEvent): void {
  const activeDrag = dragState.value
  if (activeDrag?.pointerId === event.pointerId) {
    const delta = screenDeltaToSvgDelta(
      activeDrag.element,
      event.clientX - activeDrag.startClient.x,
      event.clientY - activeDrag.startClient.y,
    )
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
        confKey: activeDrag.confKey,
        handler: activeDrag.handler,
        delta: [deltaX, deltaY],
        ...(activeDrag.value !== undefined
          ? {
            value: typeof activeDrag.value === 'number'
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
  if (activeDrag.jumpline !== undefined && activeDrag.pathElement !== undefined) {
    activeDrag.pathElement.setAttribute('d', makeJumplinePathData({
      ...activeDrag.jumpline,
      vertical: activeDrag.jumpline.vertical + deltaX,
    }).outlinePathData)
    return
  }
  activeDrag.element.setAttribute('transform', `translate(${deltaX} ${deltaY})`)
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
    dragState.value.element.removeAttribute('transform')
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
</script>

<template>
  <ZnPanel>
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
        </div>
      </div>
      <div
        ref="frameRef"
        class="harp-preview__frame"
        :class="{ 'harp-preview__frame--pdf': mode === 'pdf' }"
        @scroll="handleScroll"
        @pointercancel="handlePointerCancel"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointerleave="clearJumplineHover"
        @wheel="onWheel"
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
        @close="closeMagnifier"
      />
    </div>
  </ZnPanel>
</template>

<style scoped>
.harp-preview {
  display: flex;
  flex-direction: column;
  gap: var(--zn-space-2);
  min-height: 0;
  height: 100%;
}

.harp-preview__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--zn-space-3);
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
</style>
