<script setup lang="ts">
import { computed } from 'vue'

import ZnBadge from '../design-system/components/ZnBadge.vue'
import ZnButton from '../design-system/components/ZnButton.vue'
import ZnStatusBar from '../design-system/components/ZnStatusBar.vue'

const props = withDefaults(defineProps<{
  extractLabel: string
  storagePath: string
  dirty: boolean
  saveFormat: string
  speedFactor: number
  cursorPosition: string
  selectionVoiceScope: 'single-voice' | 'extract-voices' | 'all-voices'
  selectionVoiceScopeSummary: string
}>(), {})

const emit = defineEmits<{
  (event: 'speed-up'): void
  (event: 'speed-down'): void
  (event: 'speed-reset'): void
  (event: 'selection-voice-scope-change', value: 'single-voice' | 'extract-voices' | 'all-voices'): void
}>()

const speedLabel = computed(() => `${props.speedFactor.toFixed(1)}x`)
const selectionScopeLabel = computed(() => {
  if (props.selectionVoiceScope === 'single-voice') return 'Stimme'
  if (props.selectionVoiceScope === 'extract-voices') return 'Auszug'
  return 'Alle'
})

function cycleSelectionVoiceScope(): void {
  if (props.selectionVoiceScope === 'single-voice') {
    emit('selection-voice-scope-change', 'extract-voices')
    return
  }
  if (props.selectionVoiceScope === 'extract-voices') {
    emit('selection-voice-scope-change', 'all-voices')
    return
  }
  emit('selection-voice-scope-change', 'single-voice')
}
</script>

<template>
  <ZnStatusBar>
    <span class="footer-bar__meta footer-bar__cursor">{{ cursorPosition }}</span>
    <ZnBadge tone="accent">
      {{ extractLabel }}
    </ZnBadge>
    <ZnBadge :tone="dirty ? 'warning' : 'success'">
      {{ dirty ? 'Unsaved changes' : 'Saved' }}
    </ZnBadge>
    <ZnBadge tone="info">
      {{ saveFormat }}
    </ZnBadge>
    <span class="footer-bar__meta">Storage: {{ storagePath }}</span>
    <span class="footer-bar__meta">{{ saveFormat }}</span>
    <template #aside>
      <div class="footer-bar__selection">
        <span class="footer-bar__meta">Selection:</span>
        <ZnButton
          class="footer-bar__scope-chip"
          variant="ghost"
          :title="selectionVoiceScopeSummary"
          @click="cycleSelectionVoiceScope"
        >
          {{ selectionScopeLabel }}
        </ZnButton>
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
  min-width: 5ch;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
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

.footer-bar__scope-chip {
  min-width: 5.25rem;
  min-height: 2.1rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
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
