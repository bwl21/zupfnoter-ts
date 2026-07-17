<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import ComparisonLayout, { type ComparisonCase, type ComparisonViewMode } from '@/components/ComparisonLayout.vue'
import {
  fetchViewPdfCases,
  getPdfCaseLabel,
  viewPdfUrl,
  type ViewPdfCaseDetails,
} from '@/lib/viewPdfApi'

const cases = ref<ViewPdfCaseDetails[]>([])
const selectedCaseId = ref('')
const selectedExtract = ref(0)
const selectedMode = ref<ComparisonViewMode>('blink')
const swipePosition = ref(50)
const blinkVisible = ref<'legacy' | 'ts'>('legacy')
const loading = ref(false)
const error = ref<string | null>(null)

const selectedCase = computed(() => cases.value.find((caseItem) => caseItem.id === selectedCaseId.value) ?? null)
const sidebarCases = computed<ComparisonCase[]>(() => cases.value.map((caseItem) => ({
  id: caseItem.id,
  label: getPdfCaseLabel(caseItem),
})))

const availableExtracts = computed(() => {
  const caseItem = selectedCase.value
  if (caseItem === null) return [] as number[]
  return [...new Set([...caseItem.legacyExtracts, ...caseItem.tsExtracts])].sort((left, right) => left - right)
})

const legacyPdfUrl = computed(() => {
  const caseItem = selectedCase.value
  if (caseItem === null || !caseItem.legacyExtracts.includes(selectedExtract.value)) return null
  return viewPdfUrl(caseItem.id, 'legacy', selectedExtract.value)
})

const tsPdfUrl = computed(() => {
  const caseItem = selectedCase.value
  if (caseItem === null || !caseItem.tsExtracts.includes(selectedExtract.value)) return null
  return viewPdfUrl(caseItem.id, 'ts', selectedExtract.value)
})

const visibleBlinkLabel = computed(() => (blinkVisible.value === 'legacy' ? 'Legacy' : 'TS'))

function selectCase(caseId: string): void {
  selectedCaseId.value = caseId
}

function selectFirstAvailableExtract(): void {
  const firstExtract = availableExtracts.value[0]
  if (firstExtract !== undefined && !availableExtracts.value.includes(selectedExtract.value)) {
    selectedExtract.value = firstExtract
  }
}

async function loadCases(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const loadedCases = await fetchViewPdfCases()
    cases.value = loadedCases
    if (selectedCaseId.value === '' && loadedCases.length > 0) {
      const firstCase = loadedCases[0]
      if (firstCase !== undefined) selectedCaseId.value = firstCase.id
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    loading.value = false
  }
}

watch(selectedCaseId, () => {
  selectFirstAvailableExtract()
})

watch([legacyPdfUrl, tsPdfUrl], ([legacyPdf, tsPdf]) => {
  if (blinkVisible.value === 'legacy' && legacyPdf === null && tsPdf !== null) {
    blinkVisible.value = 'ts'
  }
  if (blinkVisible.value === 'ts' && tsPdf === null && legacyPdf !== null) {
    blinkVisible.value = 'legacy'
  }
})

function toggleBlinkVisible(): void {
  const nextSource = blinkVisible.value === 'legacy' ? 'ts' : 'legacy'
  if (nextSource === 'legacy' && legacyPdfUrl.value !== null) blinkVisible.value = nextSource
  if (nextSource === 'ts' && tsPdfUrl.value !== null) blinkVisible.value = nextSource
}

onMounted(async () => {
  await loadCases()
  selectFirstAvailableExtract()
})
</script>

<template>
  <ComparisonLayout
    format="PDF"
    :case-items="sidebarCases"
    :selected-case-id="selectedCaseId"
    :selected-extract="selectedExtract"
    :available-extracts="availableExtracts"
    :selected-mode="selectedMode"
    :swipe-position="swipePosition"
    :has-legacy="legacyPdfUrl !== null"
    :has-ts="tsPdfUrl !== null"
    :hover-available="false"
    :hover-active="false"
    hover-tooltip="Hover-Inspektion ist für PDFs noch nicht verfügbar."
    :prompt-active="false"
    :loading="loading"
    :error="error"
    @select-case="selectCase"
    @update:selected-extract="selectedExtract = $event"
    @update:selected-mode="selectedMode = $event"
    @update:swipe-position="swipePosition = $event"
  >

    <section class="viewpdf-stage" :class="`viewpdf-stage--${selectedMode}`" aria-label="PDF-Vergleich">
      <article
        class="viewpdf-pane viewpdf-pane--legacy"
        :class="{ 'is-visible': selectedMode !== 'blink' || blinkVisible === 'legacy' }"
        :aria-hidden="selectedMode === 'blink' && blinkVisible !== 'legacy'"
      >
        <h2>Legacy</h2>
        <object v-if="legacyPdfUrl !== null" :data="legacyPdfUrl" type="application/pdf" class="viewpdf-document">
          <a :href="legacyPdfUrl" target="_blank" rel="noopener">Legacy-PDF öffnen</a>
        </object>
        <p v-else class="viewpdf-empty">Für diesen Extrakt liegt kein Legacy-PDF vor.</p>
      </article>
      <article
        class="viewpdf-pane viewpdf-pane--ts"
        :class="{ 'is-visible': selectedMode !== 'blink' || blinkVisible === 'ts' }"
        :style="selectedMode === 'swipe' ? { clipPath: `inset(0 ${100 - swipePosition}% 0 0)` } : undefined"
        :aria-hidden="selectedMode === 'blink' && blinkVisible !== 'ts'"
      >
        <h2>TS</h2>
        <object v-if="tsPdfUrl !== null" :data="tsPdfUrl" type="application/pdf" class="viewpdf-document">
          <a :href="tsPdfUrl" target="_blank" rel="noopener">TS-PDF öffnen</a>
        </object>
        <p v-else class="viewpdf-empty">Für diesen Extrakt liegt kein TS-PDF vor.</p>
      </article>
      <div v-if="selectedMode === 'swipe'" class="viewpdf-swipe__handle" :style="{ left: `${swipePosition}%` }" />
      <div v-if="selectedMode === 'blink'" class="viewpdf-blink__legend" role="note" aria-label="Blink mode guide">
        <button
          type="button"
          class="viewpdf-blink__toggle"
          :class="{ 'is-legacy': blinkVisible === 'legacy', 'is-ts': blinkVisible === 'ts' }"
          @click="toggleBlinkVisible"
        >
          {{ visibleBlinkLabel }}
        </button>
      </div>
    </section>
  </ComparisonLayout>
</template>

<style scoped>
.viewpdf-pane {
  border: 1px solid var(--viewsvg-panel-border);
  border-radius: 0.8rem;
  background: var(--viewsvg-panel);
  box-shadow: var(--viewsvg-shadow);
}

.viewpdf-pane h2 {
  margin: 0;
}

.viewpdf-stage {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  min-width: 0;
  min-height: 100vh;
  padding: 1rem;
  background: #e2e8f0;
}

.viewpdf-stage--swipe,
.viewpdf-stage--blink {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  position: relative;
  overflow: hidden;
}

.viewpdf-stage--swipe .viewpdf-pane,
.viewpdf-stage--blink .viewpdf-pane {
  grid-column: 1;
  grid-row: 1;
  z-index: 0;
}

.viewpdf-stage--swipe .viewpdf-pane--ts {
  z-index: 1;
}

.viewpdf-stage--blink .viewpdf-pane {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.viewpdf-stage--blink .viewpdf-pane.is-visible {
  opacity: 1;
  pointer-events: auto;
  z-index: 1;
}

.viewpdf-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
}

.viewpdf-pane h2 {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--viewsvg-panel-border);
  font-size: 1rem;
}

.viewpdf-document {
  width: 100%;
  height: calc(100vh - 5rem);
  min-height: 42rem;
  border: 0;
}

.viewpdf-empty {
  display: grid;
  place-items: center;
  margin: 0;
  padding: 2rem;
  color: var(--viewsvg-subtext);
  text-align: center;
}

.viewpdf-swipe__handle {
  position: absolute;
  top: 1rem;
  bottom: 1rem;
  z-index: 2;
  width: 2px;
  background: #000000;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.95),
    0 0 24px rgba(0, 0, 0, 0.16);
  transform: translateX(-1px);
  pointer-events: none;
}

.viewpdf-blink__legend {
  position: absolute;
  left: 2rem;
  bottom: 2rem;
  z-index: 2;
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
}

.viewpdf-blink__toggle {
  padding: 0.3rem 0.65rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--viewsvg-text);
  font-weight: 700;
}

.viewpdf-blink__toggle.is-legacy,
.viewpdf-blink__toggle.is-ts {
  background: var(--viewsvg-accent);
  color: #ffffff;
}

@media (max-width: 1180px) {
  .viewpdf-stage {
    min-height: auto;
  }
}

@media (max-width: 760px) {
  .viewpdf-stage {
    grid-template-columns: 1fr;
  }

  .viewpdf-document {
    height: 70vh;
    min-height: 30rem;
  }
}
</style>
