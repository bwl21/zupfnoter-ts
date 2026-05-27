<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  fetchViewSvg,
  fetchViewSvgCases,
  getCaseLabel,
  type SvgSource,
  type ViewSvgCaseDetails,
} from '@/lib/viewSvgApi'

type Mode = 'side-by-side' | 'swipe' | 'blink'

interface LoadedSvg {
  svg: string
  source: SvgSource
  extractNr: number
  caseId: string
}

const cases = ref<ViewSvgCaseDetails[]>([])
const selectedCaseId = ref('')
const selectedExtract = ref(0)
const selectedMode = ref<Mode>('side-by-side')
const hideHitboxes = ref(true)
const swipePosition = ref(50)
const loading = ref(false)
const error = ref<string | null>(null)
const legacySvg = ref<LoadedSvg | null>(null)
const tsSvg = ref<LoadedSvg | null>(null)
const blinkVisible = ref<'legacy' | 'ts'>('legacy')

const selectedCase = computed(() => cases.value.find((caseItem) => caseItem.id === selectedCaseId.value) ?? null)

const availableExtracts = computed(() => {
  const caseItem = selectedCase.value
  if (caseItem === null) return [] as number[]
  return [...new Set([...caseItem.legacyExtracts, ...caseItem.tsExtracts])].sort((a, b) => a - b)
})

const selectedExtractLabel = computed(() => `extract ${selectedExtract.value}`)

const legacySvgMarkup = computed(() => decorateSvg(legacySvg.value?.svg ?? '', hideHitboxes.value, 'legacy'))
const tsSvgMarkup = computed(() => decorateSvg(tsSvg.value?.svg ?? '', hideHitboxes.value, 'ts'))

const hasLegacy = computed(() => legacySvg.value !== null)
const hasTs = computed(() => tsSvg.value !== null)
const visibleBlinkLabel = computed(() => (blinkVisible.value === 'legacy' ? 'Legacy' : 'TS'))

async function loadCases(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const loadedCases = await fetchViewSvgCases()
    cases.value = loadedCases
    if (selectedCaseId.value === '' && loadedCases.length > 0) {
      selectedCaseId.value = loadedCases[0]?.id ?? ''
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function loadSelectedSvgs(caseId: string, extractNr: number): Promise<void> {
  const caseItem = cases.value.find((entry) => entry.id === caseId) ?? null
  if (caseItem === null) {
    legacySvg.value = null
    tsSvg.value = null
    return
  }

  loading.value = true
  error.value = null

  const legacyPromise = caseItem.legacyExtracts.includes(extractNr)
    ? fetchViewSvg(caseItem.id, 'legacy', extractNr)
    : Promise.resolve(null)
  const tsPromise = caseItem.tsExtracts.includes(extractNr)
    ? fetchViewSvg(caseItem.id, 'ts', extractNr)
    : Promise.resolve(null)

  try {
    const [legacyResult, tsResult] = await Promise.all([legacyPromise, tsPromise])
    legacySvg.value = legacyResult
    tsSvg.value = tsResult
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    legacySvg.value = null
    tsSvg.value = null
  } finally {
    loading.value = false
  }
}

function ensureBlinkTimer(): void {
  if (selectedMode.value !== 'blink') {
    blinkVisible.value = 'legacy'
    return
  }

  blinkVisible.value = 'legacy'
}

function selectCase(caseId: string): void {
  selectedCaseId.value = caseId
}

function selectExtract(extractNr: number): void {
  selectedExtract.value = extractNr
}

function toggleBlinkVisible(): void {
  if (selectedMode.value !== 'blink') return
  blinkVisible.value = blinkVisible.value === 'legacy' ? 'ts' : 'legacy'
}

function decorateSvg(svg: string, hide: boolean, source: SvgSource): string {
  if (svg.trim() === '') return ''
  const className = source === 'legacy' ? 'viewsvg-surface viewsvg-surface--legacy' : 'viewsvg-surface viewsvg-surface--ts'
  const style = hide
    ? '<style type="text/css">rect.abcref, rect.zupfnoter-hitbox { fill: none !important; stroke: none !important; opacity: 0 !important; }</style>'
    : ''
  const withClass = svg.replace('<svg ', `<svg class="${className}" `)
  const openTagEnd = withClass.indexOf('>')
  if (openTagEnd < 0) return withClass
  return `${withClass.slice(0, openTagEnd + 1)}${style}${withClass.slice(openTagEnd + 1)}`
}

watch([selectedCaseId, selectedExtract], async ([caseId, extractNr]) => {
  if (caseId === '') return
  await loadSelectedSvgs(caseId, extractNr)
})

watch(selectedCaseId, () => {
  const caseItem = selectedCase.value
  if (caseItem === null) return
  const fallbackExtract = caseItem.legacyExtracts[0] ?? caseItem.tsExtracts[0] ?? 0
  selectedExtract.value = fallbackExtract
})

watch(selectedMode, () => {
  ensureBlinkTimer()
})

onMounted(async () => {
  await loadCases()
  ensureBlinkTimer()
})

onBeforeUnmount(() => {
})
</script>

<template>
  <main class="viewsvg-app">
    <aside class="viewsvg-sidebar">
      <header class="viewsvg-brand">
        <div>
          <p class="viewsvg-kicker">test:viewsvg</p>
          <h1>Legacy gegen TS</h1>
        </div>
        <p class="viewsvg-subtitle">Direkter Vergleich der vorhandenen SVG-Fixtures aus `fixtures/cases`.</p>
      </header>

      <section class="viewsvg-panel">
        <div class="viewsvg-panel__header">
          <h2>Case-Liste</h2>
          <span>{{ cases.length }}</span>
        </div>

        <div class="viewsvg-list" role="listbox" aria-label="SVG cases">
          <button
            v-for="caseItem in cases"
            :key="caseItem.id"
            type="button"
            class="viewsvg-case"
            :class="{ 'is-active': caseItem.id === selectedCaseId }"
            @click="selectCase(caseItem.id)"
          >
            <span class="viewsvg-case__name">{{ getCaseLabel(caseItem) }}</span>
            <span class="viewsvg-case__meta">{{ caseItem.id }}</span>
          </button>
        </div>
      </section>

      <section class="viewsvg-panel viewsvg-panel--controls">
        <div class="viewsvg-panel__header">
          <h2>Kontrollen</h2>
        </div>

        <label class="viewsvg-field">
          <span>Vergleichsmodus</span>
          <select v-model="selectedMode">
            <option value="side-by-side">Side by side</option>
            <option value="swipe">Swipe</option>
            <option value="blink">Alternierend</option>
          </select>
        </label>

        <label class="viewsvg-field">
          <span>Extract</span>
          <select v-model.number="selectedExtract">
            <option v-for="extractNr in availableExtracts" :key="extractNr" :value="extractNr">
              {{ extractNr }}
            </option>
          </select>
        </label>

        <label class="viewsvg-check">
          <input v-model="hideHitboxes" type="checkbox" />
          <span>Hitboxes ausblenden</span>
        </label>

        <label v-if="selectedMode === 'swipe'" class="viewsvg-field">
          <span>Swipe</span>
          <input v-model.number="swipePosition" type="range" min="0" max="100" step="1" />
        </label>

        <div class="viewsvg-status">
          <div><strong>Case:</strong> {{ selectedCase?.id ?? 'n/a' }}</div>
          <div><strong>Extract:</strong> {{ selectedExtractLabel }}</div>
          <div><strong>Legacy:</strong> {{ hasLegacy ? 'da' : 'fehlt' }}</div>
          <div><strong>TS:</strong> {{ hasTs ? 'da' : 'fehlt' }}</div>
        </div>
      </section>

      <p v-if="loading" class="viewsvg-hint">Lade SVGs ...</p>
      <p v-if="error !== null" class="viewsvg-error">{{ error }}</p>
    </aside>

      <section class="viewsvg-stage">
        <div class="viewsvg-stage__shell" :class="`viewsvg-stage__shell--${selectedMode}`">
        <template v-if="selectedMode === 'side-by-side'">
          <article class="viewsvg-pane">
            <div class="viewsvg-pane__title">Legacy</div>
            <div class="viewsvg-pane__body" v-html="legacySvgMarkup" />
          </article>
          <article class="viewsvg-pane">
            <div class="viewsvg-pane__title">TS</div>
            <div class="viewsvg-pane__body" v-html="tsSvgMarkup" />
          </article>
        </template>

        <template v-else-if="selectedMode === 'swipe'">
          <div class="viewsvg-swipe">
            <div class="viewsvg-swipe__layer viewsvg-swipe__layer--legacy" v-html="legacySvgMarkup" />
            <div
              class="viewsvg-swipe__layer viewsvg-swipe__layer--ts"
              :style="{ clipPath: `inset(0 ${100 - swipePosition}% 0 0)` }"
              v-html="tsSvgMarkup"
            />
            <div class="viewsvg-swipe__handle" :style="{ left: `${swipePosition}%` }" />
          </div>
        </template>

        <template v-else>
          <div class="viewsvg-blink">
            <div
              class="viewsvg-blink__layer viewsvg-blink__layer--legacy"
              :class="{ 'is-visible': blinkVisible === 'legacy' }"
              v-html="legacySvgMarkup"
            />
            <div
              class="viewsvg-blink__layer viewsvg-blink__layer--ts"
              :class="{ 'is-visible': blinkVisible === 'ts' }"
              v-html="tsSvgMarkup"
            />
          </div>
          <button
            type="button"
            class="viewsvg-blink__badge"
            @click="toggleBlinkVisible"
          >
            <span>{{ visibleBlinkLabel }}</span>
          </button>
          <div class="viewsvg-blink__legend" role="note" aria-label="Blink mode guide">
            <span class="viewsvg-blink__legend-title">Blink</span>
            <span class="viewsvg-blink__legend-item">
              <span class="viewsvg-blink__swatch viewsvg-blink__swatch--legacy"></span>
              Legacy
            </span>
            <span class="viewsvg-blink__legend-item">
              <span class="viewsvg-blink__swatch viewsvg-blink__swatch--ts"></span>
              TS
            </span>
            <span class="viewsvg-blink__legend-hint">Chip rechts oben schaltet um</span>
          </div>
        </template>
        </div>
    </section>
  </main>
</template>

<style scoped>
.viewsvg-app {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  min-height: 100vh;
}

.viewsvg-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  border-right: 1px solid var(--viewsvg-panel-border);
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
}

.viewsvg-brand {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--viewsvg-panel-border);
  border-radius: 20px;
  background: var(--viewsvg-panel);
  box-shadow: var(--viewsvg-shadow);
}

.viewsvg-kicker {
  margin: 0 0 0.35rem;
  color: var(--viewsvg-accent);
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.viewsvg-brand h1 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.viewsvg-subtitle {
  margin: 0;
  color: var(--viewsvg-subtext);
  font-size: 0.94rem;
}

.viewsvg-panel {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--viewsvg-panel-border);
  border-radius: 20px;
  background: var(--viewsvg-panel);
  box-shadow: var(--viewsvg-shadow);
}

.viewsvg-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.viewsvg-panel__header h2 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.viewsvg-panel__header span {
  color: var(--viewsvg-accent);
  font-size: 0.9rem;
}

.viewsvg-list {
  display: grid;
  gap: 0.5rem;
  max-height: 34vh;
  overflow: auto;
  padding-right: 0.15rem;
}

.viewsvg-case {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid transparent;
  border-radius: 14px;
  background: var(--viewsvg-panel-soft);
  color: var(--viewsvg-text);
  text-align: left;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    background-color 0.2s ease;
}

.viewsvg-case:hover {
  transform: translateY(-1px);
  border-color: rgba(15, 23, 42, 0.25);
}

.viewsvg-case.is-active {
  border-color: rgba(15, 23, 42, 0.6);
  background: rgba(15, 23, 42, 0.08);
}

.viewsvg-case__name {
  font-size: 0.92rem;
  font-weight: 600;
}

.viewsvg-case__meta {
  color: var(--viewsvg-subtext);
  font-size: 0.78rem;
  white-space: nowrap;
}

.viewsvg-panel--controls {
  gap: 0.9rem;
}

.viewsvg-field {
  display: grid;
  gap: 0.45rem;
}

.viewsvg-field span {
  color: var(--viewsvg-subtext);
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.viewsvg-field select,
.viewsvg-field input[type='range'] {
  width: 100%;
}

.viewsvg-field select,
.viewsvg-field input[type='range'] {
  accent-color: var(--viewsvg-accent-strong);
}

.viewsvg-field select {
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--viewsvg-panel-border);
  border-radius: 12px;
  background: #ffffff;
  color: var(--viewsvg-text);
}

.viewsvg-check {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--viewsvg-text);
  font-size: 0.94rem;
}

.viewsvg-check input {
  width: 1rem;
  height: 1rem;
}

.viewsvg-status {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem 0.75rem;
  padding-top: 0.2rem;
  color: var(--viewsvg-subtext);
  font-size: 0.84rem;
}

.viewsvg-hint,
.viewsvg-error {
  margin: 0;
  padding: 0 0.25rem;
  font-size: 0.9rem;
}

.viewsvg-hint {
  color: var(--viewsvg-accent);
}

.viewsvg-error {
  color: var(--viewsvg-danger);
}

.viewsvg-stage {
  min-width: 0;
  min-height: 0;
  padding: 1rem;
}

.viewsvg-stage__shell {
  position: relative;
  display: grid;
  min-height: calc(100vh - 2rem);
  overflow: hidden;
  border: 1px solid var(--viewsvg-panel-border);
  border-radius: 28px;
  background: #ffffff;
  box-shadow: var(--viewsvg-shadow);
}

.viewsvg-stage__shell--side-by-side {
  grid-template-columns: 1fr 1fr;
}

.viewsvg-stage__shell--swipe,
.viewsvg-stage__shell--blink {
  grid-template-columns: 1fr;
}

.viewsvg-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid rgba(15, 23, 42, 0.14);
}

.viewsvg-pane:last-child {
  border-right: 0;
}

.viewsvg-pane__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.14);
  background: #ffffff;
  font-size: 0.82rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.viewsvg-pane__body {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 1rem;
}

.viewsvg-swipe,
.viewsvg-blink {
  position: relative;
  min-height: calc(100vh - 2rem);
  overflow: hidden;
}

.viewsvg-swipe__layer,
.viewsvg-blink__layer {
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 1rem;
}

.viewsvg-swipe__layer--legacy {
  pointer-events: none;
}

.viewsvg-swipe__layer--ts {
  pointer-events: none;
}

.viewsvg-swipe__handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #000000;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.95),
    0 0 24px rgba(0, 0, 0, 0.16);
  transform: translateX(-1px);
  pointer-events: none;
}

.viewsvg-blink__layer {
  opacity: 0;
  transition: opacity 0.18s ease;
}

.viewsvg-blink__layer.is-visible {
  opacity: 1;
}

.viewsvg-blink__badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 3;
  display: inline-flex;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(15, 23, 42, 0.25);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  color: #000000;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.08);
}

.viewsvg-blink__badge:hover {
  border-color: rgba(15, 23, 42, 0.5);
  background: rgba(255, 255, 255, 1);
}

.viewsvg-blink__legend {
  position: absolute;
  left: 1rem;
  bottom: 1rem;
  z-index: 3;
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  max-width: calc(100% - 2rem);
  padding: 0.55rem 0.75rem;
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: var(--viewsvg-text);
  font-size: 0.76rem;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
  pointer-events: none;
}

.viewsvg-blink__legend-title {
  color: var(--viewsvg-subtext);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.viewsvg-blink__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
}

.viewsvg-blink__legend-hint {
  color: var(--viewsvg-subtext);
}

.viewsvg-blink__swatch {
  width: 0.85rem;
  height: 0.85rem;
  border: 1px solid rgba(15, 23, 42, 0.35);
  border-radius: 0.25rem;
  background: #ffffff;
}

.viewsvg-blink__swatch--legacy {
  box-shadow: inset 0 0 0 1px #000000;
}

.viewsvg-blink__swatch--ts {
  border-style: dashed;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.55);
}

:deep(.viewsvg-surface) {
  width: 100%;
  height: auto;
  background: #ffffff;
}

:deep(.viewsvg-surface rect.abcref),
:deep(.viewsvg-surface rect.zupfnoter-hitbox) {
  fill-opacity: 0.0;
}

:deep(.viewsvg-surface .zupfnoter-hitbox) {
  cursor: crosshair;
}

@media (max-width: 1180px) {
  .viewsvg-app {
    grid-template-columns: 1fr;
  }

  .viewsvg-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--viewsvg-panel-border);
  }

  .viewsvg-list {
    max-height: 24vh;
  }
}
</style>
