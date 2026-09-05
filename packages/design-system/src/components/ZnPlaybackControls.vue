<script setup lang="ts">
import type { PlaybackMetronomeMode } from '@zupfnoter/types'

import ZnButton from './ZnButton.vue'
import ZnIcon from './ZnIcon.vue'

const props = withDefaults(
  defineProps<{
    speedBpm: number
    metronomeMode: PlaybackMetronomeMode
    configuredMetronomeMode?: PlaybackMetronomeMode
    showConfig?: boolean
  }>(),
  { showConfig: true },
)

const emit = defineEmits<{
  (event: 'speed-up'): void
  (event: 'speed-down'): void
  (event: 'speed-change', value: number): void
  (event: 'metronome-mode-change', value: PlaybackMetronomeMode): void
  (event: 'playback-config'): void
}>()

function handleMetronomeModeChange(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) return
  if (
    target.value !== 'off' &&
    target.value !== 'countIn' &&
    target.value !== 'playback' &&
    target.value !== 'always'
  )
    return
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

function metronomeOptionLabel(mode: PlaybackMetronomeMode, label: string): string {
  return props.configuredMetronomeMode === mode ? `${label} (Blattvorgabe)` : label
}
</script>

<template>
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
        <option value="playback">
          {{ metronomeOptionLabel('playback', 'Während der Wiedergabe') }}
        </option>
        <option value="always">{{ metronomeOptionLabel('always', 'Immer') }}</option>
      </select>
    </label>
    <button
      v-if="showConfig"
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
      −
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
    />
    <ZnButton class="footer-bar__speed-button" variant="ghost" @click="emit('speed-up')">
      +
    </ZnButton>
  </div>
</template>

<style scoped>
.footer-bar__playback {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.footer-bar__meta,
.footer-bar__speed-label {
  color: var(--zn-text-muted);
  font-size: 0.75rem;
}

.footer-bar__metronome-field {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.footer-bar__metronome-select {
  min-width: 9.2rem;
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
  background-image: linear-gradient(45deg, transparent 50%, var(--zn-text-soft) 50%),
    linear-gradient(135deg, var(--zn-text-soft) 50%, transparent 50%);
  background-position:
    calc(100% - 1rem) calc(50% - 0.12rem),
    calc(100% - 0.72rem) calc(50% - 0.12rem);
  background-size: 0.4rem 0.4rem;
  background-repeat: no-repeat;
}

.footer-bar__metronome-select:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 65%, white);
  outline-offset: 2px;
}

.footer-bar__speed-button,
.footer-bar__speed-value,
.footer-bar__playback-config {
  box-sizing: border-box;
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

@media (max-width: 32rem) {
  .footer-bar__playback {
    gap: 0.35rem;
  }

  .footer-bar__meta {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  .footer-bar__metronome-select {
    min-width: 7.2rem;
  }

  .footer-bar__speed-value {
    width: 3.7rem;
  }
}

@media (orientation: landscape) and (max-height: 32rem) {
  .footer-bar__playback {
    gap: 0.35rem;
  }

  .footer-bar__meta,
  .footer-bar__speed-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  .footer-bar__metronome-select {
    min-width: 7.2rem;
  }

  .footer-bar__speed-value {
    width: 3.7rem;
  }
}
</style>
