<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { PlaybackHighlight, SelectionTextRange } from '@zupfnoter/types'

import ScorePreviewPanel from '../workbench/panels/ScorePreviewPanel.vue'
import { createHarpMirrorChannel, type HarpMirrorSnapshot } from '../workbench/multiWindow/harpMirrorChannel'

const channel = createHarpMirrorChannel()
const snapshot = ref<HarpMirrorSnapshot | undefined>(undefined)

const scoreSvg = computed(() => snapshot.value?.scoreSvg ?? '')
const renderError = computed(() => snapshot.value?.renderError)
const selectedTextRanges = computed<SelectionTextRange[] | undefined>(() => snapshot.value?.selectedScoreTextRanges)
const playbackTextRanges = computed<SelectionTextRange[] | undefined>(() => snapshot.value?.playbackScoreTextRanges)
const playbackHighlight = computed<PlaybackHighlight | undefined>(() => snapshot.value?.playbackHighlight)
let requestTimer: ReturnType<typeof setInterval> | undefined

function applySnapshot(nextSnapshot: HarpMirrorSnapshot): void {
  snapshot.value = nextSnapshot
  if (requestTimer !== undefined) {
    clearInterval(requestTimer)
    requestTimer = undefined
  }
}

function handleMessage(event: MessageEvent): void {
  const data: unknown = event.data
  if (typeof data !== 'object' || data === null) return
  const record = data as { kind?: string, snapshot?: HarpMirrorSnapshot }
  if (record.kind !== 'snapshot' || record.snapshot === undefined) return
  applySnapshot(record.snapshot)
}

onMounted(() => {
  channel?.addEventListener('message', handleMessage)
  const requestSnapshot = (): void => {
    window.opener?.postMessage({ kind: 'mirror-request', target: 'notes' }, window.location.origin)
  }
  requestSnapshot()
  requestTimer = setInterval(requestSnapshot, 100)
  window.opener?.postMessage({ kind: 'mirror-ready' }, window.location.origin)
})

onBeforeUnmount(() => {
  channel?.removeEventListener('message', handleMessage)
  channel?.close()
  if (requestTimer !== undefined) {
    clearInterval(requestTimer)
    requestTimer = undefined
  }
})

watch(
  () => snapshot.value,
  () => {
    const frame = document.querySelector<HTMLElement>('.notes-mirror .preview-stage__frame')
    if (frame === null || snapshot.value === undefined) return
    frame.scrollLeft = snapshot.value.scrollLeft
    frame.scrollTop = snapshot.value.scrollTop
  },
  { flush: 'post' },
)
</script>

<template>
  <main class="notes-mirror">
    <ScorePreviewPanel
      :error-message="renderError"
      :playback-text-ranges="playbackTextRanges"
      :selected-text-ranges="selectedTextRanges"
      :svg="scoreSvg"
    />
  </main>
</template>

<style scoped>
.notes-mirror {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--zn-bg);
}

.notes-mirror :deep(.preview-stage__controls) {
  display: none;
}
</style>
