<script setup lang="ts">
import ZnPanel from '../../design-system/components/ZnPanel.vue'
</script>

<template>
  <ZnPanel tone="surface">
    <div class="preview-stage">
      <div class="preview-stage__controls">
        <input aria-label="enter chord" class="preview-stage__input" placeholder="enter chord" type="text">
        <input aria-label="enter notes" class="preview-stage__input preview-stage__input--wide" placeholder="enter notes" type="text">
      </div>
      <div class="preview-stage__frame">
        <div class="preview-stage__staff preview-stage__staff--top" />
        <div class="preview-stage__staff preview-stage__staff--mid" />
        <div class="preview-stage__staff preview-stage__staff--bottom" />
        <div class="preview-stage__note" />
        <div class="preview-stage__note preview-stage__note--second" />
        <div class="preview-stage__bridge" />
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
  padding: var(--zn-space-4);
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-sm);
  background: var(--zn-bg-surface);
  overflow: hidden;
}

.preview-stage__staff {
  position: absolute;
  left: 6%;
  right: 6%;
  height: 1px;
  background: color-mix(in srgb, var(--zn-text) 52%, transparent);
}

.preview-stage__staff--top {
  top: 30%;
}

.preview-stage__staff--mid {
  top: 46%;
}

.preview-stage__staff--bottom {
  top: 62%;
}

.preview-stage__note,
.preview-stage__note--second {
  position: absolute;
  top: 46%;
  width: 1rem;
  height: 1rem;
  border: 1px solid var(--zn-heading);
  border-radius: 50%;
  background: var(--zn-heading);
  box-shadow: none;
}

.preview-stage__note {
  left: 24%;
}

.preview-stage__note--second {
  left: 58%;
}

.preview-stage__bridge {
  position: absolute;
  top: 44%;
  left: 24%;
  width: 35%;
  height: 0.3rem;
  border-top: 2px solid var(--zn-text);
  border-radius: 999px;
  transform: skewX(-12deg);
}
</style>
