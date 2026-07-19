<script setup lang="ts">
withDefaults(defineProps<{
  severity?: 'info' | 'warning' | 'danger' | 'success'
}>(), {
  severity: 'warning',
})
</script>

<template>
  <span class="zn-problem-marker" :data-severity="severity">
    <span class="zn-problem-marker__dot" aria-hidden="true" />
    <slot />
  </span>
</template>

<style scoped>
.zn-problem-marker {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-pill);
  background: var(--zn-bg-surface-soft);
  color: var(--zn-text-soft);
  font-size: 0.82rem;
}

.zn-problem-marker__dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--zn-warning);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--zn-warning) 18%, transparent);
}

.zn-problem-marker[data-severity='info'] .zn-problem-marker__dot {
  background: var(--zn-info);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--zn-info) 18%, transparent);
}

.zn-problem-marker[data-severity='warning'] .zn-problem-marker__dot {
  background: var(--zn-warning);
}

.zn-problem-marker[data-severity='danger'] .zn-problem-marker__dot {
  background: var(--zn-danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--zn-danger) 18%, transparent);
}

.zn-problem-marker[data-severity='success'] .zn-problem-marker__dot {
  background: var(--zn-success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--zn-success) 18%, transparent);
}
</style>

