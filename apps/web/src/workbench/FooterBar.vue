<script setup lang="ts">
import ZnBadge from '../design-system/components/ZnBadge.vue'
import ZnStatusBar from '../design-system/components/ZnStatusBar.vue'

withDefaults(defineProps<{
  extractLabel: string
  storagePath: string
  dirty: boolean
  saveFormat: string
  speed: string
  cursorPosition: string
}>(), {})
</script>

<template>
  <ZnStatusBar>
    <span class="footer-bar__meta footer-bar__cursor">{{ cursorPosition }}</span>
    <ZnBadge tone="accent">
      {{ extractLabel }}
    </ZnBadge>
    <ZnBadge :tone="dirty ? 'warning' : 'success'">
      {{ dirty ? 'Unsaved changes' : 'Saved' }}
    </ZnBadge>
    <ZnBadge tone="info">
      {{ saveFormat }}
    </ZnBadge>
    <span class="footer-bar__meta">Storage: {{ storagePath }}</span>
    <template #aside>
      <span class="footer-bar__meta">Playback: {{ speed }}</span>
    </template>
  </ZnStatusBar>
</template>

<style scoped>
.footer-bar__meta {
  color: var(--zn-text-muted);
  font-size: 0.82rem;
}

.footer-bar__cursor {
  min-width: 5ch;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}
</style>
