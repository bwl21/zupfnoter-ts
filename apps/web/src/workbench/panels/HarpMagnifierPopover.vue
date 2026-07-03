<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'

import ZnButton from '../../design-system/components/ZnButton.vue'
import ZnZoomControl from '../../design-system/components/ZnZoomControl.vue'
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
}>()

const zoom = ref(props.zoomLevel ?? 25600)
const needsCenter = ref(false)
const panelKey = ref(0)
const lastSourcePoint = ref<Point | null>(null)
const { canvasRef, canvasStyle, centerOnSourcePoint, frameRef, getViewportCenterPoint, onPointerCancel, onPointerDown, onPointerMove, onPointerUp, onWheel, setZoomAtPoint } = useZoomableSvgPreview(
  toRef(props, 'svg'),
  zoom,
  { fitToWidth: false, maxZoom: 25600 },
)

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
        @pointercancel="onPointerCancel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
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
.harp-magnifier__error {
  padding: var(--zn-space-3);
  color: var(--zn-danger);
  font-family: var(--zn-font-mono);
  font-size: 0.78rem;
  white-space: pre-wrap;
}
</style>
