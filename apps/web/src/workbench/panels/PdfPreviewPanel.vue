<script setup lang="ts">
import { ZnButton, ZnPanel, ZnPanelHeader } from '@zupfnoter/design-system'
</script>

<template>
  <ZnPanel>
    <template #header>
      <ZnPanelHeader eyebrow="Output" title="PDF" subtitle="Export-Platzhalter für Druck und Mehrseitenansicht" />
    </template>

    <div class="pdf-preview">
      <div class="pdf-preview__sheet">
        <div class="pdf-preview__line pdf-preview__line--title" />
        <div class="pdf-preview__line" />
        <div class="pdf-preview__line" />
        <div class="pdf-preview__line pdf-preview__line--wide" />
      </div>
      <div class="pdf-preview__actions">
        <ZnButton variant="primary">Export PDF</ZnButton>
        <ZnButton>Page split</ZnButton>
      </div>
    </div>
  </ZnPanel>
</template>

<style scoped>
.pdf-preview {
  display: grid;
  gap: var(--zn-space-4);
}

.pdf-preview__sheet {
  padding: var(--zn-space-4);
  border-radius: var(--zn-radius-sm);
  border: 1px solid var(--zn-border);
  background: var(--zn-bg-surface);
  color: var(--zn-heading);
  box-shadow: var(--zn-shadow-soft);
}

.pdf-preview__line {
  height: 0.6rem;
  margin-bottom: 0.55rem;
  border-radius: 2px;
  background: color-mix(in srgb, var(--zn-heading) 12%, transparent);
}

.pdf-preview__line--title {
  width: 62%;
  height: 1rem;
  margin-bottom: 0.8rem;
  background: color-mix(in srgb, var(--zn-heading) 24%, transparent);
}

.pdf-preview__line--wide {
  width: 88%;
}

.pdf-preview__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--zn-space-2);
}
</style>
