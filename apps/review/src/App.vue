<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import {
  expireActivePlaybackRanges,
  playbackTimelineFromPosition,
  renderReviewDocument,
  updateActivePlaybackRanges,
} from '@zupfnoter/core'
import { ZnPlaybackControls, ZnPlaybackStatus } from '@zupfnoter/design-system'
import type { PlaybackMetronomeConfig } from '@zupfnoter/playback'
import {
  useAudioPlayer,
  type PlaybackInstrument,
  type PlaybackMetronomeVisualBeat,
} from '@zupfnoter/playback-audio'
import { useReviewStorage } from './useReviewStorage'
import type {
  ActivePlaybackRangeState,
  PlaybackMetronomeMode,
  PlaybackStep,
  ReviewDocument,
  SelectionTextRange,
} from '@zupfnoter/types'

import defaultAbc from '../../../fixtures/cases/public/krippen-demo/input.abc?raw'

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
const metronomeBeat = ref<(PlaybackMetronomeVisualBeat & { pulse: number }) | undefined>()
const startMeasure = ref(1)
const startPass = ref(1)
const tempoBpm = ref(document.value.baseTempoBpm)
const metronomeMode = ref<PlaybackMetronomeMode>(
  document.value.playbackConfig?.metronomeMode ?? 'off',
)
const instrument = ref<PlaybackInstrument>('harp')
const audioPlayer = useAudioPlayer(instrument)
const playbackTextRanges = ref<SelectionTextRange[]>([])
let activePlaybackRanges = new Map<string, ActivePlaybackRangeState>()
let metronomePulse = 0
const extractPickerOpen = ref(false)

const {
  storageOpen,
  storageSheetView,
  storageConnections,
  storageQuery,
  storageLoading,
  storageError,
  activeStorageConnectionId,
  activeStorageConnection,
  filteredStorageDocuments,
  openStorage,
  loadStorageDocuments,
  showStorageConnections,
  showStorageDocuments,
  selectStorageConnection,
  connectStorage,
  disconnectStorage,
  openStorageDocument,
} = useReviewStorage(renderDocument)

const currentSvg = computed(() =>
  activeView.value === 'score' ? document.value.scoreSvg : document.value.harpSvg,
)
const maximumMeasure = computed(() =>
  document.value.playbackTimeline.reduce(
    (maximum, step) => Math.max(maximum, step.position?.measureNumber ?? 1),
    1,
  ),
)
const maximumPass = computed(() =>
  document.value.playbackTimeline.reduce(
    (maximum, step) => Math.max(maximum, step.position?.passIndex ?? 1),
    1,
  ),
)
const speedFactor = computed(() => tempoBpm.value / document.value.baseTempoBpm)
const currentPosition = computed(() => ({
  measureNumber: currentStep.value?.position?.measureNumber ?? startMeasure.value,
  passIndex: currentStep.value?.position?.passIndex ?? startPass.value,
}))
const playLabel = computed(() => (playbackStatus.value === 'playing' ? 'Pause' : 'Abspielen'))
const currentExtract = computed(() =>
  document.value.extracts.find((extract) => extract.number === document.value.extractNumber),
)

function syncPlaybackTextRanges(): void {
  playbackTextRanges.value = [
    ...new Map(
      [...activePlaybackRanges.values()].map((range) => [
        `${range.textRange.startpos}:${range.textRange.endpos}`,
        range.textRange,
      ]),
    ).values(),
  ]
}

function preparePlaybackSteps(): PlaybackStep[] {
  return playbackTimelineFromPosition(document.value.playbackTimeline, {
    measureNumber: startMeasure.value,
    passIndex: startPass.value,
  })
}

function playbackMetronome(): PlaybackMetronomeConfig | undefined {
  if (metronomeMode.value === 'off') return undefined
  const config = document.value.playbackConfig
  return {
    mode: metronomeMode.value,
    minLeadIn: config?.minLeadIn,
    bandPreCount: config?.bandPreCount,
    division: config?.division,
    subdivision: config?.subdivision,
  }
}

function setPlaybackTempoBpm(value: number): void {
  if (!Number.isFinite(value) || value <= 0) return
  tempoBpm.value = Math.max(1, Math.round(value))
}

function adjustPlaybackTempoBpm(delta: number): void {
  setPlaybackTempoBpm(tempoBpm.value + delta)
}

function stopPlayback(): void {
  audioPlayer.stop()
  activePlaybackRanges = new Map()
  syncPlaybackTextRanges()
  playbackStatus.value = 'idle'
  currentStep.value = undefined
  metronomeBeat.value = undefined
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
          if (metronomeMode.value === 'countIn') metronomeBeat.value = undefined
          activePlaybackRanges = updateActivePlaybackRanges(activePlaybackRanges, step)
          syncPlaybackTextRanges()
          currentStep.value = step
          playbackStatus.value = 'playing'
        },
        onStepEnd: (step) => {
          activePlaybackRanges = expireActivePlaybackRanges(
            activePlaybackRanges,
            step.playbackStartMs + step.durationMs,
          )
          syncPlaybackTextRanges()
          if (step === lastStep) stopPlayback()
        },
        onNoteOff: (playbackTimeMs) => {
          activePlaybackRanges = expireActivePlaybackRanges(activePlaybackRanges, playbackTimeMs)
          syncPlaybackTextRanges()
        },
        onMetronomeBeat: (beat) => {
          metronomePulse += 1
          metronomeBeat.value = { ...beat, pulse: metronomePulse }
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
    startPass.value = 1
    metronomeMode.value = nextDocument.playbackConfig?.metronomeMode ?? 'off'
    errorMessage.value = undefined
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function chooseExtract(extractNumber: number): void {
  renderDocument(abcText.value, extractNumber)
  extractPickerOpen.value = false
}

function handleExtractPickerToggle(event: Event): void {
  const target = event.currentTarget
  if (!(target instanceof HTMLDetailsElement)) return
  extractPickerOpen.value = target.open
}

async function openFile(event: Event): Promise<void> {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (file === undefined) return
  renderDocument(await file.text())
  storageOpen.value = false
}

function showView(view: ReviewView): void {
  activeView.value = view
}

function applyPlaybackHighlight(): void {
  const root = viewer.value
  if (root === null) return
  root.querySelectorAll('.zn-playback-highlight').forEach((element) => {
    element.classList.remove('zn-playback-highlight')
  })
  if (playbackTextRanges.value.length === 0) return

  const selector =
    activeView.value === 'score'
      ? '.zn-score-hitbox[data-start-char][data-end-char]'
      : '.zupfnoter-hitbox[data-start-char][data-end-char]'
  const matches: Element[] = []
  root.querySelectorAll(selector).forEach((element) => {
    const start = Number(element.getAttribute('data-start-char'))
    const end = Number(element.getAttribute('data-end-char'))
    if (playbackTextRanges.value.some((range) => end > range.startpos && start < range.endpos)) {
      matches.push(element)
    }
  })
  for (const element of matches) element.classList.add('zn-playback-highlight')
}

watch([playbackTextRanges, activeView], async () => {
  await nextTick()
  applyPlaybackHighlight()
})

watch([startMeasure, startPass], () => {
  if (playbackStatus.value !== 'idle') stopPlayback()
})

onBeforeUnmount(stopPlayback)
</script>

<template>
  <main class="review-shell">
    <header class="review-header">
      <span class="review-brand"
        ><span class="review-brand__mark" aria-hidden="true">Z</span
        ><span class="review-brand__name">Zupfnoter <em>Review</em></span></span
      >
      <div class="review-actions">
        <details
          class="extract-picker"
          :open="extractPickerOpen"
          @toggle="handleExtractPickerToggle"
        >
          <summary
            class="extract-picker__summary"
            :title="currentExtract?.title"
            aria-label="Auszug auswählen"
          >
            <span class="extract-picker__icon" aria-hidden="true">
              {{ document.extractNumber }}
            </span>
            <span class="extract-picker__text">
              <span class="extract-picker__title">{{ currentExtract?.title }}</span>
            </span>
          </summary>
          <div class="extract-picker__menu" role="menu" aria-label="Auszug auswählen">
            <button
              v-for="extract in document.extracts"
              :key="extract.number"
              type="button"
              class="extract-picker__item"
              :class="{ 'extract-picker__item--active': extract.number === document.extractNumber }"
              :title="`${extract.number} · ${extract.title}`"
              role="menuitem"
              @click="chooseExtract(extract.number)"
            >
              <span class="extract-picker__item-icon" aria-hidden="true">
                {{ extract.number }}
              </span>
              <span class="extract-picker__item-text"
                >{{ extract.number }} {{ extract.title }}</span
              >
            </button>
          </div>
        </details>
        <button
          type="button"
          class="review-open"
          data-testid="open-storage"
          aria-label="Öffnen"
          @click="openStorage"
        >
          <span aria-hidden="true">＋</span><span class="review-open__label">Öffnen</span>
        </button>
        <input
          ref="fileInput"
          class="visually-hidden"
          type="file"
          accept=".abc,text/plain"
          @change="openFile"
        />
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

    <section
      ref="viewer"
      class="review-document"
      :aria-label="activeView === 'harp' ? 'Harfennoten' : 'Noten'"
    >
      <div v-if="errorMessage" class="review-error" role="alert">
        <strong>Das Stück konnte nicht angezeigt werden.</strong>
        <span>{{ errorMessage }}</span>
      </div>
      <div v-else class="review-svg" v-html="currentSvg" />
    </section>

    <footer class="review-player" aria-label="Wiedergabe">
      <ZnPlaybackStatus
        :measure-number="currentPosition.measureNumber"
        :pass-index="currentPosition.passIndex"
        :metronome-beat="metronomeBeat"
      />
      <div class="review-player__start">
        <label class="review-field">
          <span>Takt</span>
          <input
            v-model.number="startMeasure"
            type="number"
            min="1"
            :max="maximumMeasure"
            inputmode="numeric"
            aria-label="Starttakt"
          />
        </label>
        <label class="review-field">
          <span>Durchlauf</span>
          <input
            v-model.number="startPass"
            type="number"
            min="1"
            :max="maximumPass"
            inputmode="numeric"
            aria-label="Startdurchlauf"
          />
        </label>
      </div>
      <div class="review-player__transport">
        <button
          type="button"
          class="review-play"
          :disabled="playbackStatus === 'loading'"
          :aria-label="playLabel"
          @click="togglePlayback"
        >
          <span aria-hidden="true">{{ playbackStatus === 'playing' ? 'Ⅱ' : '▶' }}</span>
        </button>
        <button
          type="button"
          class="review-stop"
          aria-label="Wiedergabe stoppen"
          @click="stopPlayback"
        >
          <span aria-hidden="true">■</span>
        </button>
      </div>
      <ZnPlaybackControls
        class="review-player__settings"
        :speed-bpm="tempoBpm"
        :metronome-mode="metronomeMode"
        :configured-metronome-mode="document.playbackConfig?.metronomeMode ?? 'off'"
        :show-config="false"
        @speed-change="setPlaybackTempoBpm"
        @speed-down="adjustPlaybackTempoBpm(-5)"
        @speed-up="adjustPlaybackTempoBpm(5)"
        @metronome-mode-change="metronomeMode = $event"
      />
    </footer>

    <Teleport to="body">
      <div v-if="storageOpen" class="storage-sheet__backdrop" @click.self="storageOpen = false">
        <section
          class="storage-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="storage-title"
        >
          <header class="storage-sheet__header">
            <button
              v-if="storageSheetView === 'connections'"
              type="button"
              aria-label="Zurück zu Stück öffnen"
              @click="showStorageDocuments"
            >
              ‹
            </button>
            <h2 id="storage-title">
              {{ storageSheetView === 'documents' ? 'Stück öffnen' : 'Speicherverbindungen' }}
            </h2>
            <button type="button" aria-label="Dialog schließen" @click="storageOpen = false">
              ×
            </button>
          </header>

          <div v-if="storageSheetView === 'connections'" class="storage-sheet__connection-list">
            <button
              v-for="connection in storageConnections"
              :key="connection.id"
              type="button"
              class="storage-sheet__connection"
              :class="{
                'storage-sheet__connection--active': connection.id === activeStorageConnectionId,
              }"
              @click="selectStorageConnection(connection)"
            >
              <span class="storage-sheet__provider" aria-hidden="true">☁</span>
              <span>
                <strong>{{ connection.label }}</strong>
                <small>{{
                  connection.status === 'connected' ? 'Verbunden' : 'Nicht verbunden'
                }}</small>
              </span>
              <span aria-hidden="true">›</span>
            </button>
            <button
              type="button"
              class="storage-sheet__connection storage-sheet__add"
              data-testid="connect-dropbox"
              @click="connectStorage()"
            >
              <span aria-hidden="true">＋</span>
              <span>
                <strong>Dropbox verbinden</strong>
                <small>Weiteren Speicherort hinzufügen</small>
              </span>
            </button>
            <button
              v-if="activeStorageConnection !== undefined"
              type="button"
              class="storage-sheet__disconnect"
              :disabled="storageLoading"
              @click="disconnectStorage(activeStorageConnection)"
            >
              {{ activeStorageConnection.label }} trennen
            </button>
          </div>

          <div v-else class="storage-sheet__documents-view">
            <div class="storage-sheet__sources">
              <button type="button" class="storage-sheet__source" @click="fileInput?.click()">
                <span aria-hidden="true">▣</span>
                <span><strong>Von diesem Gerät</strong><small>ABC-Datei auswählen</small></span>
                <span aria-hidden="true">›</span>
              </button>
              <button
                type="button"
                class="storage-sheet__source"
                data-testid="manage-storage"
                @click="showStorageConnections"
              >
                <span class="storage-sheet__provider" aria-hidden="true">☁</span>
                <span>
                  <strong>{{ activeStorageConnection?.label ?? 'Speicherverbindung' }}</strong>
                  <small>{{
                    activeStorageConnection?.status === 'connected'
                      ? 'Verbunden · Verbindung anpassen'
                      : 'Verbindung auswählen oder hinzufügen'
                  }}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            </div>

            <div v-if="activeStorageConnection === undefined" class="storage-sheet__empty">
              <span class="storage-sheet__empty-icon" aria-hidden="true">☁</span>
              <h3>Noch kein Speicher verbunden</h3>
              <p>Du kannst eine Datei vom Gerät öffnen oder einen Speicher verbinden.</p>
              <button type="button" class="storage-sheet__primary" @click="showStorageConnections">
                Speicher verbinden
              </button>
            </div>
            <div
              v-else-if="activeStorageConnection.status !== 'connected'"
              class="storage-sheet__empty"
            >
              <span class="storage-sheet__empty-icon" aria-hidden="true">☁</span>
              <h3>{{ activeStorageConnection.label }}</h3>
              <p>Diese Verbindung muss auf diesem Gerät angemeldet werden.</p>
              <button
                type="button"
                class="storage-sheet__primary"
                @click="connectStorage(activeStorageConnection)"
              >
                Bei Dropbox anmelden
              </button>
            </div>
            <div v-else class="storage-sheet__browser">
              <div class="storage-sheet__tools">
                <label>
                  <span class="visually-hidden">ABC-Dateien filtern</span>
                  <input v-model="storageQuery" type="search" placeholder="Stück suchen …" />
                </label>
                <button type="button" :disabled="storageLoading" @click="loadStorageDocuments()">
                  Aktualisieren
                </button>
              </div>
              <p v-if="storageError !== ''" class="storage-sheet__error" role="alert">
                {{ storageError }}
              </p>
              <p v-if="storageLoading" class="storage-sheet__status" role="status">
                Dropbox wird geladen …
              </p>
              <ul v-else-if="filteredStorageDocuments.length > 0" class="storage-sheet__documents">
                <li v-for="storageDocument in filteredStorageDocuments" :key="storageDocument.path">
                  <button type="button" @click="openStorageDocument(storageDocument)">
                    <span class="storage-sheet__file-icon" aria-hidden="true">♫</span>
                    <span
                      ><strong>{{ storageDocument.name.replace(/\.abc$/i, '') }}</strong
                      ><small>{{
                        storageDocument.modifiedAt === undefined
                          ? storageDocument.path
                          : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(
                              new Date(storageDocument.modifiedAt),
                            )
                      }}</small></span
                    >
                    <span aria-hidden="true">›</span>
                  </button>
                </li>
              </ul>
              <div v-else class="storage-sheet__empty storage-sheet__empty--small">
                <p>Keine ABC-Dateien in diesem Dropbox-Ordner gefunden.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Teleport>
  </main>
</template>
