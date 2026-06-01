<script setup lang="ts">
import { ref } from 'vue'

import ZnZoomControl from '../../design-system/components/ZnZoomControl.vue'
import ZnTabs from '../../design-system/components/ZnTabs.vue'
import ZnPanel from '../../design-system/components/ZnPanel.vue'

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
        <span class="harp-preview__string" />
        <span class="harp-preview__string" />
        <span class="harp-preview__string" />
        <span class="harp-preview__string" />
        <span class="harp-preview__column" />
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
}

.harp-preview__frame {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-sm);
  background: var(--zn-bg-surface);
  overflow: hidden;
}

.harp-preview__string {
  position: absolute;
  top: 10%;
  bottom: 10%;
  width: 1px;
  background: color-mix(in srgb, var(--zn-text) 28%, transparent);
}

.harp-preview__string:nth-child(1) { left: 20%; }
.harp-preview__string:nth-child(2) { left: 34%; }
.harp-preview__string:nth-child(3) { left: 48%; }
.harp-preview__string:nth-child(4) { left: 62%; }

.harp-preview__column {
  position: absolute;
  inset: 18% 72% 18% 12%;
  border-radius: 999px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--zn-accent) 18%, transparent), color-mix(in srgb, var(--zn-accent) 5%, transparent));
}
</style>
