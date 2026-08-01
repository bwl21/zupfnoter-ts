<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type Orientation = 'horizontal' | 'vertical'

const props = withDefaults(defineProps<{
  orientation?: Orientation
  primarySize?: number
  minPrimarySize?: number
  maxPrimarySize?: number
  handleSize?: number
  primaryVisible?: boolean
  secondaryVisible?: boolean
}>(), {
  orientation: 'horizontal',
  primarySize: 58,
  minPrimarySize: 8,
  maxPrimarySize: 92,
  handleSize: 10,
  primaryVisible: true,
  secondaryVisible: true,
})

const emit = defineEmits<{
  'update:primarySize': [value: number]
}>()

const root = ref<HTMLElement | null>(null)
const divider = ref<HTMLButtonElement | null>(null)
const dragging = ref(false)

function clampSize(value: number): number {
  return Math.min(props.maxPrimarySize, Math.max(props.minPrimarySize, value))
}

const currentPrimarySize = ref(clampSize(props.primarySize))

watch(
  () => [props.primarySize, props.minPrimarySize, props.maxPrimarySize] as const,
  ([value]) => {
    currentPrimarySize.value = clampSize(value)
  },
)

const splitStyle = computed(() => ({
  '--zn-split-primary': `${currentPrimarySize.value}%`,
  '--zn-split-handle-size': `${props.handleSize}px`,
}))

const showDivider = computed(() => props.primaryVisible && props.secondaryVisible)

function commitSize(nextSize: number): void {
  const clampedSize = clampSize(nextSize)
  currentPrimarySize.value = clampedSize
  emit('update:primarySize', clampedSize)
}

function measurePrimarySize(event: PointerEvent): number {
  const element = root.value
  if (!element) {
    return currentPrimarySize.value
  }

  const rect = element.getBoundingClientRect()
  const size = props.orientation === 'horizontal' ? rect.width : rect.height
  if (size <= 0) {
    return currentPrimarySize.value
  }

  const offset = props.orientation === 'horizontal'
    ? event.clientX - rect.left
    : event.clientY - rect.top

  return (offset / size) * 100
}

function startDragging(event: PointerEvent): void {
  if (event.button !== 0) {
    return
  }

  dragging.value = true
  divider.value?.setPointerCapture(event.pointerId)
  commitSize(measurePrimarySize(event))
}

function stopDragging(event: PointerEvent): void {
  if (!dragging.value) {
    return
  }

  dragging.value = false
  if (divider.value?.hasPointerCapture(event.pointerId)) {
    divider.value.releasePointerCapture(event.pointerId)
  }
}

function stepSize(delta: number): void {
  commitSize(currentPrimarySize.value + delta)
}

function onDividerKeydown(event: KeyboardEvent): void {
  const isHorizontal = props.orientation === 'horizontal'

  if ((isHorizontal && event.key === 'ArrowLeft') || (!isHorizontal && event.key === 'ArrowUp')) {
    event.preventDefault()
    stepSize(-2)
  } else if ((isHorizontal && event.key === 'ArrowRight') || (!isHorizontal && event.key === 'ArrowDown')) {
    event.preventDefault()
    stepSize(2)
  } else if (event.key === 'Home') {
    event.preventDefault()
    commitSize(props.minPrimarySize)
  } else if (event.key === 'End') {
    event.preventDefault()
    commitSize(props.maxPrimarySize)
  }
}

function onDocumentPointerMove(event: PointerEvent): void {
  if (dragging.value) {
    commitSize(measurePrimarySize(event))
  }
}

function onDocumentPointerUp(event: PointerEvent): void {
  stopDragging(event)
}

onMounted(() => {
  document.addEventListener('pointermove', onDocumentPointerMove)
  document.addEventListener('pointerup', onDocumentPointerUp)
  document.addEventListener('pointercancel', onDocumentPointerUp)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointermove', onDocumentPointerMove)
  document.removeEventListener('pointerup', onDocumentPointerUp)
  document.removeEventListener('pointercancel', onDocumentPointerUp)
})
</script>

<template>
  <div
    ref="root"
    class="zn-split-pane"
    :class="[
      `zn-split-pane--${orientation}`,
      {
        'zn-split-pane--single-primary': primaryVisible && !secondaryVisible,
        'zn-split-pane--single-secondary': !primaryVisible && secondaryVisible,
      },
      { 'zn-split-pane--dragging': dragging },
    ]"
    :style="splitStyle"
  >
    <section v-if="primaryVisible" class="zn-split-pane__primary">
      <slot name="primary" />
    </section>

    <button
      v-if="showDivider"
      ref="divider"
      class="zn-split-pane__divider"
      type="button"
      role="separator"
      :aria-label="orientation === 'horizontal' ? 'Spalte anpassen' : 'Zeilen anpassen'"
      :aria-orientation="orientation"
      :aria-valuenow="currentPrimarySize"
      :aria-valuemin="minPrimarySize"
      :aria-valuemax="maxPrimarySize"
      tabindex="0"
      @pointerdown="startDragging"
      @keydown="onDividerKeydown"
    />

    <section v-if="secondaryVisible" class="zn-split-pane__secondary">
      <slot name="secondary" />
    </section>
  </div>
</template>

<style scoped>
.zn-split-pane {
  display: grid;
  position: relative;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.zn-split-pane--horizontal {
  grid-template-columns: minmax(0, var(--zn-split-primary)) minmax(0, 1fr);
}

.zn-split-pane--horizontal.zn-split-pane--single-primary,
.zn-split-pane--horizontal.zn-split-pane--single-secondary {
  grid-template-columns: minmax(0, 1fr);
}

.zn-split-pane--vertical {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, var(--zn-split-primary)) minmax(0, 1fr);
}

.zn-split-pane--vertical.zn-split-pane--single-primary,
.zn-split-pane--vertical.zn-split-pane--single-secondary {
  grid-template-rows: minmax(0, 1fr);
}

.zn-split-pane--vertical > * {
  grid-column: 1;
}

.zn-split-pane__primary,
.zn-split-pane__secondary {
  display: flex;
  flex-direction: column;
  align-self: stretch;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.zn-split-pane__primary > *,
.zn-split-pane__secondary > * {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.zn-split-pane__divider {
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--zn-border-strong);
  cursor: col-resize;
  touch-action: none;
  background-color: transparent;
  transition: background 120ms ease, color 120ms ease;
  position: absolute;
  z-index: 3;
}

.zn-split-pane--horizontal .zn-split-pane__divider {
  background-image: linear-gradient(
    to right,
    transparent calc(100% - 1px),
    var(--zn-border-strong) calc(100% - 1px),
    var(--zn-border-strong) 100%
  );
}

.zn-split-pane--vertical .zn-split-pane__divider {
  background-image: linear-gradient(
    to bottom,
    transparent calc(100% - 1px),
    var(--zn-border-strong) calc(100% - 1px),
    var(--zn-border-strong) 100%
  );
}

.zn-split-pane--horizontal .zn-split-pane__divider:hover,
.zn-split-pane--dragging.zn-split-pane--horizontal .zn-split-pane__divider {
  background-image: linear-gradient(
    to right,
    transparent calc(100% - 2px),
    var(--zn-accent-strong) calc(100% - 2px),
    var(--zn-accent-strong) 100%
  );
}

.zn-split-pane--vertical .zn-split-pane__divider:hover,
.zn-split-pane--dragging.zn-split-pane--vertical .zn-split-pane__divider {
  background-image: linear-gradient(
    to bottom,
    transparent calc(100% - 2px),
    var(--zn-accent-strong) calc(100% - 2px),
    var(--zn-accent-strong) 100%
  );
}

.zn-split-pane__divider:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 70%, white);
  outline-offset: 1px;
}

.zn-split-pane--horizontal .zn-split-pane__divider,
.zn-split-pane--vertical .zn-split-pane__divider {
  align-self: stretch;
  justify-self: stretch;
}

.zn-split-pane--horizontal .zn-split-pane__divider {
  width: var(--zn-split-handle-size);
  height: auto;
  top: 0;
  bottom: 0;
  left: var(--zn-split-primary);
  transform: translateX(-100%);
  cursor: col-resize;
}

.zn-split-pane--vertical .zn-split-pane__divider {
  width: auto;
  min-height: 0;
  height: var(--zn-split-handle-size);
  top: var(--zn-split-primary);
  right: 0;
  bottom: auto;
  left: 0;
  transform: translateY(-100%);
  cursor: row-resize;
}
</style>
