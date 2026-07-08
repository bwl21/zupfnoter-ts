<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
}>(), {
  variant: 'secondary',
  disabled: false,
})

defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <button
    class="zn-icon-button"
    :class="`zn-icon-button--${props.variant}`"
    type="button"
    :aria-label="props.label"
    :title="props.label"
    :disabled="props.disabled"
    @click="$emit('click', $event)"
  >
    <span class="zn-icon-button__icon" aria-hidden="true">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.zn-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  padding: 0;
  border-radius: var(--zn-radius-md);
  border: 1px solid transparent;
  background: var(--zn-bg-surface);
  color: var(--zn-text);
  box-shadow: var(--zn-shadow-soft);
  transition:
    transform 140ms ease,
    border-color 140ms ease,
    background-color 140ms ease;
  cursor: pointer;
}

.zn-icon-button:hover {
  transform: translateY(-1px);
  border-color: var(--zn-border-strong);
}

.zn-icon-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.zn-icon-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 65%, white);
  outline-offset: 2px;
}

.zn-icon-button--ghost {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  color: var(--zn-text-muted);
}

.zn-icon-button--ghost:hover {
  background: var(--zn-bg-surface-soft);
}

.zn-icon-button--primary {
  background: linear-gradient(180deg, color-mix(in srgb, var(--zn-accent) 88%, white), var(--zn-accent));
  color: var(--zn-heading);
}
</style>
