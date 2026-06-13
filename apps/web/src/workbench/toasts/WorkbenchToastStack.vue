<script setup lang="ts">
import { ZnIconButton, ZnProblemMarker } from '../../design-system/index'
import type { WorkbenchToast } from './useWorkbenchToasts'

defineProps<{
  toasts: WorkbenchToast[]
}>()

defineEmits<{
  dismiss: [id: number]
}>()
</script>

<template>
  <aside class="workbench-toast-stack" aria-live="polite" aria-atomic="true">
    <article
      v-for="toast in toasts"
      :key="toast.id"
      class="workbench-toast"
      :data-severity="toast.severity"
    >
      <div class="workbench-toast__header">
        <ZnProblemMarker :severity="toast.severity === 'danger' ? 'danger' : toast.severity === 'warning' ? 'warning' : 'info'">
          {{ toast.title }}
        </ZnProblemMarker>

        <ZnIconButton
          label="Meldung schließen"
          variant="ghost"
          @click="$emit('dismiss', toast.id)"
        >
          ×
        </ZnIconButton>
      </div>

      <p class="workbench-toast__message">
        {{ toast.message }}
      </p>
    </article>
  </aside>
</template>

<style scoped>
.workbench-toast-stack {
  position: fixed;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 90;
  display: grid;
  gap: 0.6rem;
  width: min(26rem, calc(100vw - 1.5rem));
  pointer-events: none;
}

.workbench-toast {
  pointer-events: auto;
  display: grid;
  gap: 0.55rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-md);
  background: color-mix(in srgb, var(--zn-bg-surface) 94%, white);
  box-shadow: var(--zn-shadow-soft);
  backdrop-filter: blur(6px);
}

.workbench-toast[data-severity='danger'] {
  border-color: color-mix(in srgb, var(--zn-danger) 35%, var(--zn-border));
}

.workbench-toast[data-severity='warning'] {
  border-color: color-mix(in srgb, var(--zn-warning) 35%, var(--zn-border));
}

.workbench-toast__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.workbench-toast__message {
  margin: 0;
  color: var(--zn-text-soft);
  white-space: pre-wrap;
  line-height: 1.45;
}
</style>
