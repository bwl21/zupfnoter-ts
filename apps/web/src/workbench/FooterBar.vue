<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'

import { ZnBadge, ZnButton, ZnIcon, ZnStatusBar } from '@zupfnoter/design-system'

const props = withDefaults(defineProps<{
  extractLabel: string
  storageLocation: string
  storageReadOnly: boolean
  dirty: boolean
  saveFormat: string
  speedBpm: number
  metronomeMode: 'off' | 'countIn' | 'playback' | 'always'
  configuredMetronomeMode?: 'off' | 'countIn' | 'playback' | 'always'
  cursorPosition: string
  cursorUnicode?: string
  configHover?: string
  selectionVoiceScope: 'single-voice' | 'extract-voices' | 'all-voices'
  selectionVoiceScopeSummary: string
}>(), {})

const emit = defineEmits<{
  (event: 'speed-up'): void
  (event: 'speed-down'): void
  (event: 'speed-change', value: number): void
  (event: 'metronome-mode-change', value: 'off' | 'countIn' | 'playback' | 'always'): void
  (event: 'playback-config'): void
  (event: 'storage-connections'): void
  (event: 'selection-voice-scope-change', value: 'single-voice' | 'extract-voices' | 'all-voices'): void
}>()

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

function handleMetronomeModeChange(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) return
  if (target.value !== 'off'
    && target.value !== 'countIn'
    && target.value !== 'playback'
    && target.value !== 'always') return
  emit('metronome-mode-change', target.value)
}

function handleSpeedChange(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const value = Number(target.value)
  if (!Number.isFinite(value) || value <= 0) {
    target.value = String(props.speedBpm)
    return
  }
  emit('speed-change', Math.round(value))
}

function metronomeOptionLabel(
  mode: 'off' | 'countIn' | 'playback' | 'always',
  label: string,
): string {
  return props.configuredMetronomeMode === mode ? `${label} (Blattvorgabe)` : label
}
</script>

<template>
  <ZnStatusBar>
    <span class="footer-bar__meta footer-bar__cursor">
      {{ cursorPosition }}
      <span class="footer-bar__unicode">{{ cursorUnicode ?? '—' }}</span>
    </span>
    <span
      v-if="configHover !== undefined"
      class="footer-bar__meta footer-bar__config-hover"
      :title="configHover"
    >
      {{ configHover }}
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
        <span class="footer-bar__meta">Metronom:</span>
        <label class="footer-bar__metronome-field">
          <select
            class="footer-bar__metronome-select"
            :value="metronomeMode"
            aria-label="Metronom-Modus"
            @change="handleMetronomeModeChange"
          >
            <option value="off">{{ metronomeOptionLabel('off', 'Aus') }}</option>
            <option value="countIn">{{ metronomeOptionLabel('countIn', 'Einzählen') }}</option>
            <option value="playback">{{ metronomeOptionLabel('playback', 'Während der Wiedergabe') }}</option>
            <option value="always">{{ metronomeOptionLabel('always', 'Immer') }}</option>
          </select>
        </label>
        <button
          class="footer-bar__playback-config"
          type="button"
          title="Wiedergabe für diesen Auszug konfigurieren"
          aria-label="Wiedergabe konfigurieren"
          @click="emit('playback-config')"
        >
          <ZnIcon name="settings" />
        </button>
        <span class="footer-bar__speed-label">BPM:</span>
        <ZnButton class="footer-bar__speed-button" variant="ghost" @click="emit('speed-down')">
          -
        </ZnButton>
        <input
          class="footer-bar__speed-value"
          type="number"
          min="1"
          step="5"
          inputmode="numeric"
          aria-label="Wiedergabegeschwindigkeit in BPM"
          :value="speedBpm"
          @change="handleSpeedChange"
          @wheel.prevent
        >
        <ZnButton class="footer-bar__speed-button" variant="ghost" @click="emit('speed-up')">
          +
        </ZnButton>
      </div>
    </template>
  </ZnStatusBar>
</template>

<style scoped>
:deep(.zn-status-bar) {
  position: relative;
}

:deep(.zn-badge),
.footer-bar__storage-chip {
  box-sizing: border-box;
  height: 1.55rem;
  min-height: 1.55rem;
}

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

.footer-bar__config-hover {
  position: absolute;
  left: 0.75rem;
  bottom: calc(100% + 0.35rem);
  z-index: 2;
  max-width: min(48rem, calc(100% - 1.5rem));
  overflow: hidden;
  padding: 0.35rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--zn-accent) 32%, var(--zn-border));
  border-radius: var(--zn-radius-pill);
  background: color-mix(in srgb, var(--zn-bg-elevated) 96%, transparent);
  box-shadow: var(--zn-shadow-soft);
  color: var(--zn-text-soft);
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
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
  gap: 0.5rem;
}

.footer-bar__selection {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-inline-end: 1rem;
}

.footer-bar__scope-field {
  display: inline-flex;
  align-items: center;
}

.footer-bar__scope-select,
.footer-bar__metronome-select {
  min-width: 5.5rem;
  height: 1.55rem;
  min-height: 1.55rem;
  padding: 0.15rem 1.9rem 0.15rem 0.65rem;
  border: 1px solid var(--zn-border);
  border-radius: 999px;
  background: var(--zn-bg-surface);
  color: var(--zn-text);
  font: inherit;
  font-size: 0.78rem;
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

.footer-bar__scope-select:focus-visible,
.footer-bar__metronome-select:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 65%, white);
  outline-offset: 2px;
}

.footer-bar__speed-button,
.footer-bar__speed-value,
.footer-bar__playback-config {
  min-width: 1.8rem;
  height: 1.55rem;
  min-height: 1.55rem;
  padding-inline: 0.4rem;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

.footer-bar__playback-config {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--zn-border);
  background: var(--zn-bg-surface);
  color: var(--zn-text);
  font: inherit;
  cursor: pointer;
}

.footer-bar__metronome-field {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.footer-bar__metronome-select {
  min-width: 9.2rem;
}

.footer-bar__speed-label {
  margin-inline-start: 0.15rem;
  color: var(--zn-text-muted);
  font-size: 0.75rem;
}

.footer-bar__speed-value {
  width: 4.5rem;
  border: 1px solid var(--zn-border);
  background: var(--zn-bg-surface);
  color: var(--zn-text);
  font: inherit;
  text-align: center;
}

:deep(.footer-bar__speed-button.zn-button) {
  height: 1.55rem;
  min-height: 1.55rem;
  padding: 0 0.4rem;
}
</style>
