<script setup lang="ts">
import ZnPanel from '../../design-system/components/ZnPanel.vue'

const lyrics = [
  { label: 'Verse 1', text: 'Hands on the strings, eyes on the line.' },
  { label: 'Verse 2', text: 'Repeat markers and flowlines stay in sync.' },
  { label: 'Verse 3', text: 'Voice styles and selection will land later.' },
]
</script>

<template>
  <ZnPanel>
    <div class="lyrics-panel">
      <article v-for="item in lyrics" :key="item.label" class="lyrics-panel__card">
        <h3>{{ item.label }}</h3>
        <p>{{ item.text }}</p>
      </article>
    </div>
  </ZnPanel>
</template>

<style scoped>
.lyrics-panel {
  display: grid;
  gap: var(--zn-space-3);
  min-height: 0;
}

.lyrics-panel__card {
  padding: var(--zn-space-3);
  border-top: 1px solid var(--zn-border);
  border-radius: 0;
  background: transparent;
}

.lyrics-panel__card h3 {
  margin: 0 0 0.25rem;
  color: var(--zn-heading);
  font-size: 0.92rem;
}

.lyrics-panel__card p {
  margin: 0;
  color: var(--zn-text-muted);
  font-size: 0.86rem;
}
</style>
