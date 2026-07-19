<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
}>(), {
  min: 25,
  max: 400,
  step: 10,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function clamp(value: number): number {
  return Math.min(props.max, Math.max(props.min, value))
}

const displayValue = computed(() => clamp(props.modelValue))

function update(value: number): void {
  emit('update:modelValue', clamp(value))
}

function onSliderInput(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }

  update(target.valueAsNumber)
}
</script>

<template>
  <div class="zn-zoom-control">
    <span class="zn-zoom-control__label">Zoom</span>
    <input
      class="zn-zoom-control__slider"
      :max="props.max"
      :min="props.min"
      :step="props.step"
      :value="displayValue"
      aria-label="Zoom"
      type="range"
      @input="onSliderInput"
    >
    <button class="zn-zoom-control__value" type="button" @click="update(100)">
      {{ displayValue }}%
    </button>
  </div>
</template>

<style scoped>
.zn-zoom-control {
  display: inline-flex;
  align-items: center;
  gap: var(--zn-space-2);
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-pill);
  background: var(--zn-bg-surface-soft);
}

.zn-zoom-control__label {
  color: var(--zn-text-soft);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.zn-zoom-control__slider {
  width: 9rem;
  accent-color: var(--zn-accent);
}

.zn-zoom-control__value {
  min-width: 3.75rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--zn-heading);
  text-align: center;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.zn-zoom-control__value:hover {
  color: var(--zn-accent-strong);
}
</style>
