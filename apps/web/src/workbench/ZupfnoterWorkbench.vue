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
import { CommandError, CommandStack } from './commands'
import { registerLegacyCommands } from './legacyCommands'
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

function renderNow(): void {
  try {
    const result = renderWorkbenchPreviews(abcText.value)
    scoreSvg.value = result.scoreSvg
    harpSvg.value = result.harpSvg
    selectionStore.setSheetObjectIndex(result.sheetObjectIndex)
    renderIssues.value = result.issues
    workbenchDiagnostics.value = result.diagnostics
    editorDiagnostics.value = result.editorDiagnostics
    playbackTimeline.value = result.playbackTimeline
    baseTempoFromQ.value = result.baseTempoFromQ
    syncDiagnostics(result.toastDiagnostics)
    renderSummary.value = result.summary
    renderError.value = result.renderError ?? ''
  } catch (error) {
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
            <ZnBadge tone="info">Extract {{ currentExtract }}</ZnBadge>
            <ZnButton variant="ghost" @click="executeToolbarCommand('render')">Rendern</ZnButton>
            <ZnButton
              :variant="playbackStore.state.status === 'playing' ? 'primary' : 'ghost'"
              @click="executeToolbarCommand('p auto')"
            >
              Play
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
          :extract-label="`Extract ${currentExtract}`"
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
