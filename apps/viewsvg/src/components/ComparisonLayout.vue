<script setup lang="ts">
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export type ComparisonViewMode = 'side-by-side' | 'swipe' | 'blink'

export interface ComparisonCase {
  id: string
  label: string
}

interface Props {
  format: 'SVG' | 'PDF'
  caseItems: ComparisonCase[]
  selectedCaseId: string
  selectedExtract: number
  availableExtracts: number[]
  selectedMode: ComparisonViewMode
  swipePosition: number
  hasLegacy: boolean
  hasTs: boolean
  hoverAvailable: boolean
  hoverActive: boolean
  hoverTooltip: string
  promptActive: boolean
  loading: boolean
  error: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  selectCase: [caseId: string]
  'update:selectedExtract': [extractNr: number]
  'update:selectedMode': [mode: ComparisonViewMode]
  'update:swipePosition': [position: number]
  toggleHover: []
}>()

const hoverControlRef = ref<HTMLElement | null>(null)
const caseSearch = ref('')
const sidebarWidth = ref(360)
let hoverControlTooltip: TippyInstance | null = null
let removeResizeListeners: (() => void) | null = null

const sidebarStyle = computed(() => ({ '--comparison-sidebar-width': `${sidebarWidth.value}px` }))
const filteredCaseItems = computed(() => {
  const query = caseSearch.value.trim().toLocaleLowerCase()
  if (query === '') return props.caseItems
  return props.caseItems.filter((caseItem) =>
    `${caseItem.id} ${caseItem.label}`.toLocaleLowerCase().includes(query),
  )
})

function isComparisonViewMode(value: string): value is ComparisonViewMode {
  return value === 'side-by-side' || value === 'swipe' || value === 'blink'
}

function updateSelectedMode(event: Event): void {
  const select = event.target
  if (!(select instanceof HTMLSelectElement) || !isComparisonViewMode(select.value)) return
  emit('update:selectedMode', select.value)
}

function updateSwipePosition(event: Event): void {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const position = Number(input.value)
  if (!Number.isFinite(position)) return
  emit('update:swipePosition', Math.min(100, Math.max(0, position)))
}

function startSidebarResize(event: PointerEvent): void {
  if (removeResizeListeners !== null) return

  event.preventDefault()
  const startX = event.clientX
  const startWidth = sidebarWidth.value
  const minWidth = 280
  const maxWidth = 720

  const stopResize = (): void => {
    removeResizeListeners?.()
  }

  const handleMove = (moveEvent: PointerEvent): void => {
    const nextWidth = startWidth + (moveEvent.clientX - startX)
    sidebarWidth.value = Math.min(maxWidth, Math.max(minWidth, nextWidth))
  }

  const handleUp = (): void => {
    stopResize()
  }

  removeResizeListeners = (): void => {
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
    window.removeEventListener('pointercancel', handleUp)
    removeResizeListeners = null
  }

  window.addEventListener('pointermove', handleMove)
  window.addEventListener('pointerup', handleUp, { once: true })
  window.addEventListener('pointercancel', handleUp, { once: true })
}

watch(() => props.hoverTooltip, (content) => {
  hoverControlTooltip?.setContent(content)
})

onMounted(() => {
  const hoverControl = hoverControlRef.value
  if (hoverControl === null) return

  hoverControlTooltip = tippy(hoverControl, {
    content: props.hoverTooltip,
    theme: 'comparison-hover',
    placement: 'right',
  })
})

onBeforeUnmount(() => {
  hoverControlTooltip?.destroy()
  hoverControlTooltip = null
  removeResizeListeners?.()
})
</script>

<template>
  <main class="comparison-layout">
    <aside class="comparison-sidebar" :style="sidebarStyle">
      <header class="comparison-brand">
        <div>
          <p class="comparison-kicker">test:view</p>
          <h1>Legacy gegen TS</h1>
        </div>
        <div class="comparison-brand__actions">
          <nav class="comparison-view-switch" aria-label="Vorschauformat">
            <RouterLink to="/">SVG</RouterLink>
            <RouterLink to="/pdf">PDF</RouterLink>
          </nav>
          <span ref="hoverControlRef" class="comparison-hover-control__tooltip">
            <button
              type="button"
              class="comparison-hover-control"
              :class="{ 'is-active': hoverActive }"
              :aria-label="hoverAvailable ? (hoverActive ? 'Hover-Inspector ausschalten' : 'Hover-Inspector einschalten') : 'Hover-Inspektion nicht verfügbar'"
              :aria-pressed="hoverAvailable ? hoverActive : undefined"
              :disabled="!hoverAvailable"
              @click="emit('toggleHover')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            </button>
          </span>
        </div>
        <p>Direkter Vergleich der vorhandenen {{ format }}-Fixtures aus `fixtures/cases/public` und dem lokalen Bereich `protected`.</p>
      </header>

      <section class="comparison-panel comparison-panel--prompt" :class="{ 'is-active': promptActive }">
        <div class="comparison-panel__header">
          <h2>Prompt</h2>
        </div>
        <slot name="prompt">
          <p class="comparison-hint">Für PDFs steht die Prompt-Erstellung noch nicht zur Verfügung.</p>
        </slot>
      </section>

      <section class="comparison-panel">
        <div class="comparison-panel__header">
          <h2>Cases</h2>
          <span>{{ filteredCaseItems.length }}/{{ caseItems.length }}</span>
        </div>
        <input
          v-model="caseSearch"
          class="comparison-case-search"
          type="search"
          placeholder="Cases durchsuchen …"
          aria-label="Cases durchsuchen"
        >
        <div class="comparison-list" role="listbox" aria-label="Vergleichsfälle">
          <div
            v-for="caseItem in filteredCaseItems"
            :key="caseItem.id"
          >
            <button
              type="button"
              class="comparison-case"
              :class="{ 'is-active': caseItem.id === selectedCaseId }"
              :aria-selected="caseItem.id === selectedCaseId"
              @click="emit('selectCase', caseItem.id)"
            >
              <span>{{ caseItem.label }}</span>
            </button>
            <div
              v-if="caseItem.id === selectedCaseId"
              class="comparison-case-extracts"
              role="listbox"
              :aria-label="`Extracts für ${caseItem.label}`"
            >
              <button
                v-for="extractNr in availableExtracts"
                :key="extractNr"
                type="button"
                class="comparison-case-extract"
                :class="{ 'is-active': extractNr === selectedExtract }"
                :aria-selected="extractNr === selectedExtract"
                @click="emit('update:selectedExtract', extractNr)"
              >
                Extract {{ extractNr }}
              </button>
            </div>
          </div>
          <p v-if="filteredCaseItems.length === 0" class="comparison-list__empty">
            Keine Cases gefunden.
          </p>
        </div>
      </section>

      <section class="comparison-panel comparison-panel--controls">
        <div class="comparison-panel__header">
          <h2>Kontrollen</h2>
        </div>
        <label class="comparison-field" for="comparison-mode">
          <span>Vergleichsmodus</span>
          <select id="comparison-mode" :value="selectedMode" @change="updateSelectedMode">
            <option value="side-by-side">Side by side</option>
            <option value="swipe">Swipe</option>
            <option value="blink">Alternierend</option>
          </select>
        </label>
        <label v-if="selectedMode === 'swipe'" class="comparison-field" for="comparison-swipe">
          <span>Swipe</span>
          <input
            id="comparison-swipe"
            :value="swipePosition"
            type="range"
            min="0"
            max="100"
            step="1"
            @input="updateSwipePosition"
          />
        </label>
        <div class="comparison-status">
          <div><strong>Case:</strong> {{ selectedCaseId || 'n/a' }}</div>
          <div><strong>Extract:</strong> extract {{ selectedExtract }}</div>
          <div><strong>Legacy:</strong> {{ hasLegacy ? 'da' : 'fehlt' }}</div>
          <div><strong>TS:</strong> {{ hasTs ? 'da' : 'fehlt' }}</div>
        </div>
      </section>

      <p v-if="loading" class="comparison-hint">Lade Vergleichsfälle …</p>
      <p v-if="error !== null" class="comparison-error">{{ error }}</p>
      <button
        type="button"
        class="comparison-sidebar__resizer"
        aria-label="Sidebar breiter oder schmaler ziehen"
        @pointerdown="startSidebarResize"
      />
    </aside>

    <slot />
  </main>
</template>

<style scoped>
.comparison-layout {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  min-height: 100vh;
}

.comparison-sidebar {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-sizing: border-box;
  width: var(--comparison-sidebar-width);
  padding: 1rem;
  border-right: 1px solid var(--viewsvg-panel-border);
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  overflow: auto;
}

.comparison-brand,
.comparison-panel {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--viewsvg-panel-border);
  border-radius: 20px;
  background: var(--viewsvg-panel);
  box-shadow: var(--viewsvg-shadow);
}

.comparison-brand {
  gap: 0.75rem;
}

.comparison-kicker,
.comparison-brand p {
  margin: 0;
}

.comparison-kicker {
  margin-bottom: 0.35rem;
  color: var(--viewsvg-accent);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.comparison-brand h1,
.comparison-panel h2 {
  margin: 0;
}

.comparison-brand h1 {
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.comparison-brand > p,
.comparison-hint {
  color: var(--viewsvg-subtext);
  font-size: 0.94rem;
}

.comparison-brand__actions,
.comparison-panel__header,
.comparison-field,
.comparison-status div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.comparison-view-switch {
  display: inline-flex;
  gap: 0.35rem;
}

.comparison-view-switch a {
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--viewsvg-panel-border);
  border-radius: 0.45rem;
  color: var(--viewsvg-subtext);
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;
}

.comparison-view-switch a.router-link-exact-active,
.comparison-hover-control.is-active {
  border-color: var(--viewsvg-accent);
  background: var(--viewsvg-accent);
  color: #ffffff;
}

.comparison-hover-control__tooltip {
  display: inline-grid;
}

.comparison-hover-control {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid rgba(15, 23, 42, 0.22);
  border-radius: 0.45rem;
  background: #ffffff;
  color: #000000;
  cursor: pointer;
}

.comparison-hover-control:disabled {
  color: #64748b;
  cursor: not-allowed;
  opacity: 0.52;
}

.comparison-hover-control svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.comparison-panel__header h2 {
  font-size: 0.92rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.comparison-panel__header span {
  color: var(--viewsvg-accent);
  font-size: 0.9rem;
}

.comparison-panel--prompt {
  position: sticky;
  top: 1rem;
  z-index: 2;
}

.comparison-panel--prompt.is-active {
  border-color: rgba(15, 23, 42, 0.55);
  box-shadow:
    0 0 0 1px rgba(15, 23, 42, 0.08),
    var(--viewsvg-shadow);
}

.comparison-list {
  display: grid;
  gap: 0.3rem;
  max-height: 26vh;
  overflow: auto;
  padding-right: 0.15rem;
}

.comparison-case-search {
  box-sizing: border-box;
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--viewsvg-panel-border);
  border-radius: 0.55rem;
  background: #ffffff;
  color: var(--viewsvg-text);
  font: inherit;
  font-size: 0.84rem;
}

.comparison-case-search:focus {
  outline: 2px solid var(--viewsvg-accent);
  outline-offset: 1px;
}

.comparison-case {
  display: block;
  padding: 0.42rem 0.6rem;
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

.comparison-case:hover {
  transform: translateY(-1px);
  border-color: rgba(15, 23, 42, 0.25);
}

.comparison-case.is-active {
  border-color: rgba(15, 23, 42, 0.6);
  background: rgba(15, 23, 42, 0.08);
}

.comparison-case > span {
  font-size: 0.92rem;
  font-weight: 600;
}

.comparison-case-extracts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.1rem 0.35rem 0.2rem;
}

.comparison-case-extract {
  padding: 0.2rem 0.45rem;
  border: 1px solid var(--viewsvg-panel-border);
  border-radius: 0.35rem;
  background: #ffffff;
  color: var(--viewsvg-subtext);
  font: inherit;
  font-size: 0.72rem;
  cursor: pointer;
}

.comparison-case-extract:hover,
.comparison-case-extract.is-active {
  border-color: var(--viewsvg-accent);
  background: var(--viewsvg-accent);
  color: #ffffff;
}

.comparison-list__empty {
  margin: 0;
  color: var(--viewsvg-subtext);
  font-size: 0.82rem;
}

.comparison-panel--controls {
  gap: 0.9rem;
}

.comparison-field span {
  color: var(--viewsvg-subtext);
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.comparison-field select {
  width: 100%;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--viewsvg-panel-border);
  border-radius: 12px;
  background: #ffffff;
  color: var(--viewsvg-text);
}

.comparison-field input[type='range'] {
  width: 100%;
}

.comparison-field select,
.comparison-field input[type='range'] {
  accent-color: var(--viewsvg-accent-strong);
}

.comparison-status {
  display: grid;
  gap: 0.45rem;
  color: var(--viewsvg-subtext);
  font-size: 0.84rem;
}

.comparison-status div {
  justify-content: flex-start;
}

.comparison-hint,
.comparison-error {
  margin: 0;
}

.comparison-error {
  color: var(--viewsvg-danger);
}

.comparison-sidebar__resizer {
  position: absolute;
  top: 0;
  right: -6px;
  bottom: 0;
  width: 12px;
  border: 0;
  background: transparent;
  cursor: col-resize;
  touch-action: none;
}

.comparison-sidebar__resizer::before {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 4rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.2);
  content: '';
  transform: translate(-50%, -50%);
  transition: background-color 0.2s ease;
}

.comparison-sidebar__resizer:hover::before,
.comparison-sidebar__resizer:focus-visible::before {
  background: rgba(15, 23, 42, 0.45);
}

:global(.tippy-box[data-theme='comparison-hover']) {
  max-width: 24rem;
  background: #0f172a;
  color: #ffffff;
  font-size: 0.76rem;
  line-height: 1.4;
  white-space: pre-line;
}

:global(.tippy-box[data-theme='comparison-hover'] > .tippy-arrow) {
  color: #0f172a;
}

@media (max-width: 1180px) {
  .comparison-layout {
    grid-template-columns: 1fr;
  }

  .comparison-sidebar {
    width: auto;
    border-right: 0;
    border-bottom: 1px solid var(--viewsvg-panel-border);
  }

  .comparison-sidebar__resizer {
    display: none;
  }

  .comparison-list {
    max-height: 24vh;
  }
}
</style>
