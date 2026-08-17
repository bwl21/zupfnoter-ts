<script setup lang="ts">
import type { ToolbarFileIconName } from './toolbarFileActions'

defineProps<{
  name: ToolbarFileIconName
}>()
</script>

<template>
  <svg class="toolbar-file-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <template v-if="name === 'file'">
      <path d="M6 3.5h7l5 5V20.5H6zM13 3.5v5h5" />
    </template>
    <template v-else-if="name === 'new'">
      <path d="M6 3.5h7l5 5V20.5H6zM13 3.5v5h5M12 12v5M9.5 14.5h5" />
    </template>
    <template v-else-if="name === 'open'">
      <path d="M3.5 7.5h6l1.7 2h9.3v9.5H3.5zM3.5 7.5V5.5h6l1.7 2" />
    </template>
    <template v-else-if="name === 'save'">
      <path d="M5 3.5h12l2 2v15H5zM8 3.5v6h7v-6M8 20.5v-6h8v6" />
    </template>
    <template v-else-if="name === 'import'">
      <path d="M6 3.5h7l5 5V20.5H6zM13 3.5v5h5M12 17V10M9.5 12.5 12 10l2.5 2.5" />
    </template>
    <template v-else-if="name === 'format'">
      <path d="M6 3.5h7l5 5V20.5H6zM13 3.5v5h5M9 12h6M9 15h6M9 18h4" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M6 3.5h7l5 5V20.5H6zM13 3.5v5h5M12 10v7M9.5 14.5 12 17l2.5-2.5" />
    </template>
    <template v-else-if="name === 'history'">
      <path d="M4 12a8 8 0 1 0 2.35-5.65M4 5v4h4M12 7v5l3 2" />
    </template>
    <template v-else>
      <path d="M4 7h16v10H4zM7 10h4M7 14h7M17 14h.01" />
    </template>
  </svg>
</template>

<style scoped>
.toolbar-file-icon {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex: 0 0 auto;
}
</style>
