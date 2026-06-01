<script setup lang="ts">
import ZnBadge from '../../design-system/components/ZnBadge.vue'
import ZnPanel from '../../design-system/components/ZnPanel.vue'
import ZnPanelHeader from '../../design-system/components/ZnPanelHeader.vue'

const lines = [
  '[ok] ABC parsed',
  '[ok] Song built',
  '[warn] SVG parity still diverges on 15 fixtures',
  '[info] Footer normalized in report comparison',
]
</script>

<template>
  <ZnPanel tone="sunken">
    <template #header>
      <ZnPanelHeader eyebrow="Debug" title="Console" subtitle="Protokoll und Statusmeldungen der Workbench" />
    </template>

    <div class="console-panel">
      <div class="console-panel__header">
        <ZnBadge tone="success">ready</ZnBadge>
      </div>
      <pre class="console-panel__log"><code><span v-for="line in lines" :key="line">{{ line }}<br></span></code></pre>
    </div>
  </ZnPanel>
</template>

<style scoped>
.console-panel {
  display: grid;
  gap: var(--zn-space-3);
}

.console-panel__header {
  display: flex;
  justify-content: flex-end;
}

.console-panel__log {
  margin: 0;
  padding: var(--zn-space-3);
  border-radius: var(--zn-radius-sm);
  border: 1px solid var(--zn-border);
  background: var(--zn-bg-surface);
  color: var(--zn-text);
  font-family: var(--zn-font-mono);
  font-size: 0.82rem;
  line-height: 1.55;
  overflow: auto;
}
</style>
