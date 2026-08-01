<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'

import { ZnButton, ZnZoomControl } from '@zupfnoter/design-system'
import {
  bezierControlToLegacyValue,
  makeBezierPathData,
  type BezierPathInfo,
} from '@zupfnoter/core'
import type { HarpPreviewDragEnd } from '../multiWindow/harpMirrorChannel'
import { useZoomableSvgPreview } from './useZoomableSvgPreview'

interface Point {
  x: number
  y: number
}

const props = defineProps<{
  svg: string
  open: boolean
  positionStyle?: { left: string; top: string }
  sourcePoint: Point | null
  zoomLevel?: number
  errorMessage?: string
}>()

const emit = defineEmits<{
  close: []
  'viewport-resize': [size: { width: number, height: number }]
  'drag-end': [payload: HarpPreviewDragEnd]
}>()

interface ActiveHandleDrag {
  pointerId: number
  confKey: string
  handler: 'bezier' | 'tuplet'
  control: 'cp1' | 'cp2'
  bezier: BezierPathInfo
  element: HTMLElement
  pathElement: SVGPathElement
  controlLineElement?: SVGPathElement
  startClient: Point
}

type ImageResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface ActiveImageResizeDrag {
  pointerId: number
  positionConfKey: string
  heightConfKey: string
  corner: ImageResizeCorner
  bounds: { x: number; y: number; width: number; height: number }
  element: HTMLElement
  image: SVGImageElement
  startClient: Point
}

const zoom = ref(props.zoomLevel ?? 25600)
const needsCenter = ref(false)
const panelKey = ref(0)
const lastSourcePoint = ref<Point | null>(null)
const { canvasRef, canvasStyle, centerOnSourcePoint, displayScale, frameRef, getViewportCenterPoint, onPointerCancel: onPreviewPointerCancel, onPointerDown: onPreviewPointerDown, onPointerMove: onPreviewPointerMove, onPointerUp: onPreviewPointerUp, onWheel, setZoomAtPoint } = useZoomableSvgPreview(
  toRef(props, 'svg'),
  zoom,
  { fitToWidth: false, maxZoom: 25600 },
)
const activeHandleDrag = ref<ActiveHandleDrag | null>(null)
const activeImageResizeDrag = ref<ActiveImageResizeDrag | null>(null)

function emitViewportSize(): void {
  const frame = frameRef.value
  if (frame === null) return

  const rect = frame.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return

  emit('viewport-resize', {
    width: rect.width,
    height: rect.height,
  })
}

function adjustZoom(delta: number): void {
  const nextZoom = zoom.value + delta
  zoom.value = Math.min(25600, Math.max(200, nextZoom))
  void setZoomAtPoint(zoom.value, getViewportCenterPoint())
}

watch(
  () => [props.open, props.sourcePoint, props.zoomLevel] as const,
  ([open, sourcePoint]) => {
    if (open && sourcePoint !== null) {
      const previous = lastSourcePoint.value
      if (previous === null || previous.x !== sourcePoint.x || previous.y !== sourcePoint.y) {
        panelKey.value += 1
        lastSourcePoint.value = sourcePoint
      }
    } else {
      lastSourcePoint.value = null
    }

    needsCenter.value = open && sourcePoint !== null
    if (open && sourcePoint !== null) {
      zoom.value = props.zoomLevel ?? 25600
      void setZoomAtPoint(zoom.value, sourcePoint)
    }
  },
  { immediate: true },
)

watch(
  () => [props.open, props.sourcePoint] as const,
  async ([open, sourcePoint]) => {
    if (!open || sourcePoint === null) {
      return
    }

    await nextTick()
    await centerOnSourcePoint(sourcePoint)
    emitViewportSize()
    const frame = frameRef.value
    if (frame !== null) {
      frame.focus()
    }
    needsCenter.value = false
  },
  { immediate: true },
)

watch(zoom, (value) => {
  void setZoomAtPoint(value, getViewportCenterPoint())
})

function close(): void {
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

function parseBezierInfo(value: string | null): BezierPathInfo | undefined {
  if (value === null || value.trim() === '') return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
    const info = parsed as Record<string, unknown>
    if (!isPoint(info.from) || !isPoint(info.to) || !isPoint(info.cp1) || !isPoint(info.cp2)) return undefined
    return { from: info.from, to: info.to, cp1: info.cp1, cp2: info.cp2 }
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

function screenDeltaToSvgDelta(element: Element, screenX: number, screenY: number): [number, number] | null {
  const svg = element.closest('svg')
  if (!(svg instanceof SVGSVGElement)) return null
  const matrix = svg.getScreenCTM()
  if (matrix === null) {
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

function tryStartHandleDrag(event: PointerEvent): boolean {
  if (event.button !== 0 || !(event.target instanceof Element)) return false
  const control = event.target.closest<SVGPathElement>('[data-bezier-control]')?.dataset.bezierControl
  if (control !== 'cp1' && control !== 'cp2') return false
  const drawable = event.target.closest<HTMLElement>('.zupfnoter-element[data-drag-enabled="true"][data-drag-handler]')
  if (drawable === null) return false
  const handler = drawable.dataset.dragHandler
  if (handler !== 'bezier' && handler !== 'tuplet') return false
  const bezier = parseBezierInfo(drawable.dataset.dragBezier ?? null)
  const confKey = drawable.dataset.dragConfKey ?? drawable.dataset.confKey
  const pathElement = drawable.querySelector<SVGPathElement>('path:not([data-drag-hitbox]):not([data-bezier-polygon]):not([data-bezier-control])')
  if (bezier === undefined || confKey === undefined || pathElement === null) return false
  activeHandleDrag.value = {
    pointerId: event.pointerId,
    confKey,
    handler,
    control,
    bezier,
    element: drawable,
    pathElement,
    controlLineElement: drawable.querySelector<SVGPathElement>(`path[data-bezier-control="${control}"]`) ?? undefined,
    startClient: { x: event.clientX, y: event.clientY },
  }
  frameRef.value?.setPointerCapture(event.pointerId)
  drawable.setAttribute('data-drag-active', 'true')
  event.preventDefault()
  event.stopPropagation()
  return true
}

function tryStartImageResizeDrag(event: PointerEvent): boolean {
  if (event.button !== 0 || !(event.target instanceof Element)) return false
  const handle = event.target.closest<SVGRectElement>('[data-image-resize-corner]')
  if (handle === null) return false
  const corner = handle.dataset.imageResizeCorner
  if (corner !== 'top-left' && corner !== 'top-right' && corner !== 'bottom-left' && corner !== 'bottom-right') return false
  const element = handle.closest<HTMLElement>('.zupfnoter-element[data-drag-enabled="true"]')
  const image = element?.querySelector<SVGImageElement>('image.zupfnoter-shape--image')
  const positionConfKey = element?.dataset.dragConfKey ?? element?.dataset.confKey
  const heightConfKey = element?.dataset.dragHeightConfKey
  if (element === null || element === undefined || image === null || image === undefined || positionConfKey === undefined || heightConfKey === undefined) return false

  activeImageResizeDrag.value = {
    pointerId: event.pointerId,
    positionConfKey,
    heightConfKey,
    corner,
    bounds: image.getBBox(),
    element,
    image,
    startClient: { x: event.clientX, y: event.clientY },
  }
  element.setAttribute('data-drag-active', 'true')
  frameRef.value?.setPointerCapture(event.pointerId)
  event.preventDefault()
  event.stopPropagation()
  return true
}

function imageResizeGeometry(
  resize: Pick<ActiveImageResizeDrag, 'bounds' | 'corner'>,
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

function setImageResizeGeometry(
  drag: ActiveImageResizeDrag,
  geometry: { x: number; y: number; width: number; height: number },
): void {
  drag.image.setAttribute('x', String(geometry.x))
  drag.image.setAttribute('y', String(geometry.y))
  drag.image.setAttribute('width', String(geometry.width))
  drag.image.setAttribute('height', String(geometry.height))
  for (const handle of drag.element.querySelectorAll<SVGRectElement>('[data-image-resize-corner]')) {
    const corner = handle.dataset.imageResizeCorner
    const point: Point = corner === 'top-left'
      ? { x: geometry.x, y: geometry.y }
      : corner === 'top-right'
        ? { x: geometry.x + geometry.width, y: geometry.y }
        : corner === 'bottom-left'
          ? { x: geometry.x, y: geometry.y + geometry.height }
          : { x: geometry.x + geometry.width, y: geometry.y + geometry.height }
    handle.setAttribute('x', String(point.x - 2))
    handle.setAttribute('y', String(point.y - 2))
  }
  drag.element.querySelector<SVGGElement>('[data-image-move-handle]')?.setAttribute(
    'transform',
    `translate(${geometry.x + geometry.width / 2} ${geometry.y + geometry.height / 2})`,
  )
}

function updateImageResizeDrag(event: PointerEvent): void {
  const active = activeImageResizeDrag.value
  if (active === null || active.pointerId !== event.pointerId) return
  const delta = screenDeltaToSvgDelta(active.element, event.clientX - active.startClient.x, event.clientY - active.startClient.y)
  if (delta === null) return
  setImageResizeGeometry(active, imageResizeGeometry(active, delta[1]))
}

function finishImageResizeDrag(event: PointerEvent, cancelled: boolean): void {
  const active = activeImageResizeDrag.value
  if (active === null || active.pointerId !== event.pointerId) return
  const delta = screenDeltaToSvgDelta(active.element, event.clientX - active.startClient.x, event.clientY - active.startClient.y)
  active.element.removeAttribute('data-drag-active')
  activeImageResizeDrag.value = null
  if (frameRef.value?.hasPointerCapture(event.pointerId) === true) frameRef.value.releasePointerCapture(event.pointerId)
  if (cancelled || delta === null) {
    setImageResizeGeometry(active, active.bounds)
    return
  }
  const geometry = imageResizeGeometry(active, delta[1])
  emit('drag-end', {
    confKey: active.heightConfKey,
    handler: 'image-resize',
    delta,
    updates: [
      { confKey: active.positionConfKey, value: [geometry.x, geometry.y] },
      { confKey: active.heightConfKey, value: geometry.height },
    ],
    value: geometry.height,
    source: 'harp-preview',
  })
}

function updateHandleDrag(event: PointerEvent): void {
  const active = activeHandleDrag.value
  if (active === null || active.pointerId !== event.pointerId) return
  const delta = screenDeltaToSvgDelta(active.element, event.clientX - active.startClient.x, event.clientY - active.startClient.y)
  if (delta === null) return
  const updated: BezierPathInfo = {
    ...active.bezier,
    [active.control]: [
      active.bezier[active.control][0] + delta[0],
      active.bezier[active.control][1] + delta[1],
    ],
  }
  active.pathElement.setAttribute('d', makeBezierPathData(updated))
  active.controlLineElement?.setAttribute(
    'd',
    `M${active.control === 'cp1' ? updated.from[0] : updated.to[0]} ${active.control === 'cp1' ? updated.from[1] : updated.to[1]}L${updated[active.control][0]} ${updated[active.control][1]}`,
  )
}

function finishHandleDrag(event: PointerEvent, cancelled: boolean): void {
  const active = activeHandleDrag.value
  if (active === null || active.pointerId !== event.pointerId) return
  const delta = screenDeltaToSvgDelta(active.element, event.clientX - active.startClient.x, event.clientY - active.startClient.y)
  active.element.removeAttribute('data-drag-active')
  activeHandleDrag.value = null
  if (frameRef.value?.hasPointerCapture(event.pointerId) === true) frameRef.value.releasePointerCapture(event.pointerId)
  if (cancelled || delta === null) return
  const control = active.bezier[active.control]
  const updatedControl: [number, number] = [control[0] + delta[0], control[1] + delta[1]]
  emit('drag-end', {
    confKey: `${active.confKey}.${active.control}`,
    handler: active.handler,
    delta,
    value: bezierControlToLegacyValue(
      active.bezier.from,
      active.bezier.to,
      updatedControl,
      active.control === 'cp1' ? 'from' : 'to',
    ),
    source: 'harp-preview',
  })
}

function handlePointerDown(event: PointerEvent): void {
  if (!tryStartImageResizeDrag(event) && !tryStartHandleDrag(event)) onPreviewPointerDown(event)
}

function handlePointerMove(event: PointerEvent): void {
  if (activeImageResizeDrag.value !== null) {
    updateImageResizeDrag(event)
    event.preventDefault()
    return
  }
  if (activeHandleDrag.value !== null) {
    updateHandleDrag(event)
    event.preventDefault()
    return
  }
  onPreviewPointerMove(event)
}

function handlePointerUp(event: PointerEvent): void {
  if (activeImageResizeDrag.value !== null) {
    finishImageResizeDrag(event, false)
    event.preventDefault()
    return
  }
  if (activeHandleDrag.value !== null) {
    finishHandleDrag(event, false)
    event.preventDefault()
    return
  }
  onPreviewPointerUp(event)
}

function handlePointerCancel(event: PointerEvent): void {
  if (activeImageResizeDrag.value !== null) {
    finishImageResizeDrag(event, true)
    event.preventDefault()
    return
  }
  if (activeHandleDrag.value !== null) {
    finishHandleDrag(event, true)
    event.preventDefault()
    return
  }
  onPreviewPointerCancel(event)
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

watch(frameRef, (frame, previousFrame) => {
  if (previousFrame !== null && frame !== previousFrame) {
    void previousFrame.blur()
  }
  if (frame === null) return
  emitViewportSize()
})

</script>

<template>
  <Teleport to="body">
    <div v-if="open" :key="panelKey" class="harp-magnifier" :style="props.positionStyle">
      <ZnButton
        class="harp-magnifier__close"
        aria-label="Schließen"
        variant="ghost"
        @mousedown.stop
        @click.stop="close"
      >
        X
      </ZnButton>
      <div class="harp-magnifier__zoombox">
        <ZnButton class="harp-magnifier__zoomstep" aria-label="Verkleinern" variant="ghost" @click="adjustZoom(-400)">
          -
        </ZnButton>
        <ZnButton class="harp-magnifier__zoomstep" aria-label="Vergrößern" variant="ghost" @click="adjustZoom(400)">
          +
        </ZnButton>
        <ZnZoomControl
          v-model="zoom"
          class="harp-magnifier__zoomcontrol"
          :max="25600"
          :min="200"
          :step="400"
        />
      </div>
      <div
        ref="frameRef"
        class="harp-magnifier__frame"
        tabindex="0"
        @pointercancel="handlePointerCancel"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @wheel="onWheel"
      >
        <div v-if="errorMessage" class="harp-magnifier__error">
          {{ errorMessage }}
        </div>
        <div
          v-else
          ref="canvasRef"
          class="harp-magnifier__svg"
          :style="canvasStyle"
          v-html="svg"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.harp-magnifier {
  position: fixed;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  width: clamp(10.5rem, 20vw, 15rem);
  height: clamp(10.5rem, 20vw, 15rem);
  padding: 0.15rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-sm);
  background: var(--zn-bg-elevated);
  box-shadow: var(--zn-shadow);
  box-sizing: border-box;
  transform: translate(-50%, -50%);
}
.harp-magnifier__close {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  z-index: 1;
  min-width: 1.7rem;
  min-height: 1.7rem;
  padding: 0;
  border-radius: var(--zn-radius-sm);
  font-weight: 700;
  line-height: 1;
  opacity: 0.72;
}
.harp-magnifier__zoombox {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding-right: 1.4rem;
}
.harp-magnifier__zoomstep {
  min-width: 1rem;
  min-height: 1rem;
  padding: 0;
  border-radius: var(--zn-radius-sm);
  font-weight: 700;
  line-height: 1;
  font-size: 0.68rem;
}
.harp-magnifier__zoomcontrol {
  transform: scale(0.66);
  transform-origin: left center;
}
.harp-magnifier__frame {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-sm);
  background: var(--zn-bg-surface);
  overflow: hidden;
  cursor: grab;
  user-select: none;
}
.harp-magnifier__frame:active {
  cursor: grabbing;
}
.harp-magnifier__frame :deep(svg) {
  display: block;
  max-width: none;
  max-height: none;
}
.harp-magnifier__svg {
  display: block;
  max-width: none;
}
.harp-magnifier__svg :deep(svg) {
  display: block;
  max-width: none;
}
.harp-magnifier__svg :deep(.zupfnoter-image-resize-handle) {
  opacity: 0;
  fill: color-mix(in srgb, var(--zn-danger) 72%, white);
  stroke: color-mix(in srgb, var(--zn-danger) 55%, transparent);
  stroke-width: 0.35;
  cursor: nwse-resize !important;
  transform-box: fill-box;
  transform-origin: center;
  transition: opacity 120ms ease, transform 120ms ease;
}
.harp-magnifier__svg :deep(.zupfnoter-image-resize-handle[data-image-resize-corner="top-right"]),
.harp-magnifier__svg :deep(.zupfnoter-image-resize-handle[data-image-resize-corner="bottom-left"]) {
  cursor: nesw-resize !important;
}
.harp-magnifier__svg :deep(.zupfnoter-image-move-handle) {
  opacity: 0.86;
  color: var(--zn-danger);
  cursor: move !important;
}
.harp-magnifier__svg :deep(.zupfnoter-element:hover .zupfnoter-image-resize-handle),
.harp-magnifier__svg :deep(.zupfnoter-image-resize-handle:hover),
.harp-magnifier__svg :deep(.zupfnoter-element[data-drag-active="true"] .zupfnoter-image-resize-handle) {
  opacity: 0.86;
  stroke-width: 0.45;
  transform: scale(1.12);
}
.harp-magnifier__error {
  padding: var(--zn-space-3);
  color: var(--zn-danger);
  font-family: var(--zn-font-mono);
  font-size: 0.78rem;
  white-space: pre-wrap;
}
</style>
