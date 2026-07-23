<script setup lang="ts">
const props = withDefaults(defineProps<{
  maximized?: boolean
  maximizeLabel?: string
  restoreLabel?: string
}>(), {
  maximized: false,
  maximizeLabel: 'Panel maximieren',
  restoreLabel: 'Panel wiederherstellen',
})

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <button
    class="zn-maximize-button"
    type="button"
    :aria-label="props.maximized ? props.restoreLabel : props.maximizeLabel"
    :title="props.maximized ? props.restoreLabel : props.maximizeLabel"
    :aria-pressed="props.maximized"
    @click="emit('toggle')"
  >
    <span aria-hidden="true">{{ props.maximized ? '↙' : '⛶' }}</span>
  </button>
</template>

<style scoped>
.zn-maximize-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--zn-radius-md);
  background: transparent;
  color: var(--zn-text-muted);
  cursor: pointer;
  font-size: 1.15rem;
  line-height: 1;
}

.zn-maximize-button:hover {
  border-color: var(--zn-border);
  background: var(--zn-bg-surface-soft);
}

.zn-maximize-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 65%, white);
  outline-offset: 2px;
}
</style>
