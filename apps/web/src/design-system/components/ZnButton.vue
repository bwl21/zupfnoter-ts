<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}>(), {
  variant: 'secondary',
  type: 'button',
  disabled: false,
})

defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <button
    class="zn-button"
    :class="`zn-button--${props.variant}`"
    :type="props.type"
    :disabled="props.disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped>
.zn-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.1rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid transparent;
  border-radius: var(--zn-radius-md);
  background: var(--zn-bg-surface);
  color: var(--zn-text);
  box-shadow: var(--zn-shadow-soft);
  transition:
    transform 140ms ease,
    border-color 140ms ease,
    background-color 140ms ease,
    color 140ms ease;
  cursor: pointer;
}

.zn-button:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: var(--zn-border-strong);
}

.zn-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 65%, white);
  outline-offset: 2px;
}

.zn-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  box-shadow: none;
}

.zn-button--primary {
  background: linear-gradient(180deg, color-mix(in srgb, var(--zn-accent) 16%, white), color-mix(in srgb, var(--zn-accent) 8%, white));
  border-color: color-mix(in srgb, var(--zn-accent) 40%, var(--zn-border));
  color: var(--zn-accent-strong);
}

.zn-button--primary:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--zn-accent) 65%, var(--zn-border));
}

.zn-button--secondary {
  background: var(--zn-bg-surface);
  border-color: var(--zn-border);
}

.zn-button--ghost {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  color: var(--zn-text-soft);
}

.zn-button--ghost:hover:not(:disabled) {
  background: var(--zn-bg-surface-soft);
  border-color: var(--zn-border);
}

.zn-button--danger {
  background: color-mix(in srgb, var(--zn-danger) 10%, var(--zn-bg-surface));
  border-color: color-mix(in srgb, var(--zn-danger) 32%, transparent);
  color: var(--zn-danger);
}
</style>
