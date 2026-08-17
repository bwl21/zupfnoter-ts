<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { extractSongConfig } from '@zupfnoter/core'
import { renderPdfComparison, renderWorkbenchComparison } from '../workbench/rendering/renderPipeline'
import { VERSION_COMPARE_REQUEST_KEY, loadVersionCompareRequest, type VersionCompareRequest } from '../workbench/versionComparison'

type CompareMode = 'side-by-side' | 'swipe' | 'blink'
type CompareKind = 'svg' | 'pdf' | 'notes' | 'abc' | 'config'

interface CompareChoice {
  id: string
  label: string
  extract?: number
}

interface ExtractInfo {
  extract: number
  label: string
  produced: boolean
}

interface UnknownRecord {
  [key: string]: unknown
}

const compareKinds: Array<{ id: CompareKind; label: string }> = [
  { id: 'svg', label: 'Harfen-SVG' },
  { id: 'pdf', label: 'Harfen-PDF' },
  { id: 'notes', label: 'Noten' },
  { id: 'abc', label: 'ABC' },
  { id: 'config', label: 'Konfig.' },
]

const request = ref<VersionCompareRequest>()
const kind = ref<CompareKind>('svg')
const selectedChoiceId = ref('')
const mode = ref<CompareMode>('side-by-side')
const swipePosition = ref(50)
const blinkVisible = ref<'reference' | 'comparison'>('reference')
const blinkPaused = ref(false)
const referenceSvg = ref('')
const comparisonSvg = ref('')
const referencePdfUrl = ref<string>()
const comparisonPdfUrl = ref<string>()
const loading = ref(false)
const error = ref('')
const referencePane = ref<HTMLElement | null>(null)
const comparisonPane = ref<HTMLElement | null>(null)
let synchronizingScroll = false
let blinkTimer: number | undefined
let renderGeneration = 0

const referenceTitle = computed(() => request.value?.referenceLabel ?? 'Referenz')
const comparisonTitle = computed(() => request.value?.comparisonLabel ?? 'Vergleich')
const kindLabel = computed(() => compareKinds.find((entry) => entry.id === kind.value)?.label ?? kind.value)
const choices = computed(() => commonChoices(request.value, kind.value))
const selectedChoice = computed(() => choices.value.find((choice) => choice.id === selectedChoiceId.value))
const hasVisualOutput = computed(() => kind.value === 'svg' || kind.value === 'pdf' || kind.value === 'notes')

function isCompareMode(value: string): value is CompareMode {
  return value === 'side-by-side' || value === 'swipe' || value === 'blink'
}

function isCompareKind(value: string): value is CompareKind {
  return compareKinds.some((entry) => entry.id === value)
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractInfos(abcText: string): ExtractInfo[] {
  try {
    const config = extractSongConfig(abcText)
    const configuredIds = Object.keys(config.extract ?? {})
      .filter((key) => /^\d+$/.test(key))
      .map((key) => Number(key))
    const producedIds = Array.isArray(config.produce)
      ? config.produce.filter((value): value is number => Number.isInteger(value))
      : []
    const produced = new Set(producedIds)
    return [...new Set([0, ...configuredIds, ...producedIds])]
      .sort((left, right) => left - right)
      .map((extract) => {
        const title = config.extract?.[String(extract)]?.title?.trim() ?? ''
        return {
          extract,
          label: title === '' ? String(extract) : `${extract} ${title}`,
          produced: produced.has(extract),
        }
      })
  } catch {
    return [{ extract: 0, label: '0', produced: false }]
  }
}

function configPaths(value: unknown, prefix = ''): string[] {
  if (!isRecord(value)) return prefix === '' ? [] : [prefix]
  const paths: string[] = []
  for (const [key, child] of Object.entries(value)) {
    const path = prefix === '' ? key : `${prefix}.${key}`
    if (isRecord(child)) paths.push(...configPaths(child, path))
    else paths.push(path)
  }
  return paths
}

function commonChoices(compareRequest: VersionCompareRequest | undefined, compareKind: CompareKind): CompareChoice[] {
  if (compareRequest === undefined) return []
  if (compareKind === 'abc') return [{ id: compareRequest.path, label: compareRequest.path }]
  if (compareKind === 'config') {
    try {
      const referencePaths = new Set(configPaths(extractSongConfig(compareRequest.referenceText)))
      return configPaths(extractSongConfig(compareRequest.comparisonText))
        .filter((path) => referencePaths.has(path))
        .map((path) => ({ id: path, label: path }))
    } catch {
      return []
    }
  }

  const referenceInfos = extractInfos(compareRequest.referenceText)
  const comparisonInfos = extractInfos(compareRequest.comparisonText)
  const comparisonByExtract = new Map(comparisonInfos.map((info) => [info.extract, info]))
  return referenceInfos
    .filter((referenceInfo) => comparisonByExtract.has(referenceInfo.extract))
    .map((referenceInfo) => {
      const comparisonInfo = comparisonByExtract.get(referenceInfo.extract)
      const label = referenceInfo.label === String(referenceInfo.extract)
        ? comparisonInfo?.label ?? referenceInfo.label
        : referenceInfo.label
      const produced = referenceInfo.produced || comparisonInfo?.produced === true
      return {
        id: String(referenceInfo.extract),
        label: produced ? `${label} · druckbar` : label,
        extract: referenceInfo.extract,
      }
    })
}

function updateKind(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLSelectElement) || !isCompareKind(target.value)) return
  kind.value = target.value
}

function updateChoice(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) return
  selectedChoiceId.value = target.value
}

function updateMode(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLSelectElement) || !isCompareMode(target.value)) return
  mode.value = target.value
}

function updateSwipe(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const value = Number(target.value)
  if (Number.isFinite(value)) swipePosition.value = Math.min(100, Math.max(0, value))
}

function toggleBlink(): void {
  blinkVisible.value = blinkVisible.value === 'reference' ? 'comparison' : 'reference'
}

function updateBlinkTimer(): void {
  if (blinkTimer !== undefined) {
    window.clearInterval(blinkTimer)
    blinkTimer = undefined
  }
  if (mode.value !== 'blink' || blinkPaused.value) return
  blinkTimer = window.setInterval(toggleBlink, 500)
}

function toggleBlinkPause(): void {
  blinkPaused.value = !blinkPaused.value
  updateBlinkTimer()
}

function syncPaneScroll(event: Event, counterpart: HTMLElement | null): void {
  if (synchronizingScroll) return
  const source = event.currentTarget
  if (!(source instanceof HTMLElement) || counterpart === null) return
  synchronizingScroll = true
  counterpart.scrollTop = source.scrollTop
  counterpart.scrollLeft = source.scrollLeft
  window.requestAnimationFrame(() => { synchronizingScroll = false })
}

function revokePdfUrls(): void {
  if (referencePdfUrl.value !== undefined) URL.revokeObjectURL(referencePdfUrl.value)
  if (comparisonPdfUrl.value !== undefined) URL.revokeObjectURL(comparisonPdfUrl.value)
  referencePdfUrl.value = undefined
  comparisonPdfUrl.value = undefined
}

async function renderSelectedChoice(): Promise<void> {
  const currentRequest = request.value
  const choice = selectedChoice.value
  const generation = ++renderGeneration
  revokePdfUrls()
  referenceSvg.value = ''
  comparisonSvg.value = ''
  error.value = ''
  if (currentRequest === undefined || choice === undefined || !hasVisualOutput.value) return

  loading.value = true
  try {
    const extract = choice.extract ?? currentRequest.extract
    if (kind.value === 'pdf') {
      const [referenceBlob, comparisonBlob] = await renderPdfComparison(
        currentRequest.referenceText,
        currentRequest.comparisonText,
        extract,
        'A3',
      )
      if (generation !== renderGeneration) return
      referencePdfUrl.value = URL.createObjectURL(referenceBlob)
      comparisonPdfUrl.value = URL.createObjectURL(comparisonBlob)
    } else {
      const { reference, comparison } = renderWorkbenchComparison(
        currentRequest.referenceText,
        currentRequest.comparisonText,
        extract,
      )
      if (generation !== renderGeneration) return
      const renderErrors = [
        reference.renderError === undefined ? undefined : `Referenz: ${reference.renderError}`,
        comparison.renderError === undefined ? undefined : `Vergleich: ${comparison.renderError}`,
      ].filter((message): message is string => message !== undefined)
      if (renderErrors.length > 0) throw new Error(renderErrors.join('\n'))
      const referenceMarkup = kind.value === 'notes' ? reference.scoreSvg : reference.harpSvg
      const comparisonMarkup = kind.value === 'notes' ? comparison.scoreSvg : comparison.harpSvg
      if (referenceMarkup.length === 0 || comparisonMarkup.length === 0) {
        throw new Error(`${kindLabel.value} konnte für diese Auswahl nicht erzeugt werden.`)
      }
      referenceSvg.value = referenceMarkup
      comparisonSvg.value = comparisonMarkup
    }
  } catch (reason) {
    if (generation === renderGeneration) error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    if (generation === renderGeneration) loading.value = false
  }
}

function renderRequest(nextRequest: VersionCompareRequest | undefined): void {
  request.value = nextRequest
  selectedChoiceId.value = ''
  referenceSvg.value = ''
  comparisonSvg.value = ''
  revokePdfUrls()
  error.value = ''
  void renderSelectedChoice()
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== VERSION_COMPARE_REQUEST_KEY) return
  renderRequest(loadVersionCompareRequest())
}

watch([request, kind], () => {
  const firstChoice = choices.value[0]
  if (firstChoice === undefined) {
    selectedChoiceId.value = ''
    void renderSelectedChoice()
    return
  }
  if (!choices.value.some((choice) => choice.id === selectedChoiceId.value)) {
    const currentExtractId = String(request.value?.extract ?? '')
    selectedChoiceId.value = choices.value.find((choice) => choice.id === currentExtractId)?.id ?? firstChoice.id
    return
  }
  void renderSelectedChoice()
})

watch(selectedChoiceId, () => { void renderSelectedChoice() })
watch([mode, blinkPaused], updateBlinkTimer)

onMounted(() => {
  renderRequest(loadVersionCompareRequest())
  window.addEventListener('storage', handleStorage)
  updateBlinkTimer()
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', handleStorage)
  if (blinkTimer !== undefined) window.clearInterval(blinkTimer)
  revokePdfUrls()
})
</script>

<template>
  <main class="version-compare">
    <aside class="version-compare__sidebar">
      <header class="version-compare__card">
        <p class="version-compare__kicker">Zupfnoter · Versionen</p>
        <h1>Vergleichen</h1>
        <p v-if="request" class="version-compare__path">{{ request.path || 'Aktuelles Stück' }}</p>
      </header>

      <section class="version-compare__card version-compare__card--selection">
        <h2>Visueller Vergleich</h2>
        <label><span>Vergleichsart</span><select :value="kind" @change="updateKind"><option v-for="entry in compareKinds" :key="entry.id" :value="entry.id">{{ entry.label }}</option></select></label>
        <label><span>Auswahl in beiden Versionen</span><select :value="selectedChoiceId" :disabled="choices.length === 0" @change="updateChoice"><option v-for="choice in choices" :key="choice.id" :value="choice.id">{{ choice.label }}</option></select></label>
        <p v-if="choices.length === 0" class="version-compare__hint">Diese Auswahl ist in beiden Versionen nicht vorhanden.</p>
        <p v-else class="version-compare__hint">{{ choices.length }} gemeinsame Auswahl{{ choices.length === 1 ? '' : 'en' }}</p>
      </section>

      <section class="version-compare__card">
        <h2>Versionen</h2>
        <div class="version-compare__version"><span>Referenz</span><strong>{{ referenceTitle }}</strong></div>
        <div class="version-compare__version"><span>Vergleich</span><strong>{{ comparisonTitle }}</strong></div>
        <div v-if="request" class="version-compare__meta">{{ kindLabel }} · {{ selectedChoice?.label ?? 'keine Auswahl' }}</div>
      </section>

      <section class="version-compare__card">
        <h2>Ansicht</h2>
        <label><span>Vergleichsmodus</span><select :value="mode" @change="updateMode"><option value="side-by-side">Nebeneinander</option><option value="swipe">Swipe</option><option value="blink">Alternierend</option></select></label>
        <label v-if="mode === 'swipe'"><span>Trennlinie</span><input :value="swipePosition" type="range" min="0" max="100" step="1" @input="updateSwipe"></label>
        <div v-if="mode === 'blink'" class="version-compare__blink-actions"><button type="button" @click="toggleBlinkPause">{{ blinkPaused ? 'Fortsetzen' : 'Pause' }}</button><button type="button" @click="toggleBlink">{{ blinkVisible === 'reference' ? 'Referenz' : 'Vergleich' }}</button></div>
      </section>

      <p v-if="loading" class="version-compare__status" role="status">Vergleich wird gerendert …</p>
      <p v-if="error" class="version-compare__error" role="alert">{{ error }}</p>
    </aside>

    <section class="version-compare__stage" aria-label="Versionsvergleich">
      <p v-if="!hasVisualOutput" class="version-compare__not-visual">{{ kindLabel }} ist als Auswahl vorbereitet. Die inhaltliche Gegenüberstellung folgt separat.</p>
      <div v-else-if="mode === 'side-by-side'" class="version-compare__side-by-side">
        <article ref="referencePane" @scroll="syncPaneScroll($event, comparisonPane)"><h2>{{ referenceTitle }}</h2><object v-if="kind === 'pdf' && referencePdfUrl" :data="referencePdfUrl" type="application/pdf" class="version-compare__pdf" aria-label="PDF der Referenzversion" /><div v-else-if="referenceSvg" v-html="referenceSvg" /></article>
        <article ref="comparisonPane" @scroll="syncPaneScroll($event, referencePane)"><h2>{{ comparisonTitle }}</h2><object v-if="kind === 'pdf' && comparisonPdfUrl" :data="comparisonPdfUrl" type="application/pdf" class="version-compare__pdf" aria-label="PDF der Vergleichsversion" /><div v-else-if="comparisonSvg" v-html="comparisonSvg" /></article>
      </div>
      <div v-else class="version-compare__single">
        <article :class="{ 'is-visible': mode !== 'blink' || blinkVisible === 'reference' }" :aria-hidden="mode === 'blink' && blinkVisible !== 'reference'"><h2>{{ referenceTitle }}</h2><object v-if="kind === 'pdf' && referencePdfUrl" :data="referencePdfUrl" type="application/pdf" class="version-compare__pdf" aria-label="PDF der Referenzversion" /><div v-else-if="referenceSvg" v-html="referenceSvg" /></article>
        <article class="version-compare__comparison-layer" :class="{ 'is-visible': mode !== 'blink' || blinkVisible === 'comparison' }" :style="mode === 'swipe' ? { clipPath: `inset(0 ${100 - swipePosition}% 0 0)` } : undefined" :aria-hidden="mode === 'blink' && blinkVisible !== 'comparison'"><h2>{{ comparisonTitle }}</h2><object v-if="kind === 'pdf' && comparisonPdfUrl" :data="comparisonPdfUrl" type="application/pdf" class="version-compare__pdf" aria-label="PDF der Vergleichsversion" /><div v-else-if="comparisonSvg" v-html="comparisonSvg" /></article>
        <div v-if="mode === 'swipe'" class="version-compare__swipe-handle" :style="{ left: `${swipePosition}%` }" />
      </div>
    </section>
  </main>
</template>

<style scoped>
.version-compare{display:grid;grid-template-columns:minmax(19rem,24rem) minmax(0,1fr);min-height:100vh;background:#e2e8f0;color:#24364d}.version-compare__sidebar{display:flex;flex-direction:column;gap:1rem;box-sizing:border-box;padding:1rem;border-right:1px solid #b8c5d5;background:rgba(255,255,255,.98);overflow:auto}.version-compare__card{display:grid;gap:.7rem;padding:1rem;border:1px solid #c8d3e0;border-radius:.8rem;background:#f8fafc;box-shadow:0 8px 24px rgba(36,54,77,.08)}.version-compare__card--selection{background:#eef5fc;border-color:#9fb9d4}.version-compare__kicker{margin:0 0 .35rem;color:#3269a8;font-size:.76rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.version-compare h1,.version-compare h2{margin:0}.version-compare h1{font-size:1.45rem}.version-compare h2{font-size:1rem}.version-compare__path{margin:.55rem 0 0;overflow-wrap:anywhere;color:#526982;font-size:.82rem}.version-compare__version{display:grid;gap:.15rem}.version-compare__version span,.version-compare__meta,.version-compare label span,.version-compare__hint{color:#526982;font-size:.78rem}.version-compare__version strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}.version-compare label{display:grid;gap:.3rem}.version-compare select,.version-compare input{width:100%;box-sizing:border-box;padding:.45rem;border:1px solid #b8c5d5;border-radius:.4rem;background:white;color:inherit;font:inherit}.version-compare__hint,.version-compare__status,.version-compare__error,.version-compare__not-visual{margin:0}.version-compare__blink-actions{display:flex;gap:.45rem}.version-compare button{padding:.4rem .65rem;border:1px solid #9eb2c9;border-radius:.4rem;background:white;color:inherit;font:inherit;cursor:pointer}.version-compare button:hover{background:#e7eef7}.version-compare__status{color:#3269a8;font-size:.82rem}.version-compare__error{padding:.7rem;border:1px solid #e8a4a4;border-radius:.4rem;color:#a52626;background:#fff5f5}.version-compare__stage{min-width:0;min-height:100vh;padding:1rem;overflow:auto}.version-compare__side-by-side{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;min-width:0}.version-compare__side-by-side article,.version-compare__single article{min-width:0;padding:.8rem;border:1px solid #c8d3e0;border-radius:.8rem;background:#fff;box-shadow:0 8px 24px rgba(36,54,77,.08)}.version-compare__side-by-side h2,.version-compare__single h2{padding-bottom:.6rem;border-bottom:1px solid #d6dee8}.version-compare__side-by-side :deep(svg),.version-compare__single :deep(svg){display:block;width:100%;height:auto}.version-compare__pdf{display:block;width:100%;height:calc(100vh - 7rem);min-height:40rem;border:0}.version-compare__single{position:relative;min-height:calc(100vh - 2rem);overflow:hidden}.version-compare__single article{position:absolute;inset:0;overflow:auto}.version-compare__single article:not(.is-visible){visibility:hidden}.version-compare__comparison-layer{z-index:2}.version-compare__swipe-handle{position:absolute;z-index:3;top:0;bottom:0;width:2px;transform:translateX(-1px);background:#3269a8;pointer-events:none}.version-compare__single article:first-child{z-index:1}.version-compare__single article.is-visible{visibility:visible}.version-compare__not-visual{padding:2rem;color:#526982}@media(max-width:60rem){.version-compare{grid-template-columns:1fr}.version-compare__sidebar{border-right:0;border-bottom:1px solid #b8c5d5}.version-compare__stage{min-height:70vh}.version-compare__single{min-height:70vh}}@media(max-width:42rem){.version-compare__side-by-side{grid-template-columns:1fr}}
.version-compare__side-by-side article{max-height:calc(100vh - 2rem);overflow:auto}
</style>
