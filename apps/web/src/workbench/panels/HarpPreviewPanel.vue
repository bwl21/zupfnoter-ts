<script setup lang="ts">
import { ref, toRef } from 'vue'

import type { PlaybackHighlight } from '@zupfnoter/types'

import ZnZoomControl from '../../design-system/components/ZnZoomControl.vue'
import ZnTabs from '../../design-system/components/ZnTabs.vue'
import ZnPanel from '../../design-system/components/ZnPanel.vue'
import { useZoomableSvgPreview } from './useZoomableSvgPreview'
import { usePlaybackSvgHighlight } from './usePlaybackSvgHighlight'
import { useSelectionSvgHighlight } from './useSelectionSvgHighlight'

const props = defineProps<{
  svg: string
  errorMessage?: string
  playbackHighlight?: PlaybackHighlight
  selectedZnIds?: string[]
}>()

const emit = defineEmits<{
  (event: 'select-zn-id', payload: { znId: string; extend: boolean; source: 'harp-preview' }): void
}>()

const mode = ref('normal')
const pointerDownPosition = ref<{ x: number; y: number } | null>(null)
const pointerDownTarget = ref<EventTarget | null>(null)
const zoom = defineModel<number>('zoom', {
  default: 100,
})

const { canvasRef, canvasStyle, frameRef, onPointerCancel, onPointerDown, onPointerMove, onPointerUp, onWheel, setZoom } = useZoomableSvgPreview(toRef(props, 'svg'), zoom)
usePlaybackSvgHighlight(
  canvasRef,
  toRef(props, 'svg'),
  toRef(props, 'playbackHighlight'),
)
useSelectionSvgHighlight(
  canvasRef,
  toRef(props, 'svg'),
  toRef(props, 'selectedZnIds'),
)

function emitSelectionFromEvent(target: EventTarget | null, extend: boolean): void {
  if (!(target instanceof Element)) return
  const element = target.closest('[data-zn-id]')
  const znId = element?.getAttribute('data-zn-id') ?? undefined
  if (znId === undefined) return
  emit('select-zn-id', {
    znId,
    extend,
    source: 'harp-preview',
  })
}

function handlePointerDown(event: PointerEvent): void {
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
      </div>
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

.harp-preview__svg :deep(.zn-playback-highlight) {
  filter:
    drop-shadow(0 0 1.2px color-mix(in srgb, var(--zn-accent-strong) 80%, white))
    drop-shadow(0 0 4px color-mix(in srgb, var(--zn-accent) 40%, transparent));
}

.harp-preview__svg :deep(.zn-selection-highlight) {
  filter:
    drop-shadow(0 0 1.2px color-mix(in srgb, var(--zn-warning) 85%, white))
    drop-shadow(0 0 3px color-mix(in srgb, var(--zn-warning) 48%, transparent));
}

.harp-preview__error {
  padding: var(--zn-space-3);
  color: var(--zn-danger);
  font-family: var(--zn-font-mono);
  font-size: 0.78rem;
  white-space: pre-wrap;
}
</style>
