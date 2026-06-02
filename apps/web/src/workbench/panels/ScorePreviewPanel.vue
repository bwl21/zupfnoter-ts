<script setup lang="ts">
import ZnPanel from '../../design-system/components/ZnPanel.vue'

defineProps<{
  svg: string
  errorMessage?: string
}>()
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
        <div v-else class="preview-stage__svg" v-html="svg" />
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

.preview-stage__error {
  color: var(--zn-danger);
  font-family: var(--zn-font-mono);
  font-size: 0.78rem;
  white-space: pre-wrap;
}
</style>
