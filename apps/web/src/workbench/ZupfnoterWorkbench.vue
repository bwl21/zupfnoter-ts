<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

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
import AboutDialog from './AboutDialog.vue'
import HarpPreviewPanel from './panels/HarpPreviewPanel.vue'
import LyricsPanel from './panels/LyricsPanel.vue'
import ScorePreviewPanel from './panels/ScorePreviewPanel.vue'
import {
  DEFAULT_ABC,
  type RenderIssue,
  renderWorkbenchPreviews,
  type WorkbenchRenderResult,
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
import { useAudioPlayer, type PlaybackInstrument } from './useAudioPlayer'
import { resolvePlaybackInstrument } from './sound'
import type { PlaybackStep } from './playback'
import type { SelectionOrigin } from '@zupfnoter/types'
import { CommandError, CommandStack, registerLegacyCommands, registerStorageCommands } from '@zupfnoter/core'
import type { ConsoleLogEntry, ConsoleLogKind } from './consoleLog'
import {
  canTargetCreateSelection,
  createExtractChangedSelectionEvent,
  createRenderRefreshedSelectionEvent,
  createScopeChangedSelectionEvent,
  createSongLoadedSelectionEvent,
  createTextRangeSelectionEvent,
  resolvePlaybackProjection,
  resolvePlaybackScoreRanges,
  resolveSelectionEditorRange,
  resolveSelectionProjection,
} from './selectionManager'
import { workbenchDiagnosticKey, type WorkbenchDiagnostic as WebWorkbenchDiagnostic } from './diagnostics'
import { createHarpMirrorChannel, postHarpMirrorSnapshot, type HarpMirrorSnapshot } from './multiWindow/harpMirrorChannel'
import { createDropboxProvider, resumeDropboxLoginFromRedirect } from './storage/dropboxProvider'

interface ConfigEditorIntent {
  action: string
  path?: string
  extractId: number
}

const editorTab = ref('abc')
const editorPaneSize = ref(54)
const previewPaneSize = ref(62)
const harpZoom = ref(100)
const harpScrollLeft = ref(0)
const harpScrollTop = ref(0)
const abcText = ref(DEFAULT_ABC)
const currentExtract = ref(0)
const activeConfigSection = ref('basic_settings')
const configEntryMutationVersion = ref(0)
const saveFormat = ref('A3-A4')
const storageState = reactive({
  system: 'dropbox',
  path: '',
  loggedIn: false,
  pendingCandidates: [] as string[],
})
const dropboxProvider = createDropboxProvider()
const playbackInstrument = ref<PlaybackInstrument>('oscillator')
const logLevel = ref('warning')
const autoRefresh = ref<'on' | 'off' | 'remote'>('on')
const runtimeSettings = ref<Record<string, string>>({
  autoscroll: 'true',
  flowconf: 'false',
  follow: 'true',
  validate: 'true',
})
const storageStateKey = 'zupfnoter.storage.context'
const abcTextKey = 'zupfnoter.abc.current'
const playbackInstrumentKey = 'zupfnoter.playback.instrument'
const extractPickerOpen = ref(false)
const aboutDialogOpen = ref(false)
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
const activeVoiceIds = ref<string[]>([])
const allVoiceIds = ref<string[]>([])
const commandBusy = ref(false)
const { toasts, syncDiagnostics, dismissToast } = useWorkbenchToasts()
const playbackStore = usePlaybackStore()
const selectionStore = useSelectionStore()
const selectedHarpProjection = computed(() => resolveSelectionProjection(
  selectionStore.sheetObjectIndex,
  selectionStore.selection,
  'harp-preview',
  {
    voiceScope: selectionStore.selection.voiceScope,
    activeVoiceIds: activeVoiceIds.value,
  },
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
  {
    voiceScope: selectionStore.selection.voiceScope,
    activeVoiceIds: activeVoiceIds.value,
  },
).textRanges)
const selectedEditorTextRange = computed(() => selectionStore.selection.source === 'abc-editor'
  ? undefined
  : resolveSelectionEditorRange(selectionStore.sheetObjectIndex, selectionStore.selection))
const playbackScoreTextRanges = computed(() => resolvePlaybackScoreRanges(
  selectionStore.sheetObjectIndex,
  playbackStore.highlight,
))
const audioPlayer = useAudioPlayer(playbackInstrument)
const { toggle: togglePlayback, stop: stopPlayback } = usePlaybackDriver(
  playbackStore,
  computed(() => selectionStore.selection),
  computed(() => selectionStore.sheetObjectIndex),
  computed(() => ({
    timeline: playbackTimeline.value,
    baseTempoFromQ: baseTempoFromQ.value,
    activeVoiceIds: activeVoiceIds.value,
    mode: 'all-score',
  })),
  audioPlayer,
)
const buildInfo = (globalThis as typeof globalThis & { __ZUPFNOTER_BUILD_INFO__?: {
  appVersion: string
  commitHash: string
  buildTime: string
} }).__ZUPFNOTER_BUILD_INFO__ ?? {
  appVersion: 'unknown',
  commitHash: 'unknown',
  buildTime: new Date(0).toISOString(),
}

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

const selectionVoiceScopeSummary = computed(() => {
  const activeLabel = activeVoiceIds.value.length > 0 ? activeVoiceIds.value.join(', ') : '–'
  const allLabel = allVoiceIds.value.length > 0 ? allVoiceIds.value.join(', ') : '–'

  if (selectionStore.selection.voiceScope === 'single-voice') {
    return 'wirkt auf die ausgewählte Stimme'
  }

  if (selectionStore.selection.voiceScope === 'extract-voices') {
    return `Auszug: Stimmen ${activeLabel}`
  }

  return `Alle Stimmen: ${allLabel}`
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

let commandStack: CommandStack
let renderWorker: Worker | undefined
let harpMirrorWindow: Window | null = null
const harpMirrorWindowName = 'zupfnoter-harp-duplicate'
const harpMirrorChannel = createHarpMirrorChannel()
let nextRenderRequestId = 0
let pendingRenderRequestId: number | undefined
let renderTimer: ReturnType<typeof setTimeout> | undefined

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

function restoreStorageContext(): void {
  const raw = localStorage.getItem(storageStateKey)
  if (raw === null) return
  try {
    const parsed = JSON.parse(raw) as { system?: string; path?: string; loggedIn?: boolean }
    if (typeof parsed.system !== 'string' || typeof parsed.path !== 'string' || typeof parsed.loggedIn !== 'boolean') return
    storageState.system = parsed.system
    storageState.path = parsed.path
    storageState.loggedIn = parsed.loggedIn
    storageState.pendingCandidates = []
  } catch {
    // ignore malformed storage state
  }
}

function restoreCurrentAbcText(): void {
  const raw = localStorage.getItem(abcTextKey)
  if (raw === null) return
  abcText.value = raw
}

function restorePlaybackInstrument(): void {
  const raw = localStorage.getItem(playbackInstrumentKey)
  if (raw !== 'harp' && raw !== 'piano' && raw !== 'western-guitar' && raw !== 'oscillator') return
  playbackInstrument.value = raw
}

watch(storageState, () => {
  localStorage.setItem(storageStateKey, JSON.stringify({
    system: storageState.system,
    path: storageState.path,
    loggedIn: storageState.loggedIn,
  }))
}, { deep: true })

watch(abcText, (value) => {
  localStorage.setItem(abcTextKey, value)
})

watch(playbackInstrument, (value) => {
  localStorage.setItem(playbackInstrumentKey, value)
})

function appendUniqueDiagnosticLine(
  seenKeys: Set<string>,
  diagnostic: WebWorkbenchDiagnostic,
  fallbackSource?: string,
): void {
  const key = workbenchDiagnosticKey(diagnostic)
  if (seenKeys.has(key)) return
  seenKeys.add(key)
  appendDiagnosticLine(diagnostic.message, diagnostic.severity, diagnostic.source ?? fallbackSource)
}

function handleRenderWorkerMessage(event: MessageEvent): void {
  const data: unknown = event.data
  if (typeof data !== 'object' || data === null) return
  const record = data as { id?: number, kind?: string, message?: string, totalMs?: number, result?: WorkbenchRenderResult, error?: string }
  if (record.kind === 'progress' && typeof record.message === 'string') {
    appendPipelineLine(record.message)
    return
  }
  if (record.kind === 'perf' && typeof record.totalMs === 'number') {
    appendPipelineLine(`worker: perf total ${record.totalMs.toFixed(3)} ms`)
    return
  }
  if (record.kind === 'result') {
    if (pendingRenderRequestId !== record.id) return
    pendingRenderRequestId = undefined
    if (record.result !== undefined) {
      applyRenderResult(record.result)
    }
    if (record.error !== undefined) {
      appendPipelineLine(`worker: render failed: ${record.error}`)
      renderError.value = record.error
      renderSummary.value = 'render failed'
    }
  }
}

function applyRenderResult(result: WorkbenchRenderResult): void {
  const loggedDiagnostics = new Set<string>()
  scoreSvg.value = result.scoreSvg
  harpSvg.value = result.harpSvg
  activeVoiceIds.value = result.activeVoiceIds
  selectionStore.dispatchSelectionEvent(createExtractChangedSelectionEvent(result.activeVoiceIds))
  allVoiceIds.value = result.allVoiceIds
  selectionStore.dispatchSelectionEvent(createRenderRefreshedSelectionEvent(result.sheetObjectIndex))
  renderIssues.value = result.issues
  workbenchDiagnostics.value = result.diagnostics
  editorDiagnostics.value = result.editorDiagnostics
  playbackTimeline.value = result.playbackTimeline
  baseTempoFromQ.value = result.baseTempoFromQ
  syncDiagnostics(result.toastDiagnostics)
  for (const issue of result.issues) {
    const column = issue.column ?? 1
    const diagnostic: WebWorkbenchDiagnostic = {
      severity: issue.severity,
      message: issue.message,
      source: 'abc2svg',
      startPos: issue.line === undefined ? undefined : [issue.line, column],
      endPos: issue.line === undefined ? undefined : [issue.line, column],
    }
    appendUniqueDiagnosticLine(loggedDiagnostics, diagnostic, 'abc2svg')
  }
  for (const diagnostic of result.toastDiagnostics) {
    appendUniqueDiagnosticLine(loggedDiagnostics, diagnostic)
  }
  for (const diagnostic of result.editorDiagnostics) {
    appendUniqueDiagnosticLine(loggedDiagnostics, {
      severity: diagnostic.severity,
      message: `line ${diagnostic.line}: ${diagnostic.message}`,
      source: diagnostic.source,
      startPos: [diagnostic.line, diagnostic.column ?? 1],
      endPos: [diagnostic.line, diagnostic.column ?? 1],
    })
  }
  renderSummary.value = result.summary
  renderError.value = result.renderError ?? ''
  publishHarpMirrorSnapshot()
}

function renderNow(): void {
  const requestId = ++nextRenderRequestId
  try {
    if (renderWorker !== undefined) {
      pendingRenderRequestId = requestId
      renderWorker.postMessage({
        id: requestId,
        abcText: abcText.value,
        extractNr: currentExtract.value,
      })
      return
    }
    appendPipelineLine(`worker: render extract ${currentExtract.value}`)
    const result = renderWorkbenchPreviews(abcText.value, currentExtract.value)
    applyRenderResult(result)
    appendPipelineLine(`worker: render complete in 0.000 sec`)
  } catch (error) {
    appendPipelineLine(`worker: render failed: ${error instanceof Error ? error.message : String(error)}`)
    renderError.value = error instanceof Error ? error.message : String(error)
    renderSummary.value = 'render failed'
  }
}

function buildHarpMirrorSnapshot(): HarpMirrorSnapshot {
  const playbackHighlight = playbackStore.highlight
  const selection = selectedHarpProjection.value
  return {
    abcText: abcText.value,
    currentExtract: currentExtract.value,
    scoreSvg: scoreSvg.value,
    harpSvg: harpSvg.value,
    renderError: renderError.value,
    playbackHighlight: {
      activeTextRanges: playbackHighlight.activeTextRanges.map((range) => ({ ...range })),
      activeStartChar: playbackHighlight.activeStartChar,
      activeTime: playbackHighlight.activeTime,
      passIndex: playbackHighlight.passIndex,
      voltaNumber: playbackHighlight.voltaNumber,
    },
    selection: {
      selectedIndexes: [...selection.selectedIndexes],
      textRanges: selection.textRanges.map((range) => ({ ...range })),
      znIds: [...selection.znIds],
      confKeys: [...selection.confKeys],
    },
    selectionState: {
      selectedIndexes: [...selectionStore.selection.selectedIndexes],
      originSelectedIndexes: [...selectionStore.selection.originSelectedIndexes],
      anchorIndex: selectionStore.selection.anchorIndex,
      source: selectionStore.selection.source,
      voiceScope: selectionStore.selection.voiceScope,
    },
    selectedScoreTextRanges: selectedScoreTextRanges.value.map((range) => ({ ...range })),
    playbackScoreTextRanges: playbackScoreTextRanges.value.map((range) => ({ ...range })),
    harpZoom: harpZoom.value,
    scrollLeft: harpScrollLeft.value,
    scrollTop: harpScrollTop.value,
  }
}

function publishHarpMirrorSnapshot(): void {
  const snapshot = buildHarpMirrorSnapshot()
  postHarpMirrorSnapshot(harpMirrorChannel, snapshot)
  if (harpMirrorWindow === null || harpMirrorWindow.closed) return
  try {
    harpMirrorWindow.postMessage({ kind: 'snapshot', snapshot }, window.location.origin)
  } catch {
    // Ignore cross-window delivery issues; BroadcastChannel is the primary path.
  }
}

function sendHarpMirrorSnapshotToWindow(targetWindow: Window): void {
  try {
    targetWindow.postMessage({ kind: 'snapshot', snapshot: buildHarpMirrorSnapshot() }, window.location.origin)
  } catch {
    // Ignore windows that are already gone or unavailable.
  }
}

function openHarpDuplicate(): void {
  const url = new URL('/mirror/harp', window.location.origin)
  const nextWindow = window.open(url.toString(), harpMirrorWindowName)
  if (nextWindow === null) return
  harpMirrorWindow = nextWindow
  try {
    nextWindow.focus()
  } catch {
    // Focus can fail in some browsers or tests; opening is the important part.
  }
  sendHarpMirrorSnapshotToWindow(nextWindow)
  publishHarpMirrorSnapshot()
}

function openNotesDuplicate(): void {
  const url = new URL('/mirror/notes', window.location.origin)
  const nextWindow = window.open(url.toString(), `${harpMirrorWindowName}-notes`)
  if (nextWindow === null) return
  try {
    nextWindow.focus()
  } catch {
    // Focus can fail in some browsers or tests; opening is the important part.
  }
  sendHarpMirrorSnapshotToWindow(nextWindow)
  publishHarpMirrorSnapshot()
}

async function executeCommand(command: string): Promise<void> {
  commandBusy.value = true
  appendConsoleLine(command, 'command')
  try {
    await commandStack.runString(command)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    appendConsoleLine(enrichCommandError(command, message), 'error')
  } finally {
    commandBusy.value = false
  }
}

async function executeToolbarCommand(command: string): Promise<boolean> {
  commandBusy.value = true
  appendConsoleLine(command, 'command')
  try {
    await commandStack.runString(command)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    appendConsoleLine(enrichCommandError(command, message), 'error')
    return false
  } finally {
    commandBusy.value = false
  }
}

function handleConfigEditorIntent(intent: ConfigEditorIntent): void {
  if (intent.action === 'config.editSection' && intent.path !== undefined) {
    void executeToolbarCommand(`editconf ${intent.path}`)
    return
  }

  if (intent.action === 'config.addEntry' && intent.path !== undefined) {
    void executeToolbarCommand(`addconf ${intent.path}`).then((wasAdded) => {
      if (wasAdded) configEntryMutationVersion.value += 1
    })
    return
  }

  appendConsoleLine(`config intent: ${intent.action}${intent.path ? ` ${intent.path}` : ''}`, 'info')
}

function enrichCommandError(command: string, message: string): string {
  if (!message.startsWith('Unknown command: ')) {
    return message
  }
  const suggestion = commandStack.suggest(command)
  if (suggestion === undefined || suggestion.didYouMean.length === 0) {
    return message
  }
  return `${message}. Did you mean: ${suggestion.didYouMean.join(', ')}?`
}

function resolveCommandSuggestion(command: string): { completed: string; didYouMean: string[] } | undefined {
  return commandStack.suggest(command)
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

function setPlaybackInstrumentFromCommand(value: string): void {
  const sound = resolvePlaybackInstrument(value)
  if (sound !== undefined) {
    playbackInstrument.value = sound
    stopPlayback()
    appendConsoleLine(`sound set to ${sound}`, 'info')
    return
  }
  throw new CommandError(`Unsupported sound: ${value}`)
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

void (async () => {
  if (resumeDropboxLoginFromRedirect()) {
    storageState.loggedIn = true
  }
})()

registerStorageCommands(commandStack, storageState, {
  providers: [dropboxProvider.system, 'nextcloud'],
  list: async (path, recursive) => {
    const results = await dropboxProvider.list(path, recursive)
    return results
  },
  search: async (path, query) => {
    const results = await dropboxProvider.search(path, query)
    return results
  },
  open: async (path, filename) => {
    const loaded = await dropboxProvider.open(path, filename)
    if (loaded === undefined) return undefined
    abcText.value = loaded
    renderNow()
    return loaded
  },
  save: async (path, filename, content) => {
    await dropboxProvider.save(path, filename, content)
  },
  readDocument: () => abcText.value,
  writeDocument: (content) => {
    abcText.value = content
    renderNow()
  },
  login: async (path) => {
    await dropboxProvider.login()
  },
  logout: async (path) => {
    await dropboxProvider.logout()
  },
  cleanup: async (path) => {
    await dropboxProvider.cleanup()
  },
})

  registerLegacyCommands(commandStack, {
    getAbcText: () => abcText.value,
    setAbcText: setAbcFromCommand,
    getSound: () => playbackInstrument.value,
    readDocument: () => abcText.value,
    writeDocument: (value) => {
      abcText.value = value
    renderNow()
  },
  render: renderNow,
  play: playFromCommand,
  stop: stopPlayback,
  openHarpDuplicate,
  openPanelDuplicate: (target: string) => {
    if (target === 'harp') {
      openHarpDuplicate()
      return
    }
    if (target === 'notes') {
      openNotesDuplicate()
    }
  },
  setSpeed: playbackStore.setSpeedFactor,
  setEditorTab: (tab) => {
    editorTab.value = tab
  },
  setConfigEditorSection: (section) => {
    activeConfigSection.value = section
  },
  setCurrentExtract: setCurrentExtractFromCommand,
  getCurrentExtract: () => currentExtract.value,
  setSound: setPlaybackInstrumentFromCommand,
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
    selectionStore.dispatchSelectionEvent(
      createSongLoadedSelectionEvent('abc-editor', selectionStore.selection.voiceScope),
    )
    return
  }

  selectionStore.dispatchSelectionEvent(
    createTextRangeSelectionEvent(payload.startpos, payload.endpos, 'abc-editor'),
  )
}

function handleSelectionVoiceScopeChange(voiceScope: 'single-voice' | 'extract-voices' | 'all-voices'): void {
  selectionStore.dispatchSelectionEvent(createScopeChangedSelectionEvent(voiceScope))
}

watch(abcText, () => {
  playbackStore.markDocumentChanged()
  stopPlayback()
  if (autoRefresh.value === 'off') return
  if (renderTimer !== undefined) {
    clearTimeout(renderTimer)
  }
  renderTimer = setTimeout(renderNow, 100)
}, { immediate: true })

function handleHarpPreviewSelection(payload: {
  startpos: number
  endpos: number
  extend: boolean
  origin?: SelectionOrigin
  source: 'harp-preview'
}): void {
  if (!canTargetCreateSelection(payload.source, 'textRange')) return
  selectionStore.dispatchSelectionEvent(
    createTextRangeSelectionEvent(payload.startpos, payload.endpos, payload.source, payload.extend, payload.origin),
  )
}

function handleHarpPreviewScroll(payload: { scrollLeft: number; scrollTop: number }): void {
  harpScrollLeft.value = payload.scrollLeft
  harpScrollTop.value = payload.scrollTop
  publishHarpMirrorSnapshot()
}

function handleScorePreviewSelection(payload: {
  startpos: number
  endpos: number
  extend: boolean
  origin?: SelectionOrigin
  source: 'score-preview'
}): void {
  if (!canTargetCreateSelection(payload.source, 'textRange')) return
  selectionStore.dispatchSelectionEvent(
    createTextRangeSelectionEvent(payload.startpos, payload.endpos, payload.source, payload.extend, payload.origin),
  )
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

watch(
  [abcText, currentExtract, harpSvg, renderError, harpZoom, harpScrollLeft, harpScrollTop, () => playbackStore.highlight, () => selectionStore.selection],
  publishHarpMirrorSnapshot,
  { deep: true },
)

function chooseExtract(extractNumber: number): void {
  executeToolbarCommand(`view ${extractNumber}`)
  extractPickerOpen.value = false
}

function handleExtractPickerToggle(event: Event): void {
  const target = event.currentTarget
  if (!(target instanceof HTMLDetailsElement)) return
  extractPickerOpen.value = target.open
}

function openAboutDialog(): void {
  aboutDialogOpen.value = true
}

function closeAboutDialog(): void {
  aboutDialogOpen.value = false
}

function isExtractProduced(extractNumber: number): boolean {
  return produceExtracts.value.has(extractNumber)
}

onMounted(() => {
  restoreCurrentAbcText()
  restorePlaybackInstrument()
  restoreStorageContext()
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('message', handleMirrorMessage)
  try {
    renderWorker = new Worker(new URL('./rendering/renderWorker.ts', import.meta.url), { type: 'module' })
    renderWorker.onmessage = handleRenderWorkerMessage
  } catch (error) {
    appendPipelineLine(`worker: unavailable: ${error instanceof Error ? error.message : String(error)}`)
    renderWorker = undefined
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('message', handleMirrorMessage)
  renderWorker?.terminate()
  renderWorker = undefined
  if (renderTimer !== undefined) {
    clearTimeout(renderTimer)
  }
  harpMirrorChannel?.close()
})

onUnmounted(() => {
  if (harpMirrorWindow !== null && !harpMirrorWindow.closed) {
    harpMirrorWindow.close()
  }
})

function handleMirrorMessage(event: MessageEvent): void {
  if (event.origin !== window.location.origin) return
  const data: unknown = event.data
  if (typeof data !== 'object' || data === null) return
  const record = data as { kind?: string, target?: string, zoom?: number }
  const source = event.source
  if (!(source instanceof Window)) return
  if (record.kind === 'mirror-request') {
    if (record.target !== 'harp' && record.target !== 'notes') return
    sendHarpMirrorSnapshotToWindow(source)
    return
  }
  if (record.kind !== 'mirror-ready') return
  sendHarpMirrorSnapshotToWindow(source)
}
</script>

<template>
  <WorkbenchLayout>
    <template #header>
      <section class="workbench-chrome">
        <ZnToolbar>
          <template #leading>
            <ZnButton
              class="workbench-header__about-button"
              variant="primary"
              aria-label="About this build"
              title="About this build"
              @click="openAboutDialog"
            >
              i
            </ZnButton>
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
                >
                  <template #toolbar>
                    <ZnToolbar class="abc-editor-toolbar">
                      <template #leading>
                        <ZnButton variant="ghost">Bearbeiten</ZnButton>
                        <ZnButton variant="ghost" @click="executeToolbarCommand('adddecoration !fermata!')">Dekoration einfügen</ZnButton>
                        <ZnButton variant="ghost" @click="executeToolbarCommand('addsnippet note')">Zusatz einfügen</ZnButton>
                        <ZnButton variant="ghost" @click="executeToolbarCommand('editsnippet')">Zusatz bearbeiten</ZnButton>
                        <ZnButton variant="ghost" @click="executeToolbarCommand('editconf basic_settings')">Konfig. bearb.</ZnButton>
                      </template>
                    </ZnToolbar>
                  </template>
                </AbcEditorPanel>
                <LyricsPanel v-else-if="activeId === 'lyrics'" />
                <ConfigEditorPanel
                  v-else-if="activeId === 'config'"
                  :abc-text="abcText"
                  :current-extract="currentExtract"
                  :active-section="activeConfigSection"
                  :entry-mutation-version="configEntryMutationVersion"
                  @intent="handleConfigEditorIntent"
                />
                <ConsolePanel
                  v-else
                  :lines="consoleLines"
                  :busy="commandBusy"
                  :activity-label="commandBusy ? 'Aktivität: läuft' : 'Aktivität: bereit'"
                  :resolve-command="resolveCommandSuggestion"
                  :get-command="(commandName) => commandStack.getCommand(commandName)"
                  @execute="executeCommand"
                  @info="appendConsoleLine($event, 'info')"
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
                  :sheet-object-index="selectionStore.sheetObjectIndex"
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
                  :sheet-object-index="selectionStore.sheetObjectIndex"
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
          :storage-path="storageState.path"
          :dirty="true"
          :save-format="saveFormat"
          :cursor-position="editorCursor"
          :speed-factor="playbackStore.state.speedFactor"
          :selection-voice-scope="selectionStore.selection.voiceScope"
          :selection-voice-scope-summary="selectionVoiceScopeSummary"
          @speed-down="playbackStore.decreaseSpeed"
          @speed-reset="playbackStore.resetSpeed"
          @speed-up="playbackStore.increaseSpeed"
          @selection-voice-scope-change="handleSelectionVoiceScopeChange"
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

  <AboutDialog
    :open="aboutDialogOpen"
    :app-version="`Web ${buildInfo.appVersion}`"
    :commit-hash="buildInfo.commitHash"
    :build-time="buildInfo.buildTime"
    @close="closeAboutDialog"
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

.workbench-header__about-button {
  min-width: 1.65rem;
  width: 1.65rem;
  min-height: 1.65rem;
  padding: 0;
  font-size: 0.85rem;
  line-height: 1;
  font-weight: 800;
  text-transform: none;
  border-radius: 999px;
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
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.abc-editor-toolbar:deep(.zn-toolbar) {
  box-sizing: border-box;
  height: 2.08rem;
  min-height: 2.08rem;
  max-height: 2.08rem;
  gap: var(--zn-space-2);
  padding: 0.18rem 0.28rem;
}

.abc-editor-toolbar:deep(.zn-button) {
  min-height: 1.52rem;
  padding: 0.12rem 0.48rem;
  font-size: 0.78rem;
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
