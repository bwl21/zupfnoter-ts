<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
}>(), {
  tone: 'neutral',
})
</script>

<template>
  <span class="zn-badge" :data-tone="tone">
    <slot />
  </span>
</template>

<style scoped>
.zn-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.55rem;
  border-radius: var(--zn-radius-pill);
  border: 1px solid var(--zn-border);
  background: var(--zn-bg-surface-soft);
  color: var(--zn-text-soft);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.zn-badge[data-tone='accent'] {
  background: var(--zn-accent-soft);
  border-color: color-mix(in srgb, var(--zn-accent) 45%, transparent);
  color: var(--zn-accent-strong);
}

.zn-badge[data-tone='success'] {
  background: color-mix(in srgb, var(--zn-success) 16%, transparent);
  border-color: color-mix(in srgb, var(--zn-success) 44%, transparent);
  color: var(--zn-success);
}

.zn-badge[data-tone='warning'] {
  background: color-mix(in srgb, var(--zn-warning) 16%, transparent);
  border-color: color-mix(in srgb, var(--zn-warning) 44%, transparent);
  color: var(--zn-warning);
}

.zn-badge[data-tone='danger'] {
  background: color-mix(in srgb, var(--zn-danger) 16%, transparent);
  border-color: color-mix(in srgb, var(--zn-danger) 44%, transparent);
  color: var(--zn-danger);
}

.zn-badge[data-tone='info'] {
  background: color-mix(in srgb, var(--zn-info) 16%, transparent);
  border-color: color-mix(in srgb, var(--zn-info) 44%, transparent);
  color: var(--zn-info);
}
</style>

