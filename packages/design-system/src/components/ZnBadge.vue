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
  color: var(--zn-heading);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.1;
  text-transform: none;
  white-space: nowrap;
}

.zn-badge[data-tone='accent'] {
  background: color-mix(in srgb, var(--zn-accent) 16%, white);
  border-color: color-mix(in srgb, var(--zn-accent) 52%, transparent);
  color: color-mix(in srgb, var(--zn-heading) 82%, var(--zn-accent) 18%);
}

.zn-badge[data-tone='success'] {
  background: color-mix(in srgb, var(--zn-success) 16%, white);
  border-color: color-mix(in srgb, var(--zn-success) 50%, transparent);
  color: color-mix(in srgb, var(--zn-heading) 82%, var(--zn-success) 18%);
}

.zn-badge[data-tone='warning'] {
  background: color-mix(in srgb, var(--zn-warning) 18%, white);
  border-color: color-mix(in srgb, var(--zn-warning) 54%, transparent);
  color: color-mix(in srgb, var(--zn-heading) 82%, var(--zn-warning) 18%);
}

.zn-badge[data-tone='danger'] {
  background: color-mix(in srgb, var(--zn-danger) 16%, white);
  border-color: color-mix(in srgb, var(--zn-danger) 50%, transparent);
  color: color-mix(in srgb, var(--zn-heading) 82%, var(--zn-danger) 18%);
}

.zn-badge[data-tone='info'] {
  background: color-mix(in srgb, var(--zn-info) 16%, white);
  border-color: color-mix(in srgb, var(--zn-info) 50%, transparent);
  color: color-mix(in srgb, var(--zn-heading) 82%, var(--zn-info) 18%);
}
</style>
