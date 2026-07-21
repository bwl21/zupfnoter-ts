<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'

import { ZnBadge, ZnButton, ZnStatusBar } from '@zupfnoter/design-system'

const props = withDefaults(defineProps<{
  extractLabel: string
  storageLocation: string
  storageReadOnly: boolean
  dirty: boolean
  saveFormat: string
  speedFactor: number
  cursorPosition: string
  cursorUnicode?: string
  selectionVoiceScope: 'single-voice' | 'extract-voices' | 'all-voices'
  selectionVoiceScopeSummary: string
}>(), {})

const emit = defineEmits<{
  (event: 'speed-up'): void
  (event: 'speed-down'): void
  (event: 'speed-reset'): void
  (event: 'storage-connections'): void
  (event: 'selection-voice-scope-change', value: 'single-voice' | 'extract-voices' | 'all-voices'): void
}>()

const speedLabel = computed(() => `${props.speedFactor.toFixed(1)}x`)
const storageChipElement = ref<HTMLElement | null>(null)
let storageChipTooltip: TippyInstance | undefined

onMounted(() => {
  if (storageChipElement.value === null) return
  storageChipTooltip = tippy(storageChipElement.value, {
    content: 'Speicherverbindungen verwalten',
    animation: 'shift-away',
    delay: [180, 0],
    duration: [90, 60],
    placement: 'top',
  })
})

onBeforeUnmount(() => {
  storageChipTooltip?.destroy()
})

function handleSelectionVoiceScopeChange(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) return
  if (
    target.value !== 'single-voice'
    && target.value !== 'extract-voices'
    && target.value !== 'all-voices'
  ) {
    return
  }
  emit('selection-voice-scope-change', target.value)
}
</script>

<template>
  <ZnStatusBar>
    <span class="footer-bar__meta footer-bar__cursor">
      {{ cursorPosition }}
      <span class="footer-bar__unicode">{{ cursorUnicode ?? '—' }}</span>
    </span>
    <ZnBadge tone="accent">
      {{ extractLabel }}
    </ZnBadge>
    <ZnBadge :tone="dirty ? 'warning' : 'success'">
      {{ dirty ? 'Unsaved changes' : 'Saved' }}
    </ZnBadge>
    <ZnBadge tone="info">
      {{ saveFormat }}
    </ZnBadge>
    <button
      ref="storageChipElement"
      class="footer-bar__storage-chip"
      :class="storageReadOnly ? 'footer-bar__storage-chip--read-only' : 'footer-bar__storage-chip--writable'"
      type="button"
      @click="emit('storage-connections')"
    >
      {{ storageLocation }}
    </button>
    <template #aside>
      <div class="footer-bar__selection">
        <span class="footer-bar__meta">Selection:</span>
        <label
          class="footer-bar__scope-field"
          :title="selectionVoiceScopeSummary"
        >
          <select
            class="footer-bar__scope-select"
            :value="selectionVoiceScope"
            @change="handleSelectionVoiceScopeChange"
          >
            <option value="single-voice">Stimme</option>
            <option value="extract-voices">Auszug</option>
            <option value="all-voices">Alle</option>
          </select>
        </label>
      </div>
      <div class="footer-bar__playback">
        <span class="footer-bar__meta">Playback:</span>
        <ZnButton class="footer-bar__speed-button" variant="ghost" @click="emit('speed-down')">
          -
        </ZnButton>
        <button class="footer-bar__speed-value" type="button" @click="emit('speed-reset')">
          {{ speedLabel }}
        </button>
        <ZnButton class="footer-bar__speed-button" variant="ghost" @click="emit('speed-up')">
          +
        </ZnButton>
      </div>
    </template>
  </ZnStatusBar>
</template>

<style scoped>
.footer-bar__meta {
  color: var(--zn-text-muted);
  font-size: 0.82rem;
}

.footer-bar__cursor {
  display: inline-flex;
  align-items: baseline;
  gap: 0.45rem;
  min-width: 11ch;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

.footer-bar__unicode {
  color: var(--zn-text-muted);
  font-family: var(--zn-font-mono, monospace);
  font-size: 0.9em;
}

.footer-bar__storage-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-pill);
  background: var(--zn-bg-surface-soft);
  color: var(--zn-heading);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.1;
  cursor: pointer;
}

.footer-bar__storage-chip:hover {
  border-color: var(--zn-border-strong);
  background: var(--zn-bg-surface);
}

.footer-bar__storage-chip--writable {
  background: color-mix(in srgb, var(--zn-success) 16%, white);
  border-color: color-mix(in srgb, var(--zn-success) 50%, transparent);
  color: color-mix(in srgb, var(--zn-heading) 82%, var(--zn-success) 18%);
}

.footer-bar__storage-chip--read-only {
  background: color-mix(in srgb, var(--zn-danger) 14%, white);
  border-color: color-mix(in srgb, var(--zn-danger) 42%, transparent);
  color: color-mix(in srgb, var(--zn-heading) 82%, var(--zn-danger) 18%);
}

.footer-bar__storage-chip:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 65%, white);
  outline-offset: 2px;
}

.footer-bar__playback {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.footer-bar__selection {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-inline-end: 0.75rem;
}

.footer-bar__scope-field {
  display: inline-flex;
  align-items: center;
}

.footer-bar__scope-select {
  min-width: 5.5rem;
  min-height: 2.1rem;
  padding: 0.35rem 1.9rem 0.35rem 0.75rem;
  border: 1px solid var(--zn-border);
  border-radius: 999px;
  background: var(--zn-bg-surface);
  color: var(--zn-text);
  font: inherit;
  cursor: pointer;
  appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--zn-text-soft) 50%),
    linear-gradient(135deg, var(--zn-text-soft) 50%, transparent 50%);
  background-position:
    calc(100% - 1rem) calc(50% - 0.12rem),
    calc(100% - 0.72rem) calc(50% - 0.12rem);
  background-size: 0.4rem 0.4rem, 0.4rem 0.4rem;
  background-repeat: no-repeat;
}

.footer-bar__scope-select:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 65%, white);
  outline-offset: 2px;
}

.footer-bar__speed-button,
.footer-bar__speed-value {
  min-width: 2.4rem;
  padding-inline: 0.4rem;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

.footer-bar__speed-value {
  border: 1px solid var(--zn-border);
  background: var(--zn-bg-surface);
  color: var(--zn-text);
  font: inherit;
  cursor: pointer;
}
</style>
