<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { renderReviewDocument } from '@zupfnoter/core'
import type { PlaybackMetronomeConfig } from '@zupfnoter/playback'
import { useAudioPlayer, type PlaybackInstrument } from '@zupfnoter/playback-audio'
import type { PlaybackStep, ReviewDocument } from '@zupfnoter/types'

import defaultAbc from '../../../../fixtures/cases/public/krippen-demo/input.abc?raw'

type ReviewView = 'score' | 'harp'
type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused'

const abcText = ref(defaultAbc)
const document = ref<ReviewDocument>(renderReviewDocument(defaultAbc))
const activeView = ref<ReviewView>('harp')
const fileInput = ref<HTMLInputElement | null>(null)
const viewer = ref<HTMLElement | null>(null)
const errorMessage = ref<string>()
const playbackStatus = ref<PlaybackStatus>('idle')
const currentStep = ref<PlaybackStep>()
const startMeasure = ref(1)
const tempoBpm = ref(document.value.baseTempoBpm)
const metronomeEnabled = ref(false)
const instrument = ref<PlaybackInstrument>('harp')
const audioPlayer = useAudioPlayer(instrument)

const currentSvg = computed(() => activeView.value === 'score'
  ? document.value.scoreSvg
  : document.value.harpSvg)
const maximumMeasure = computed(() => document.value.playbackTimeline.reduce(
  (maximum, step) => Math.max(maximum, step.position?.measureNumber ?? 1),
  1,
))
const speedFactor = computed(() => tempoBpm.value / document.value.baseTempoBpm)
const currentPosition = computed(() => {
  const position = currentStep.value?.position
  if (position === undefined) return `Ab Takt ${startMeasure.value}`
  return `Takt ${position.measureNumber} · Durchlauf ${position.passIndex}`
})
const playLabel = computed(() => playbackStatus.value === 'playing' ? 'Pause' : 'Abspielen')

function preparePlaybackSteps(): PlaybackStep[] {
  const timeline = document.value.playbackTimeline
  const startIndex = timeline.findIndex((step) => (step.position?.measureNumber ?? 1) >= startMeasure.value)
  if (startIndex < 0) return []
  const steps = timeline.slice(startIndex)
  const firstTime = steps[0]?.playbackStartMs ?? 0
  return steps.map((step) => ({
    ...step,
    playbackStartMs: step.playbackStartMs - firstTime,
  }))
}

function playbackMetronome(): PlaybackMetronomeConfig | undefined {
  if (!metronomeEnabled.value) return undefined
  return {
    mode: 'always',
    division: 4,
    subdivision: 1,
  }
}

function stopPlayback(): void {
  audioPlayer.stop()
  playbackStatus.value = 'idle'
  currentStep.value = undefined
}

async function togglePlayback(): Promise<void> {
  if (playbackStatus.value === 'playing') {
    audioPlayer.suspend()
    playbackStatus.value = 'paused'
    return
  }
  if (playbackStatus.value === 'paused') {
    audioPlayer.resume()
    playbackStatus.value = 'playing'
    return
  }

  const steps = preparePlaybackSteps()
  if (steps.length === 0) return
  playbackStatus.value = 'loading'
  errorMessage.value = undefined
  const lastStep = steps[steps.length - 1]
  try {
    await audioPlayer.schedule(
      steps,
      speedFactor.value,
      {
        onStepStart: (step) => {
          currentStep.value = step
          playbackStatus.value = 'playing'
        },
        onStepEnd: (step) => {
          if (step === lastStep) stopPlayback()
        },
      },
      playbackMetronome(),
      document.value.baseTempoBpm,
      document.value.tempoUnit,
    )
    if (playbackStatus.value === 'loading') playbackStatus.value = 'playing'
  } catch (error) {
    stopPlayback()
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function renderDocument(nextAbc: string, extractNumber = 0): void {
  stopPlayback()
  try {
    const nextDocument = renderReviewDocument(nextAbc, extractNumber)
    abcText.value = nextAbc
    document.value = nextDocument
    tempoBpm.value = nextDocument.baseTempoBpm
    startMeasure.value = 1
    errorMessage.value = undefined
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function chooseExtract(event: Event): void {
  const select = event.target
  if (!(select instanceof HTMLSelectElement)) return
  const extractNumber = Number(select.value)
  if (Number.isSafeInteger(extractNumber)) renderDocument(abcText.value, extractNumber)
}

async function openFile(event: Event): Promise<void> {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (file === undefined) return
  renderDocument(await file.text())
}

function showView(view: ReviewView): void {
  activeView.value = view
}

function applyPlaybackHighlight(): void {
  const root = viewer.value
  if (root === null) return
  root.querySelectorAll('.zn-review-playback').forEach((element) => {
    element.classList.remove('zn-review-playback')
  })
  const step = currentStep.value
  if (step === undefined) return

  const matches: Element[] = []
  if (activeView.value === 'harp') {
    const activeIds = new Set(step.originZnIds)
    root.querySelectorAll('[data-zn-id]').forEach((element) => {
      const znId = element.getAttribute('data-zn-id')
      if (znId !== null && activeIds.has(znId)) matches.push(element)
    })
  } else {
    root.querySelectorAll('[data-start-char][data-end-char]').forEach((element) => {
      const start = Number(element.getAttribute('data-start-char'))
      const end = Number(element.getAttribute('data-end-char'))
      if (step.activeTextRanges.some((range) => end > range.startpos && start < range.endpos)) {
        matches.push(element)
      }
    })
  }
  for (const element of matches) element.classList.add('zn-review-playback')
  matches[0]?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
}

watch([currentStep, activeView], async () => {
  await nextTick()
  applyPlaybackHighlight()
})

watch(startMeasure, () => {
  if (playbackStatus.value !== 'idle') stopPlayback()
})

onBeforeUnmount(stopPlayback)
</script>

<template>
  <main class="review-shell">
    <header class="review-header">
      <div class="review-title">
        <span class="review-brand">Zupfnoter Review</span>
        <h1>{{ document.title }}</h1>
      </div>
      <div class="review-actions">
        <select
          v-if="document.extracts.length > 1"
          class="review-extract"
          aria-label="Auszug auswählen"
          :value="document.extractNumber"
          @change="chooseExtract"
        >
          <option v-for="extract in document.extracts" :key="extract.number" :value="extract.number">
            {{ extract.title }}
          </option>
        </select>
        <button type="button" class="review-open" @click="fileInput?.click()">
          <span aria-hidden="true">＋</span><span class="review-open__label">ABC öffnen</span>
        </button>
        <input ref="fileInput" class="visually-hidden" type="file" accept=".abc,text/plain" @change="openFile">
      </div>
    </header>

    <nav class="review-tabs" aria-label="Notenansicht">
      <button
        type="button"
        :class="{ 'review-tabs__button--active': activeView === 'harp' }"
        :aria-pressed="activeView === 'harp'"
        data-testid="harp-view"
        @click="showView('harp')"
      >
        Harfennoten
      </button>
      <button
        type="button"
        :class="{ 'review-tabs__button--active': activeView === 'score' }"
        :aria-pressed="activeView === 'score'"
        data-testid="score-view"
        @click="showView('score')"
      >
        Noten
      </button>
    </nav>

    <section ref="viewer" class="review-document" :aria-label="activeView === 'harp' ? 'Harfennoten' : 'Noten'">
      <div v-if="errorMessage" class="review-error" role="alert">
        <strong>Das Stück konnte nicht angezeigt werden.</strong>
        <span>{{ errorMessage }}</span>
      </div>
      <div v-else class="review-svg" v-html="currentSvg" />
    </section>

    <footer class="review-player" aria-label="Wiedergabe">
      <div class="review-position" aria-live="polite">
        <span>{{ currentPosition }}</span>
        <span v-if="playbackStatus === 'loading'" class="review-loading">Klang wird geladen …</span>
      </div>
      <div class="review-player__controls">
        <label class="review-field">
          <span>Start</span>
          <input v-model.number="startMeasure" type="number" min="1" :max="maximumMeasure" inputmode="numeric">
        </label>
        <button
          type="button"
          class="review-play"
          :disabled="playbackStatus === 'loading'"
          :aria-label="playLabel"
          @click="togglePlayback"
        >
          <span aria-hidden="true">{{ playbackStatus === 'playing' ? 'Ⅱ' : '▶' }}</span>
        </button>
        <button type="button" class="review-stop" aria-label="Wiedergabe stoppen" @click="stopPlayback">
          <span aria-hidden="true">■</span>
        </button>
        <label class="review-field review-field--tempo">
          <span>Tempo</span>
          <input v-model.number="tempoBpm" type="number" min="20" max="300" step="5" inputmode="numeric">
          <span>BPM</span>
        </label>
        <label class="review-metronome">
          <input v-model="metronomeEnabled" type="checkbox">
          <span>Metronom</span>
        </label>
      </div>
    </footer>
  </main>
</template>
