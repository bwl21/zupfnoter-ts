<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { PlaybackHighlight, SelectionProjection } from '@zupfnoter/types'

import HarpPreviewPanel from '../workbench/panels/HarpPreviewPanel.vue'
import { createHarpMirrorChannel, type HarpMirrorSnapshot } from '../workbench/multiWindow/harpMirrorChannel'

const channel = createHarpMirrorChannel()
const snapshot = ref<HarpMirrorSnapshot | undefined>(undefined)

const harpSvg = computed(() => snapshot.value?.harpSvg ?? '')
const renderError = computed(() => snapshot.value?.renderError)
const playbackHighlight = computed<PlaybackHighlight | undefined>(() => snapshot.value?.playbackHighlight)
const selection = computed<SelectionProjection | undefined>(() => snapshot.value?.selection)
const harpZoom = ref(100)
let requestTimer: ReturnType<typeof setInterval> | undefined

function applySnapshot(nextSnapshot: HarpMirrorSnapshot): void {
  snapshot.value = nextSnapshot
  harpZoom.value = nextSnapshot.harpZoom
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
    window.opener?.postMessage({ kind: 'mirror-request', target: 'harp' }, window.location.origin)
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
    const frame = document.querySelector<HTMLElement>('.harp-mirror__panel .harp-preview__frame')
    if (frame === null || snapshot.value === undefined) return
    frame.scrollLeft = snapshot.value.scrollLeft
    frame.scrollTop = snapshot.value.scrollTop
  },
  { flush: 'post' },
)

</script>

<template>
  <main class="harp-mirror">
    <HarpPreviewPanel
      class="harp-mirror__panel"
      :allow-wheel-zoom-without-modifier="true"
      :error-message="renderError"
      :playback-highlight="playbackHighlight"
      :selection="selection"
      v-model:zoom="harpZoom"
      :svg="harpSvg"
    />
  </main>
</template>

<style scoped>
.harp-mirror {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--zn-bg);
}

.harp-mirror__panel {
  width: 100%;
  height: 100%;
}

.harp-mirror__panel :deep(.harp-preview__header) {
  display: none;
}

.harp-mirror__panel :deep(.harp-preview__frame) {
  cursor: default;
}
</style>
