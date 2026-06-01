<script setup lang="ts">
import ZnBadge from '../../design-system/components/ZnBadge.vue'
import ZnPanel from '../../design-system/components/ZnPanel.vue'

const rows = [
  ['layout.X_SPACING', '11.5'],
  ['layout.Y_SCALE', '4'],
  ['extract.0.voices', '[1]'],
  ['printer.pageFormat', 'A4'],
]
</script>

<template>
  <ZnPanel>
    <div class="config-panel">
      <ZnBadge tone="warning">JSON</ZnBadge>
      <table class="config-panel__table">
        <tbody>
          <tr v-for="[key, value] in rows" :key="key">
            <th>{{ key }}</th>
            <td>{{ value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </ZnPanel>
</template>

<style scoped>
.config-panel {
  display: grid;
  gap: var(--zn-space-3);
  min-height: 0;
}

.config-panel__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.config-panel__table th,
.config-panel__table td {
  padding: 0.5rem 0.45rem;
  border-bottom: 1px solid color-mix(in srgb, var(--zn-border) 70%, transparent);
  text-align: left;
  vertical-align: top;
}

.config-panel__table th {
  width: 55%;
  color: var(--zn-text-soft);
  font-family: var(--zn-font-mono);
  font-weight: 600;
}

.config-panel__table td {
  color: var(--zn-text-muted);
  font-family: var(--zn-font-mono);
}
</style>
