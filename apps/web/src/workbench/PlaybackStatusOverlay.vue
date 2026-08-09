<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  measureNumber: number
  partName?: string
  passIndex: number
  metronomeBeat?: {
    beat: number
    division: number
    accent: boolean
    pulse: number
  }
}>()

const trimmedPartName = computed(() => props.partName?.trim() || undefined)
const partCharacters = computed(() => Array.from(trimmedPartName.value ?? ''))
const shortenedPartName = computed(() => partCharacters.value.length > 18)
const partStart = computed(() => shortenedPartName.value
  ? partCharacters.value.slice(0, 9).join('')
  : trimmedPartName.value)
const partEnd = computed(() => shortenedPartName.value
  ? partCharacters.value.slice(-9).join('')
  : undefined)
const accessibleLabel = computed(() => [
  ...(trimmedPartName.value === undefined ? [] : [`Abschnitt ${trimmedPartName.value}`]),
  `Takt ${props.measureNumber}`,
  `Durchlauf ${props.passIndex}`,
].join(' · '))
</script>

<template>
  <div
    class="playback-status-overlay"
    :aria-label="accessibleLabel"
    aria-live="polite"
  >
    <span class="playback-status-overlay__position">
      <span class="playback-status-overlay__label" aria-hidden="true">
        {{ trimmedPartName === undefined ? 'Takt · Durchlauf' : 'Abschnitt · Takt · Durchlauf' }}
      </span>
      <span class="playback-status-overlay__values">
        <span
          v-if="trimmedPartName !== undefined"
          class="playback-status-overlay__part"
          :title="trimmedPartName"
          aria-hidden="true"
        >
          <span class="playback-status-overlay__part-start">{{ partStart }}</span>
          <template v-if="partEnd !== undefined">
            <span class="playback-status-overlay__part-ellipsis">…</span>
            <span class="playback-status-overlay__part-end">{{ partEnd }}</span>
          </template>
        </span>
        <span v-if="trimmedPartName !== undefined" class="playback-status-overlay__separator" aria-hidden="true">·</span>
        <span class="playback-status-overlay__measure" aria-hidden="true">| {{ measureNumber }} |</span>
        <span class="playback-status-overlay__separator" aria-hidden="true">·</span>
        <span class="playback-status-overlay__pass" aria-hidden="true">#{{ passIndex }}</span>
      </span>
    </span>
    <span
      v-if="metronomeBeat !== undefined"
      :key="metronomeBeat.pulse"
      class="playback-status-overlay__metronome"
      :aria-label="`Metronom: Schlag ${metronomeBeat.beat} von ${metronomeBeat.division}`"
    >
      <span
        v-for="beat in metronomeBeat.division"
        :key="beat"
        class="playback-status-overlay__beat"
        :class="{
          'playback-status-overlay__beat--active': beat === metronomeBeat.beat,
          'playback-status-overlay__beat--accent': beat === metronomeBeat.beat && metronomeBeat.accent,
        }"
        aria-hidden="true"
      />
    </span>
  </div>
</template>

<style scoped>
.playback-status-overlay {
  position: absolute;
  left: 50%;
  bottom: calc(100% - 0.5rem);
  transform: translateX(-50%);
  z-index: 2;
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--zn-accent) 26%, var(--zn-border));
  border-radius: 999px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--zn-accent) 14%, var(--zn-bg-elevated)) 0%, var(--zn-bg-elevated) 100%);
  box-shadow:
    0 10px 22px color-mix(in srgb, var(--zn-accent) 18%, transparent),
    0 2px 6px rgb(15 23 42 / 0.16);
  color: var(--zn-text);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  pointer-events: none;
  white-space: nowrap;
  max-width: min(34rem, calc(100vw - 2rem));
}

.playback-status-overlay__position {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.playback-status-overlay__label {
  color: var(--zn-text-muted);
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: normal;
}

.playback-status-overlay__values {
  display: flex;
  min-width: 0;
  align-items: baseline;
}

.playback-status-overlay__part {
  display: inline-flex;
  min-width: 0;
  overflow: hidden;
}

.playback-status-overlay__part-start,
.playback-status-overlay__part-end {
  min-width: 0;
  overflow: hidden;
}

.playback-status-overlay__part-start {
  text-align: start;
}

.playback-status-overlay__part-end {
  text-align: end;
}

.playback-status-overlay__part-ellipsis {
  flex: 0 0 auto;
}

.playback-status-overlay__measure,
.playback-status-overlay__pass {
  flex: 0 0 auto;
  min-width: 4ch;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.playback-status-overlay__separator {
  flex: 0 0 auto;
  margin-inline: 0.35rem;
  color: var(--zn-text-soft);
}

.playback-status-overlay__metronome {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  margin-inline-start: 0.65rem;
  padding-inline-start: 0.65rem;
  border-inline-start: 1px solid color-mix(in srgb, var(--zn-accent) 25%, var(--zn-border));
}

.playback-status-overlay__beat {
  width: 0.44rem;
  height: 0.44rem;
  border-radius: 50%;
  background: var(--zn-border-strong);
}

.playback-status-overlay__beat--active {
  background: var(--zn-accent);
  box-shadow: 0 0 0.35rem color-mix(in srgb, var(--zn-accent) 60%, transparent);
  animation: playback-metronome-pulse 180ms ease-out;
}

.playback-status-overlay__beat--accent {
  background: var(--zn-warning);
}

@keyframes playback-metronome-pulse {
  from { transform: scale(1.45); }
  to { transform: scale(1); }
}
</style>
