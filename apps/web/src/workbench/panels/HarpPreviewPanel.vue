<script setup lang="ts">
import { computed, ref, toRef } from 'vue'

import type { PlaybackHighlight, SelectionTextRange } from '@zupfnoter/types'

import ZnZoomControl from '../../design-system/components/ZnZoomControl.vue'
import ZnTabs from '../../design-system/components/ZnTabs.vue'
import ZnPanel from '../../design-system/components/ZnPanel.vue'
import HarpMagnifierPopover from './HarpMagnifierPopover.vue'
import { useZoomableSvgPreview } from './useZoomableSvgPreview'
import { usePlaybackSvgHighlight } from './usePlaybackSvgHighlight'
import { useSelectionSvgHighlight } from './useSelectionSvgHighlight'

const props = defineProps<{
  svg: string
  errorMessage?: string
  playbackHighlight?: PlaybackHighlight
  selection?: {
    znIds: string[]
    confKeys: string[]
    textRanges: SelectionTextRange[]
  }
  allowWheelZoomWithoutModifier?: boolean
}>()

const emit = defineEmits<{
  (event: 'select-text-range', payload: { startpos: number; endpos: number; extend: boolean; source: 'harp-preview' }): void
  (event: 'scroll', payload: { scrollLeft: number; scrollTop: number }): void
}>()

const mode = ref('normal')
const magnifierOpen = ref(false)
const magnifierSession = ref(0)
const magnifierAnchor = ref<{ x: number; y: number } | null>(null)
const magnifierSourcePoint = ref<{ x: number, y: number } | null>(null)
const magnifierViewport = ref<{ width: number, height: number } | null>(null)
const magnifierZoom = 800
const pointerDownPosition = ref<{ x: number; y: number } | null>(null)
const pointerDownTarget = ref<EventTarget | null>(null)
const zoom = defineModel<number>('zoom', {
  default: 100,
})

const preview = useZoomableSvgPreview(
  toRef(props, 'svg'),
  zoom,
  props.allowWheelZoomWithoutModifier === true,
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
  if (startChar === null || endChar === null) return
  const startpos = Number(startChar)
  const endpos = Number(endChar)
  if (Number.isNaN(startpos) || Number.isNaN(endpos)) return
  emit('select-text-range', {
    startpos,
    endpos,
    extend,
    source: 'harp-preview',
  })
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
  pointerDownPosition.value = {
    x: event.clientX,
    y: event.clientY,
  }
  pointerDownTarget.value = event.target
  onPointerDown(event)
}

function handlePointerUp(event: PointerEvent): void {
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
        @scroll="handleScroll"
        @pointercancel="onPointerCancel"
        @pointerdown="handlePointerDown"
        @pointermove="onPointerMove"
        @pointerup="handlePointerUp"
        @wheel="onWheel"
      >
        <div v-if="errorMessage" class="harp-preview__error">
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
  cursor: grab;
  user-select: none;
}

.harp-preview__frame:active {
  cursor: grabbing;
}

.harp-preview__svg {
  display: block;
  max-width: none;
}

.harp-preview__svg :deep(svg) {
  display: block;
  max-width: none;
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
