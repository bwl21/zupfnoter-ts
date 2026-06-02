<script setup lang="ts">
import { ref } from 'vue'

import ZnZoomControl from '../../design-system/components/ZnZoomControl.vue'
import ZnTabs from '../../design-system/components/ZnTabs.vue'
import ZnPanel from '../../design-system/components/ZnPanel.vue'

defineProps<{
  svg: string
  errorMessage?: string
}>()

const mode = ref('normal')
const zoom = defineModel<number>('zoom', {
  default: 100,
})
</script>

<template>
  <ZnPanel>
    <div class="harp-preview">
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
        <ZnZoomControl v-model="zoom" />
      </div>
      <div class="harp-preview__frame">
        <div v-if="errorMessage" class="harp-preview__error">
          {{ errorMessage }}
        </div>
        <div
          v-else
          class="harp-preview__svg"
          :style="{ transform: `scale(${zoom / 100})` }"
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

.harp-preview__controls {
  display: flex;
  justify-content: flex-end;
  flex: 0 0 auto;
}

.harp-preview__frame {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-sm);
  background: var(--zn-bg-surface);
  overflow: auto;
}

.harp-preview__svg {
  width: max-content;
  max-width: 100%;
  transform-origin: top left;
}

.harp-preview__svg :deep(svg) {
  display: block;
  max-width: none;
}

.harp-preview__error {
  padding: var(--zn-space-3);
  color: var(--zn-danger);
  font-family: var(--zn-font-mono);
  font-size: 0.78rem;
  white-space: pre-wrap;
}
</style>
