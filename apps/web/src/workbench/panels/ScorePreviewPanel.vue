<script setup lang="ts">
import { ref, toRef } from 'vue'

import type { SelectionOrigin, SelectionTextRange, SheetObjectIndex } from '@zupfnoter/types'

import ZnPanel from '../../design-system/components/ZnPanel.vue'
import { resolveSelectionOriginByTextRange } from '../selectionIndex'
import { useTextRangeSvgHighlight } from './useTextRangeSvgHighlight'

const props = defineProps<{
  svg: string
  errorMessage?: string
  selectedTextRanges?: SelectionTextRange[]
  playbackTextRanges?: SelectionTextRange[]
  sheetObjectIndex?: SheetObjectIndex
}>()

const emit = defineEmits<{
  (event: 'select-text-range', payload: {
    startpos: number
    endpos: number
    extend: boolean
    origin?: SelectionOrigin
    source: 'score-preview'
  }): void
}>()

const svgFrame = ref<HTMLElement | null>(null)

useTextRangeSvgHighlight(
  svgFrame,
  toRef(props, 'svg'),
  toRef(props, 'selectedTextRanges'),
  'zn-selection-highlight-range',
)
useTextRangeSvgHighlight(
  svgFrame,
  toRef(props, 'svg'),
  toRef(props, 'playbackTextRanges'),
  'zn-playback-highlight',
)

function handleSvgClick(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof Element)) return
  const element = target.closest('.zn-score-hitbox[data-start-char][data-end-char]')
  const startpos = Number(element?.getAttribute('data-start-char'))
  const endpos = Number(element?.getAttribute('data-end-char'))
  if (Number.isNaN(startpos) || Number.isNaN(endpos)) return
  const origin = resolveSelectionOriginByTextRange(props.sheetObjectIndex, { startpos, endpos })
  emit('select-text-range', {
    startpos,
    endpos,
    extend: event.shiftKey,
    origin,
    source: 'score-preview',
  })
}
</script>

<template>
  <ZnPanel tone="surface">
    <div class="preview-stage">
      <div class="preview-stage__controls">
        <div class="preview-stage__controls-left">
          <input aria-label="enter chord" class="preview-stage__input" placeholder="enter chord" type="text">
          <input aria-label="enter notes" class="preview-stage__input preview-stage__input--wide" placeholder="enter notes" type="text">
        </div>
      </div>
      <div class="preview-stage__frame">
        <div v-if="errorMessage" class="preview-stage__error">
          {{ errorMessage }}
        </div>
        <div
          v-else
          ref="svgFrame"
          class="preview-stage__svg"
          @click="handleSvgClick"
          v-html="svg"
        />
      </div>
    </div>
  </ZnPanel>
</template>

<style scoped>
.preview-stage {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--zn-space-3);
  min-height: 0;
  height: 100%;
}

.preview-stage__controls {
  display: flex;
  align-items: center;
  gap: var(--zn-space-3);
  flex: 0 0 auto;
}

.preview-stage__controls-left {
  display: flex;
  align-items: center;
  gap: var(--zn-space-3);
}

.preview-stage__input {
  width: 7rem;
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--zn-border-strong);
  border-radius: var(--zn-radius-sm);
  background: var(--zn-bg-surface);
  color: var(--zn-text);
  font-family: var(--zn-font-sans);
  font-size: 0.82rem;
}

.preview-stage__input--wide {
  width: 9.5rem;
}

.preview-stage__frame {
  position: relative;
  min-height: 0;
  height: 100%;
  padding: var(--zn-space-2);
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-sm);
  background: var(--zn-bg-surface);
  overflow: auto;
}

.preview-stage__svg {
  display: block;
  max-width: none;
}

.preview-stage__svg :deep(svg) {
  display: block;
  max-width: none;
}

.preview-stage__svg :deep(.zn-score-hitbox) {
  cursor: pointer;
}

.preview-stage__svg :deep(.zn-score-hitbox.zn-playback-highlight) {
  fill: color-mix(in srgb, var(--zn-accent) 22%, transparent);
  fill-opacity: 1;
  stroke: color-mix(in srgb, var(--zn-accent-strong) 78%, white);
  stroke-width: 1.1;
}

.preview-stage__svg :deep(.zn-score-hitbox.zn-selection-highlight-range) {
  fill: color-mix(in srgb, var(--zn-danger) 38%, transparent);
  fill-opacity: 1;
  stroke: color-mix(in srgb, var(--zn-danger) 88%, white);
  stroke-width: 2.2;
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--zn-danger) 45%, transparent));
}

.preview-stage__svg :deep(.zn-score-hitbox.zn-selection-highlight-range.zn-playback-highlight) {
  fill: color-mix(in srgb, var(--zn-accent) 22%, transparent);
  fill-opacity: 1;
  stroke: color-mix(in srgb, var(--zn-danger) 88%, white);
  stroke-width: 2.2;
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--zn-danger) 45%, transparent));
}

.preview-stage__error {
  color: var(--zn-danger);
  font-family: var(--zn-font-mono);
  font-size: 0.78rem;
  white-space: pre-wrap;
}
</style>
