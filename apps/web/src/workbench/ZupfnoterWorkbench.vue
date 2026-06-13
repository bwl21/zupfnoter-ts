<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  ZnBadge,
  ZnButton,
  ZnSplitPane,
  ZnTabs,
  ZnToolbar,
} from '../design-system/index'
import AbcEditorPanel from './panels/AbcEditorPanel.vue'
import ConfigEditorPanel from './panels/ConfigEditorPanel.vue'
import ConsolePanel from './panels/ConsolePanel.vue'
import FooterBar from './FooterBar.vue'
import HarpPreviewPanel from './panels/HarpPreviewPanel.vue'
import LyricsPanel from './panels/LyricsPanel.vue'
import ScorePreviewPanel from './panels/ScorePreviewPanel.vue'
import {
  DEFAULT_ABC,
  renderWorkbenchPreviews,
  type RenderIssue,
} from './rendering/renderPipeline'
import { extractSongConfig } from '@zupfnoter/core'
import type { WorkbenchDiagnostic } from './diagnostics'
import type { EditorDiagnostic } from './panels/abcEditorCodeMirror'
import WorkbenchToastStack from './toasts/WorkbenchToastStack.vue'
import { useWorkbenchToasts } from './toasts/useWorkbenchToasts'
import WorkbenchLayout from './WorkbenchLayout.vue'
import { usePlaybackStore } from '../stores/playback'
import { useSelectionStore } from '../stores/selection'
import { usePlaybackDriver } from './usePlaybackDriver'
import { useAudioPlayer } from './useAudioPlayer'
import type { PlaybackStep } from './playback'
import { CommandError, CommandStack, registerLegacyCommands } from '@zupfnoter/core'
import type { ConsoleLogEntry, ConsoleLogKind } from './consoleLog'
import {
  canTargetCreateSelection,
  resolvePlaybackProjection,
  resolvePlaybackScoreRanges,
  resolveSelectionEditorRange,
  resolveSelectionProjection,
} from './selectionManager'

const editorTab = ref('abc')
const editorPaneSize = ref(54)
const previewPaneSize = ref(62)
const harpZoom = ref(100)
const abcText = ref(DEFAULT_ABC)
const currentExtract = ref(0)
const saveFormat = ref('A3-A4')
const logLevel = ref('warning')
const autoRefresh = ref<'on' | 'off' | 'remote'>('on')
const runtimeSettings = ref<Record<string, string>>({
  autoscroll: 'true',
  flowconf: 'false',
  follow: 'true',
  validate: 'true',
})
const extractPickerOpen = ref(false)
let nextConsoleEntryId = 1
const consoleLines = ref<ConsoleLogEntry[]>([{
  id: nextConsoleEntryId,
  kind: 'info',
  message: 'command stack ready',
}])
const scoreSvg = ref('')
const harpSvg = ref('')
const renderIssues = ref<RenderIssue[]>([])
const workbenchDiagnostics = ref<WorkbenchDiagnostic[]>([])
const editorDiagnostics = ref<EditorDiagnostic[]>([])
const editorCursor = ref('01:01')
const renderError = ref('')
const renderSummary = ref('not rendered')
const playbackTimeline = ref<PlaybackStep[]>([])
const baseTempoFromQ = ref<number | undefined>(undefined)
const { toasts, syncDiagnostics, dismissToast } = useWorkbenchToasts()
const playbackStore = usePlaybackStore()
const selectionStore = useSelectionStore()
const selectedHarpProjection = computed(() => resolveSelectionProjection(
  selectionStore.sheetObjectIndex,
  selectionStore.selection,
  'harp-preview',
))
const projectedPlaybackHighlight = computed(() => resolvePlaybackProjection(
  selectionStore.sheetObjectIndex,
  playbackStore.highlight,
  'harp-preview',
))
const selectedScoreTextRanges = computed(() => resolveSelectionProjection(
  selectionStore.sheetObjectIndex,
  selectionStore.selection,
  'score-preview',
).textRanges)
const selectedEditorTextRange = computed(() => selectionStore.selection.source === 'abc-editor'
  ? undefined
  : resolveSelectionEditorRange(selectionStore.sheetObjectIndex, selectionStore.selection))
const playbackScoreTextRanges = computed(() => resolvePlaybackScoreRanges(
  selectionStore.sheetObjectIndex,
  playbackStore.highlight,
))
const audioPlayer = useAudioPlayer()
const { toggle: togglePlayback, stop: stopPlayback } = usePlaybackDriver(
  playbackStore,
  computed(() => selectionStore.selection),
  computed(() => selectionStore.sheetObjectIndex),
  computed(() => ({
    timeline: playbackTimeline.value,
    baseTempoFromQ: baseTempoFromQ.value,
  })),
  audioPlayer,
)

const renderIssueLabel = computed(() => {
  if (renderError.value) return 'Render error'
  const warnings = [
    ...renderIssues.value,
    ...workbenchDiagnostics.value,
  ].filter((issue) => issue.severity === 'warning').length
  const errors = [
    ...renderIssues.value,
    ...workbenchDiagnostics.value,
  ].filter((issue) => issue.severity === 'error').length
  if (errors > 0) return `${errors} error(s)`
  if (warnings > 0) return `${warnings} warning(s)`
  return 'Rendered'
})

const renderIssueTone = computed(() => {
  if (renderError.value) return 'danger'
  const issues = [...renderIssues.value, ...workbenchDiagnostics.value]
  if (issues.some((issue) => issue.severity === 'error')) return 'danger'
  if (issues.some((issue) => issue.severity === 'warning')) return 'warning'
  return 'success'
})

const playbackStatusOverlay = computed(() => {
  if (playbackStore.state.status !== 'playing') return undefined
  const passIndex = playbackStore.highlight.passIndex
  if (passIndex === undefined) return undefined

  const passParts = [`Durchlauf ${passIndex}`]
  if (playbackStore.state.totalPassCount !== undefined && playbackStore.state.totalPassCount > 1) {
    passParts[0] = `Durchlauf ${passIndex}/${playbackStore.state.totalPassCount}`
  }

  if (playbackStore.highlight.voltaNumber !== undefined) {
    passParts.push(`Volte ${playbackStore.highlight.voltaNumber}`)
  }

  return passParts.join(' · ')
})

const previewErrorMessage = computed(() => {
  return renderError.value
})

const extractMenuItems = computed(() => {
  const extractConfig = extractSongConfig(abcText.value).extract ?? {}
  const extractNumbers = new Set<number>([currentExtract.value])
  Object.keys(extractConfig).forEach((key) => {
    const extractNumber = Number.parseInt(key, 10)
    if (Number.isFinite(extractNumber)) extractNumbers.add(extractNumber)
  })
  return [...extractNumbers]
    .sort((left, right) => left - right)
    .map((extractNumber) => {
      const extract = extractConfig[String(extractNumber)]
      const title = extract?.title?.trim() || ''
      const hasPrinter = extract?.printer !== undefined
      const label = title === '' ? `${extractNumber}` : `${extractNumber} ${title}`
      return {
        extractNumber,
        title,
        hasPrinter,
        label,
        tooltip: title === ''
          ? `${extractNumber}${hasPrinter ? ' · printer' : ''}`
          : `${extractNumber} · ${title}${hasPrinter ? ' · printer' : ''}`,
      }
    })
})

const currentExtractLabel = computed(() => {
  const currentItem = extractMenuItems.value.find((item) => item.extractNumber === currentExtract.value)
  return currentItem?.label ?? `${currentExtract.value}`
})

const currentExtractTooltip = computed(() => {
  const currentItem = extractMenuItems.value.find((item) => item.extractNumber === currentExtract.value)
  if (currentItem === undefined) return `${currentExtract.value}`
  return currentItem.tooltip
})

const produceExtracts = computed(() => {
  const config = extractSongConfig(abcText.value)
  const produce = config.produce
  return Array.isArray(produce)
    ? new Set(produce.filter((value): value is number => typeof value === 'number'))
    : new Set<number>()
})

let renderTimer: ReturnType<typeof setTimeout> | undefined
let commandStack: CommandStack

function appendConsoleLine(message: string, kind: ConsoleLogKind = 'output'): void {
  nextConsoleEntryId += 1
  consoleLines.value = [...consoleLines.value.slice(-199), {
    id: nextConsoleEntryId,
    kind,
    message,
  }]
}

function timestampLabel(): string {
  return new Date().toLocaleTimeString('de-DE', { hour12: false })
}

function appendPipelineLine(message: string): void {
  appendConsoleLine(`${timestampLabel()}  ${message}`, 'info')
}

function appendDiagnosticLine(message: string, severity: 'warning' | 'error', source?: string): void {
  const prefix = source === undefined || source === ''
    ? ''
    : `${source}: `
  appendConsoleLine(`${timestampLabel()}  ${prefix}${message}`, severity === 'error' ? 'error' : 'info')
}

function renderNow(): void {
  try {
    const startedAt = performance.now()
    appendPipelineLine(`worker: render extract ${currentExtract.value}`)
    const result = renderWorkbenchPreviews(abcText.value, currentExtract.value)
    scoreSvg.value = result.scoreSvg
    harpSvg.value = result.harpSvg
    selectionStore.setSheetObjectIndex(result.sheetObjectIndex)
    renderIssues.value = result.issues
    workbenchDiagnostics.value = result.diagnostics
    editorDiagnostics.value = result.editorDiagnostics
    playbackTimeline.value = result.playbackTimeline
    baseTempoFromQ.value = result.baseTempoFromQ
    syncDiagnostics(result.toastDiagnostics)
    for (const issue of result.issues) {
      appendDiagnosticLine(issue.message, issue.severity, 'abc-parser')
    }
    for (const diagnostic of result.toastDiagnostics) {
      appendDiagnosticLine(diagnostic.message, diagnostic.severity, diagnostic.source)
    }
    for (const diagnostic of result.editorDiagnostics) {
      appendDiagnosticLine(`line ${diagnostic.line}: ${diagnostic.message}`, diagnostic.severity, diagnostic.source)
    }
    renderSummary.value = result.summary
    renderError.value = result.renderError ?? ''
    appendPipelineLine(`worker: render complete in ${(performance.now() - startedAt).toFixed(3)} sec`)
  } catch (error) {
    appendPipelineLine(`worker: render failed: ${error instanceof Error ? error.message : String(error)}`)
    renderError.value = error instanceof Error ? error.message : String(error)
    renderSummary.value = 'render failed'
  }
}

function executeCommand(command: string): void {
  appendConsoleLine(command, 'command')
  try {
    commandStack.runString(command)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    appendConsoleLine(message, 'error')
  }
}

function executeToolbarCommand(command: string): void {
  appendConsoleLine(command, 'command')
  try {
    commandStack.runString(command)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    appendConsoleLine(message, 'error')
  }
}

function setAbcFromCommand(value: string): void {
  abcText.value = value
}

function playFromCommand(range: string): void {
  if (!['auto', 'sel', 'ff', 'all'].includes(range)) {
    throw new CommandError(`Unsupported playback range: ${range}`)
  }
  togglePlayback()
}

function setCurrentExtractFromCommand(extract: number): void {
  currentExtract.value = Math.trunc(extract)
  playbackStore.setActiveExtract(currentExtract.value)
  extractPickerOpen.value = false
}

function downloadAbc(): void {
  const blob = new Blob([abcText.value], { type: 'text/vnd.abc;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'zupfnoter.abc'
  link.click()
  URL.revokeObjectURL(url)
}

function localStoreKey(id: string): string {
  return `zupfnoter.song.${id}`
}

function saveToLocalStore(): void {
  const id = extractAbcId(abcText.value)
  localStorage.setItem(localStoreKey(id), abcText.value)
  appendConsoleLine(`saved ${id} to local storage`, 'info')
}

function listLocalStore(): string[] {
  const entries: string[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (key === null || !key.startsWith('zupfnoter.song.')) continue
    entries.push(key.replace('zupfnoter.song.', ''))
  }
  return entries.sort()
}

function openFromLocalStore(id: string): string | undefined {
  return localStorage.getItem(localStoreKey(id)) ?? undefined
}

function extractAbcId(value: string): string {
  const idLine = value.split('\n').find((line) => line.startsWith('X:'))
  const id = idLine?.slice(2).trim()
  return id === undefined || id === '' ? 'untitled' : id
}

commandStack = new CommandStack({
  log: appendConsoleLine,
})

registerLegacyCommands(commandStack, {
  getAbcText: () => abcText.value,
  setAbcText: setAbcFromCommand,
  render: renderNow,
  play: playFromCommand,
  stop: stopPlayback,
  setSpeed: playbackStore.setSpeedFactor,
  setEditorTab: (tab) => {
    editorTab.value = tab
  },
  setCurrentExtract: setCurrentExtractFromCommand,
  setSaveFormat: (value) => {
    saveFormat.value = value
  },
  setLogLevel: (value) => {
    logLevel.value = value
  },
  setAutoRefresh: (value) => {
    autoRefresh.value = value
  },
  setSetting: (key, value) => {
    runtimeSettings.value = { ...runtimeSettings.value, [key]: value }
  },
  getSetting: (key) => runtimeSettings.value[key],
  listSettings: () => ({ ...runtimeSettings.value }),
  downloadAbc,
  listLocalStore,
  saveLocalStore: saveToLocalStore,
  openLocalStore: openFromLocalStore,
})

function handleEditorCursorChange(position: { line: number, column: number }): void {
  const line = String(position.line).padStart(2, '0')
  const column = String(position.column).padStart(2, '0')
  editorCursor.value = `${line}:${column}`
}

function handleEditorSelectionChange(payload: {
  startpos: number
  endpos: number
  start: { line: number; column: number }
  end: { line: number; column: number }
}): void {
  if (payload.startpos === payload.endpos) {
    selectionStore.clearSelection('abc-editor')
    return
  }

  selectionStore.selectTextRange(payload.startpos, payload.endpos, 'abc-editor')
}

watch(abcText, () => {
  playbackStore.markDocumentChanged()
  stopPlayback()
  if (autoRefresh.value === 'off') return
  if (renderTimer !== undefined) {
    clearTimeout(renderTimer)
  }
  renderTimer = setTimeout(renderNow, 250)
}, { immediate: true })

function handleHarpPreviewSelection(payload: {
  startpos: number
  endpos: number
  extend: boolean
  source: 'harp-preview'
}): void {
  if (!canTargetCreateSelection(payload.source, 'textRange')) return
  selectionStore.selectTextRange(payload.startpos, payload.endpos, payload.source)
}

function handleScorePreviewSelection(payload: {
  startpos: number
  endpos: number
  extend: boolean
  source: 'score-preview'
}): void {
  if (!canTargetCreateSelection(payload.source, 'textRange')) return
  if (payload.extend) {
    selectionStore.selectTextRange(payload.startpos, payload.endpos, payload.source)
    return
  }

  selectionStore.selectTextRange(payload.startpos, payload.endpos, payload.source)
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (!event.ctrlKey && !event.metaKey) return
  if (event.key === 'r' || event.key === 'R' || event.key === 'Enter') {
    event.preventDefault()
    executeToolbarCommand('render')
    return
  }
  if (event.key === 'p' || event.key === 'P') {
    event.preventDefault()
    executeToolbarCommand('p auto')
    return
  }
  if (event.key === 'k' || event.key === 'K') {
    event.preventDefault()
    editorTab.value = editorTab.value === 'console' ? 'abc' : 'console'
    return
  }
  if (/^\d$/.test(event.key)) {
    event.preventDefault()
    executeToolbarCommand(`view ${event.key}`)
  }
}

function chooseExtract(extractNumber: number): void {
  executeToolbarCommand(`view ${extractNumber}`)
  extractPickerOpen.value = false
}

function handleExtractPickerToggle(event: Event): void {
  const target = event.currentTarget
  if (!(target instanceof HTMLDetailsElement)) return
  extractPickerOpen.value = target.open
}

function isExtractProduced(extractNumber: number): boolean {
  return produceExtracts.value.has(extractNumber)
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  if (renderTimer !== undefined) {
    clearTimeout(renderTimer)
  }
})
</script>

<template>
  <WorkbenchLayout>
    <template #header>
      <section class="workbench-chrome">
        <ZnToolbar>
          <template #leading>
            <ZnButton variant="ghost" @click="executeToolbarCommand('help')">Datei</ZnButton>
            <ZnButton variant="ghost" @click="executeToolbarCommand('c 1 untitled')">Neu</ZnButton>
            <ZnButton variant="ghost">DI abc</ZnButton>
            <ZnButton variant="ghost">Dropbox</ZnButton>
            <ZnButton variant="ghost" @click="executeToolbarCommand('dlogin')">Einloggen</ZnButton>
            <ZnButton variant="ghost" @click="executeToolbarCommand('dchoose')">Öffnen</ZnButton>
            <ZnButton variant="primary" @click="executeToolbarCommand('lsave')">Speichern</ZnButton>
            <ZnButton variant="ghost" @click="executeToolbarCommand('togglesetting flowconf')">Extras</ZnButton>
          </template>
          <template #default />
          <template #trailing>
            <ZnButton variant="ghost">Drucken</ZnButton>
            <ZnButton variant="ghost">Ansicht</ZnButton>
            <details class="extract-picker" :open="extractPickerOpen" @toggle="handleExtractPickerToggle">
              <summary
                class="extract-picker__summary"
                :class="{ 'extract-picker__summary--active': isExtractProduced(currentExtract) }"
                :title="currentExtractTooltip"
                aria-label="Select extract"
              >
                <span class="extract-picker__icon" :class="{ 'extract-picker__icon--produced': isExtractProduced(currentExtract) }" aria-hidden="true">
                  {{ currentExtract }}
                </span>
                <span class="extract-picker__text">
                  <span class="extract-picker__title">{{ currentExtractLabel.replace(/^\d+\s*/, '') }}</span>
                </span>
              </summary>
              <div class="extract-picker__menu" role="menu" :aria-label="currentExtractTooltip">
                <button
                  v-for="item in extractMenuItems"
                  :key="item.extractNumber"
                  type="button"
                  class="extract-picker__item"
                  :class="{
                    'extract-picker__item--active': item.extractNumber === currentExtract,
                    'extract-picker__item--produced': isExtractProduced(item.extractNumber),
                  }"
                  :title="item.tooltip"
                  @click="chooseExtract(item.extractNumber)"
                >
                  <span class="extract-picker__item-icon" :class="{ 'extract-picker__item-icon--produced': isExtractProduced(item.extractNumber) }" aria-hidden="true">
                    {{ item.extractNumber }}
                  </span>
                  <span class="extract-picker__item-text">{{ item.label }}</span>
                </button>
              </div>
            </details>
            <ZnButton variant="ghost" @click="executeToolbarCommand('render')">Rendern</ZnButton>
            <ZnButton
              :variant="playbackStore.state.status === 'playing' ? 'primary' : 'ghost'"
              :aria-pressed="playbackStore.state.status === 'playing'"
              @click="executeToolbarCommand('p auto')"
            >
              {{ playbackStore.state.status === 'playing' ? 'Stop' : 'Play' }}
            </ZnButton>
            <ZnBadge :tone="renderIssueTone">{{ renderIssueLabel }}</ZnBadge>
            <ZnButton variant="ghost" @click="executeToolbarCommand('help')">Hilfe</ZnButton>
          </template>
        </ZnToolbar>
      </section>
    </template>

    <template #workspace>
      <ZnSplitPane
        v-model:primary-size="editorPaneSize"
        :min-primary-size="12"
        :max-primary-size="88"
      >
        <template #primary>
          <div class="editor-pane">
            <ZnToolbar>
              <template #leading>
                <ZnButton variant="ghost">Bearbeiten</ZnButton>
                <ZnButton variant="ghost" @click="executeToolbarCommand('adddecoration !fermata!')">Dekoration einfügen</ZnButton>
                <ZnButton variant="ghost" @click="executeToolbarCommand('addsnippet note')">Zusatz einfügen</ZnButton>
                <ZnButton variant="ghost" @click="executeToolbarCommand('editsnippet')">Zusatz bearbeiten</ZnButton>
                <ZnButton variant="ghost" @click="executeToolbarCommand('editconf basic_settings')">Konfig. bearb.</ZnButton>
              </template>
            </ZnToolbar>

            <ZnTabs v-model="editorTab" :items="[
              { id: 'abc', label: 'ABC-Notation' },
              { id: 'lyrics', label: 'Liedtexte' },
              { id: 'config', label: 'Konfiguration' },
              { id: 'console', label: 'Konsole' },
            ]">
              <template #default="{ activeId }">
                <AbcEditorPanel
                  v-if="activeId === 'abc'"
                  v-model="abcText"
                  :diagnostics="editorDiagnostics"
                  :playback-highlight="projectedPlaybackHighlight"
                  :selected-text-range="selectedEditorTextRange"
                  @cursor-change="handleEditorCursorChange"
                  @selection-change="handleEditorSelectionChange"
                />
                <LyricsPanel v-else-if="activeId === 'lyrics'" />
                <ConfigEditorPanel v-else-if="activeId === 'config'" />
                <ConsolePanel
                  v-else
                  :lines="consoleLines"
                  @execute="executeCommand"
                />
              </template>
            </ZnTabs>
          </div>
        </template>

        <template #secondary>
          <div class="preview-pane">
            <ZnSplitPane
              orientation="vertical"
              v-model:primary-size="previewPaneSize"
              :min-primary-size="12"
              :max-primary-size="88"
              :handle-size="14"
            >
              <template #primary>
                <ScorePreviewPanel
                  :error-message="previewErrorMessage"
                  :playback-text-ranges="playbackScoreTextRanges"
                  :selected-text-ranges="selectedScoreTextRanges"
                  :svg="scoreSvg"
                  @select-text-range="handleScorePreviewSelection"
                />
              </template>
              <template #secondary>
                <HarpPreviewPanel
                  v-model:zoom="harpZoom"
                  :error-message="previewErrorMessage"
                  :playback-highlight="projectedPlaybackHighlight"
                  :selection="selectedHarpProjection"
                  :svg="harpSvg"
                  @select-text-range="handleHarpPreviewSelection"
                />
              </template>
            </ZnSplitPane>
          </div>
        </template>
      </ZnSplitPane>
    </template>

    <template #footer>
      <div class="workbench-footer">
        <FooterBar
          :extract-label="`Extract ${currentExtractLabel}`"
          :storage-path="renderSummary"
          :dirty="true"
          :save-format="saveFormat"
          :cursor-position="editorCursor"
          :speed-factor="playbackStore.state.speedFactor"
          @speed-down="playbackStore.decreaseSpeed"
          @speed-reset="playbackStore.resetSpeed"
          @speed-up="playbackStore.increaseSpeed"
        />
        <div
          v-if="playbackStatusOverlay !== undefined"
          class="workbench-footer__playback-overlay"
          aria-live="polite"
        >
          {{ playbackStatusOverlay }}
        </div>
      </div>
    </template>
  </WorkbenchLayout>

  <WorkbenchToastStack
    :toasts="toasts"
    @dismiss="dismissToast"
  />
</template>

<style scoped>
.workbench-chrome {
  padding: 0;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-sm);
  background: var(--zn-bg-elevated);
  box-shadow: none;
}

.extract-picker {
  position: relative;
}

.extract-picker__summary {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 14rem;
  min-height: 2.1rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--zn-border);
  border-radius: 999px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--zn-accent) 8%, var(--zn-bg-surface)), var(--zn-bg-surface));
  color: var(--zn-text);
  box-shadow: var(--zn-shadow-soft);
  cursor: pointer;
  list-style: none;
}

.extract-picker__summary--active {
  border-color: color-mix(in srgb, #3cb371 55%, var(--zn-border));
}

.extract-picker__summary::-webkit-details-marker {
  display: none;
}

.extract-picker__icon,
.extract-picker__item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.2rem;
  border: 1px solid color-mix(in srgb, var(--zn-border-strong) 60%, transparent);
  border-radius: 50%;
  font-size: 0.72rem;
  color: var(--zn-accent-strong);
  background: color-mix(in srgb, white 88%, var(--zn-bg-surface));
  flex: 0 0 auto;
}

.extract-picker__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extract-picker__icon--produced,
.extract-picker__item-icon--produced {
  background: color-mix(in srgb, #3cb371 24%, white);
  border-color: color-mix(in srgb, #3cb371 70%, var(--zn-border));
  color: #1e5f37;
}

.extract-picker__menu {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  z-index: 30;
  min-width: 16rem;
  padding: 0.35rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-md);
  background: var(--zn-bg-surface);
  box-shadow: var(--zn-shadow-soft);
}

.extract-picker__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.55rem;
  border: 0;
  border-radius: var(--zn-radius-sm);
  background: transparent;
  color: var(--zn-text);
  cursor: pointer;
  text-align: left;
}

.extract-picker__item:hover,
.extract-picker__item--active {
  background: var(--zn-bg-surface-soft);
}

.extract-picker__item-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.25rem;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.preview-pane {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.preview-pane > :deep(.zn-split-pane) {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.workbench-footer {
  position: relative;
}

.workbench-footer__playback-overlay {
  position: absolute;
  left: 50%;
  bottom: calc(100% - 0.5rem);
  transform: translateX(-50%);
  z-index: 2;
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
  text-transform: uppercase;
  pointer-events: none;
  white-space: nowrap;
}

.editor-pane > :deep(.zn-tabs),
.editor-pane > :deep(.zn-tabs .zn-tabs__panel) {
  min-height: 0;
  height: 100%;
  overflow: hidden;
}
</style>
