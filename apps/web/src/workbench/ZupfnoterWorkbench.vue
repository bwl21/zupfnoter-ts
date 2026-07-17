<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'

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
  renderHtmlExport,
  renderPdfExport,
  resolvePdfExportVariants,
  type WorkbenchRenderResult,
} from './rendering/renderPipeline'
import { extractSongConfig, extractSongFilebase, pdfOutputFilename, replaceSongDocumentAbc, splitSongDocument } from '@zupfnoter/core'
import type { WorkbenchDiagnostic } from './diagnostics'
import type { EditorDiagnostic } from './panels/abcEditorCodeMirror'
import WorkbenchToastStack from './toasts/WorkbenchToastStack.vue'
import { useWorkbenchToasts } from './toasts/useWorkbenchToasts'
import ToolbarFileIcon from './ToolbarFileIcon.vue'
import StorageConnectionsDialog from './StorageConnectionsDialog.vue'
import StorageRootPickerDialog from './StorageRootPickerDialog.vue'
import StorageOpenDialog from './StorageOpenDialog.vue'
import {
  FILE_TOOLBAR_MENU_ITEMS,
  fileToolbarPlaceholderMessage,
  isFileToolbarActionDisabled,
  type FileToolbarAction,
} from './toolbarFileActions'
import WorkbenchLayout from './WorkbenchLayout.vue'
import { usePlaybackStore } from '../stores/playback'
import { useSelectionStore } from '../stores/selection'
import { usePlaybackDriver } from './usePlaybackDriver'
import { useAudioPlayer, type PlaybackInstrument } from './useAudioPlayer'
import { resolvePlaybackInstrument } from './sound'
import type { PlaybackStep } from './playback'
import type { SelectionOrigin } from '@zupfnoter/types'
import type { StorageConnection, StorageDocument, StorageProviderDescriptor } from '@zupfnoter/types'
import { CommandError, CommandStack, registerLegacyCommands, registerStorageCommands } from '@zupfnoter/core'
import type { CommandArgumentValue } from '@zupfnoter/core'
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
import { createDropboxProvider, removeDropboxConnection, resumeDropboxLoginFromRedirect } from './storage/dropboxProvider'
import { createStorageConnection, loadStorageConnections, saveStorageConnections } from './storage/connections'
import { createStorageProviderRegistry } from './storage/providerRegistry'

interface ConfigEditorIntent {
  action: string
  path?: string
  value?: CommandArgumentValue
  extractId: number
  targetExtract?: number
}

const editorTab = ref('abc')
const editorPaneSize = ref(54)
const previewPaneSize = ref(62)
const harpZoom = ref(100)
const harpScrollLeft = ref(0)
const harpScrollTop = ref(0)
const documentText = ref(DEFAULT_ABC)
const abcText = computed({
  get: () => splitSongDocument(documentText.value).abcText,
  set: (value: string) => {
    documentText.value = replaceSongDocumentAbc(documentText.value, value)
  },
})
const currentExtract = ref(0)
const activeConfigSection = ref('basic_settings')
const configEntryMutationVersion = ref(0)
const configCanUndo = ref(false)
const configCanRedo = ref(false)
const saveFormat = ref('A3-A4')
const storageState = reactive({
  system: 'dropbox',
  connectionId: undefined as string | undefined,
  rootPath: '',
  path: '',
  loggedIn: false,
  pendingCandidates: [] as string[],
})
const dropboxProvider = createDropboxProvider()
const storageConnections = ref<StorageConnection[]>(loadStorageConnections())
const activeStorageConnection = computed(() => storageConnections.value.find((connection) => connection.id === storageState.connectionId))
const hasStorageSaveTarget = computed(() => activeStorageConnection.value !== undefined && !activeStorageConnection.value.readOnly)
const saveTooltip = computed(() => activeStorageConnection.value?.readOnly === true
  ? `Speichern ist für „${activeStorageConnection.value.label}“ deaktiviert (nur lesen)`
  : 'Speichern ist erst mit bekanntem Speicherziel möglich')
const storageProviderRegistry = createStorageProviderRegistry([{
  descriptor: { id: 'dropbox', label: 'Dropbox', availability: 'available' },
  login: (state) => dropboxProvider.login(state),
  logout: (state) => dropboxProvider.logout(state),
  list: (state, recursive) => dropboxProvider.list(state, recursive),
  search: (state, query) => dropboxProvider.search(state, query),
  open: (state, filename) => dropboxProvider.open(state, filename),
  save: (state, filename, content) => dropboxProvider.save(state, filename, content),
  cleanup: (state) => dropboxProvider.cleanup(state),
  listFolders: (state, path) => dropboxProvider.listFolders(state, path),
  listDocuments: (state) => dropboxProvider.listDocuments(state),
  openPreview: (state, path) => dropboxProvider.openPreview(state, path),
  removeConnection: async (connectionId) => removeDropboxConnection(connectionId),
}])
const storageProviderDescriptors: StorageProviderDescriptor[] = [
  ...storageProviderRegistry.descriptors,
  { id: 'nextcloud', label: 'Nextcloud', availability: 'planned' },
]
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
const storageDialogResumeKey = 'zupfnoter.storage.connections-dialog.resume'
const abcTextKey = 'zupfnoter.abc.current'
const playbackInstrumentKey = 'zupfnoter.playback.instrument'
const extractPickerOpen = ref(false)
const aboutDialogOpen = ref(false)
const storageConnectionsDialogOpen = ref(false)
const returnToStorageOpenDialog = ref(false)
const storageOpenDialogOpen = ref(false)
const storageOpenDocuments = ref<StorageDocument[]>([])
const storageOpenLoading = ref(false)
const storageOpenDocumentsLoaded = ref(false)
const storagePreviewUrl = ref<string>()
const storagePreviewLoading = ref(false)
const storagePreviewError = ref('')
const saveResultFiles = ref<string[]>([])
const saveResultDialogOpen = ref(false)
const rootPickerConnectionId = ref<string>()
const rootPickerPath = ref('')
const rootPickerFolders = ref<Array<{ name: string; path: string }>>([])
const rootPickerLoading = ref(false)
const rootPickerCache = new Map<string, Array<{ name: string; path: string }>>()
const fileMenuElement = ref<HTMLDetailsElement | null>(null)
const fileToolbarTooltips = new Map<HTMLElement, TippyInstance>()
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
const { toasts, pushToast, syncDiagnostics, dismissToast } = useWorkbenchToasts()
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
  const extractConfig = extractSongConfig(documentText.value).extract ?? {}
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
  const config = extractSongConfig(documentText.value)
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
    const parsed = JSON.parse(raw) as { system?: string; connectionId?: string; rootPath?: string; path?: string; loggedIn?: boolean }
    if (typeof parsed.system !== 'string' || typeof parsed.path !== 'string' || typeof parsed.loggedIn !== 'boolean') return
    storageState.system = parsed.system
    storageState.connectionId = parsed.connectionId
    storageState.rootPath = typeof parsed.rootPath === 'string' ? parsed.rootPath : ''
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
  documentText.value = raw
}

function restorePlaybackInstrument(): void {
  const raw = localStorage.getItem(playbackInstrumentKey)
  if (raw !== 'harp' && raw !== 'piano' && raw !== 'western-guitar' && raw !== 'oscillator') return
  playbackInstrument.value = raw
}

function persistStorageContext(): void {
  localStorage.setItem(storageStateKey, JSON.stringify({
    system: storageState.system,
    connectionId: storageState.connectionId,
    rootPath: storageState.rootPath,
    path: storageState.path,
    loggedIn: storageState.loggedIn,
  }))
}

watch(storageState, persistStorageContext, { deep: true })

watch(storageConnections, (connections) => {
  saveStorageConnections(connections)
}, { deep: true })

watch(documentText, (value) => {
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
        abcText: documentText.value,
        extractNr: currentExtract.value,
      })
      return
    }
    appendPipelineLine(`worker: render extract ${currentExtract.value}`)
    const result = renderWorkbenchPreviews(documentText.value, currentExtract.value)
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

async function executeParsedToolbarCommand(
  command: string,
  commandName: string,
  values: CommandArgumentValue[],
): Promise<boolean> {
  commandBusy.value = true
  appendConsoleLine(command, 'command')
  try {
    await commandStack.runParsedCommand(commandName, values)
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
  if (intent.action === 'config.undo') {
    void executeToolbarCommand('undoconfig')
    return
  }

  if (intent.action === 'config.redo') {
    void executeToolbarCommand('redoconfig')
    return
  }

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

  if (intent.action === 'config.deletePath' && intent.path !== undefined) {
    void executeToolbarCommand(`delconfig ${intent.path}`)
    return
  }

  if (intent.action === 'config.setPath' && intent.path !== undefined && intent.value !== undefined) {
    void executeParsedToolbarCommand(
      `cconf ${intent.path} ${JSON.stringify(intent.value)}`,
      'cconf',
      [intent.path, intent.value],
    )
    return
  }

  if (intent.action === 'config.copyPathToExtract' && intent.path !== undefined && intent.targetExtract !== undefined) {
    void executeToolbarCommand(`cpconfig ${intent.path} ${intent.targetExtract}`)
    return
  }

  if (intent.action === 'config.movePathToExtract' && intent.path !== undefined && intent.targetExtract !== undefined) {
    void executeToolbarCommand(`moveconfig ${intent.path} ${intent.targetExtract}`)
    return
  }

  if (intent.action === 'config.quicksettings' && intent.path !== undefined) {
    void executeToolbarCommand(intent.path === 'stdextract'
      ? intent.path
      : `applyquicksetting ${intent.path.slice('preset.'.length)}`)
    return
  }

  appendConsoleLine(`config intent: ${intent.action}${intent.path ? ` ${intent.path}` : ''}`, 'info')
}

function closeFileMenu(): void {
  if (fileMenuElement.value !== null) {
    fileMenuElement.value.open = false
  }
}

function handleFileToolbarAction(action: FileToolbarAction): void {
  closeFileMenu()
  if (action === 'open') {
    storageOpenDocuments.value = []
    storageOpenDocumentsLoaded.value = false
    storageOpenDialogOpen.value = true
    return
  }
  if (action === 'storage-connections') {
    returnToStorageOpenDialog.value = false
    storageConnectionsDialogOpen.value = true
    return
  }
  const placeholderMessage = fileToolbarPlaceholderMessage(action)
  if (placeholderMessage !== undefined) {
    pushToast({
      severity: 'info',
      title: 'Datei',
      message: placeholderMessage,
    })
    appendConsoleLine(placeholderMessage, 'info')
    return
  }

  if (action === 'new') {
    void executeToolbarCommand('c 1 untitled')
    return
  }
  if (action === 'download') {
    void executeToolbarCommand('download_abc')
    return
  }
  if (action === 'save') {
    void executeToolbarCommand('ssave')
  }
}

async function searchStorageDocuments(query: string): Promise<void> {
  if (query.trim() === '') return
  if (storageOpenDocumentsLoaded.value || storageOpenLoading.value) return
  const connection = activeStorageConnection.value
  if (connection === undefined) return
  const adapter = storageProviderRegistry.adapterFor(storageState, storageConnections.value)
  if (adapter.listDocuments === undefined) return
  storageOpenLoading.value = true
  try {
    storageOpenDocuments.value = await adapter.listDocuments(storageState)
    storageOpenDocumentsLoaded.value = true
  } catch (error) {
    pushToast({ severity: 'warning', title: 'Öffnen', message: error instanceof Error ? error.message : String(error) })
  } finally { storageOpenLoading.value = false }
}

async function openStorageDocument(document: StorageDocument): Promise<void> {
  const opened = await executeParsedToolbarCommand(
    `sopen ${JSON.stringify(document.path)}`,
    'sopen',
    ['', document.path],
  )
  if (opened) storageOpenDialogOpen.value = false
}

function openStorageConnectionsFromDialog(): void {
  storageOpenDialogOpen.value = false
  returnToStorageOpenDialog.value = true
  storageConnectionsDialogOpen.value = true
}

function closeStorageConnectionsDialog(): void {
  storageConnectionsDialogOpen.value = false
  if (!returnToStorageOpenDialog.value) return
  returnToStorageOpenDialog.value = false
  storageOpenDialogOpen.value = true
}

async function previewStorageFile(path: string): Promise<void> {
  const adapter = storageProviderRegistry.adapterFor(storageState, storageConnections.value)
  if (adapter.openPreview === undefined) return
  storagePreviewLoading.value = true
  storagePreviewError.value = ''
  try {
    const preview = await adapter.openPreview(storageState, path)
    if (preview === undefined) return
    if (storagePreviewUrl.value !== undefined) URL.revokeObjectURL(storagePreviewUrl.value)
    storagePreviewUrl.value = URL.createObjectURL(preview)
  } catch (error) {
    storagePreviewError.value = error instanceof Error ? error.message : String(error)
  } finally {
    storagePreviewLoading.value = false
  }
}

function updateStorageConnection(connectionId: string, update: Partial<StorageConnection>): void {
  storageConnections.value = storageConnections.value.map((connection) => connection.id === connectionId
    ? { ...connection, ...update }
    : connection)
}

function activateStorageConnection(connectionId: string): void {
  const connection = storageConnections.value.find((entry) => entry.id === connectionId)
  if (connection?.status === 'disconnected') {
    connectStorageConnection(connectionId)
    return
  }
  void executeToolbarCommand(`sconnection ${connectionId}`)
}

function updateStorageConnectionRoot(connectionId: string, rootPath: string): void {
  const connection = storageConnections.value.find((entry) => entry.id === connectionId)
  if (connection === undefined || connection.rootPath === rootPath) return
  if (connection.rootPath !== '' && !window.confirm(`Wurzel von „${connection.label}“ wirklich ändern?`)) return
  updateStorageConnection(connectionId, { rootPath, relativePath: '' })
  if (storageState.connectionId === connectionId) {
    storageState.rootPath = rootPath
    storageState.path = ''
  }
}

function updateStorageConnectionReadOnly(connectionId: string, readOnly: boolean): void {
  updateStorageConnection(connectionId, { readOnly })
}

async function openRootPicker(connectionId: string): Promise<void> {
  rootPickerConnectionId.value = connectionId
  const connection = storageConnections.value.find((entry) => entry.id === connectionId)
  if (connection !== undefined) await loadRootPickerFolders(connectionId, connection.rootPath, false)
}

async function browseRootPicker(path: string): Promise<void> {
  const connectionId = rootPickerConnectionId.value
  if (connectionId === undefined) return
  rootPickerCache.set(rootPickerCacheKey(connectionId, rootPickerPath.value), rootPickerFolders.value)
  await loadRootPickerFolders(connectionId, path, false)
}

async function refreshRootPicker(): Promise<void> {
  const connectionId = rootPickerConnectionId.value
  if (connectionId === undefined) return
  await loadRootPickerFolders(connectionId, rootPickerPath.value, true)
}

async function loadRootPickerFolders(connectionId: string, path: string, refresh: boolean): Promise<void> {
  const connection = storageConnections.value.find((entry) => entry.id === connectionId)
  if (connection === undefined) return
  const normalizedPath = normalizeRootPickerPath(path)
  const cacheKey = rootPickerCacheKey(connectionId, normalizedPath)
  if (!refresh) {
    const cached = rootPickerCache.get(cacheKey)
    if (cached !== undefined) {
      rootPickerPath.value = normalizedPath
      rootPickerFolders.value = cached
      return
    }
  }
  const adapter = storageProviderRegistry.adapterForConnection(connection)
  if (adapter === undefined) return
  rootPickerLoading.value = true
  try {
    rootPickerPath.value = normalizedPath
    const folders = await adapter.listFolders({ ...storageState, connectionId, system: connection.providerId, rootPath: '', path: '' }, normalizedPath)
    rootPickerCache.set(cacheKey, folders)
    rootPickerFolders.value = folders
  } catch (error) {
    pushToast({ severity: 'warning', title: 'Speicherverbindung', message: error instanceof Error ? error.message : String(error) })
    rootPickerConnectionId.value = undefined
  } finally {
    rootPickerLoading.value = false
  }
}

function rootPickerCacheKey(connectionId: string, path: string): string {
  return `${connectionId}:${normalizeRootPickerPath(path)}`
}

function normalizeRootPickerPath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '')
}

function chooseRootPickerPath(path: string): void {
  const connectionId = rootPickerConnectionId.value
  if (connectionId !== undefined) updateStorageConnectionRoot(connectionId, path)
  rootPickerConnectionId.value = undefined
}

function createAndConnectStorageConnection(providerId: string, label: string): void {
  const descriptor = storageProviderDescriptors.find((provider) => provider.id === providerId)
  if (descriptor === undefined || descriptor.availability !== 'available') return
  const connection = createStorageConnection(providerId, label)
  storageConnections.value = [...storageConnections.value, connection]
  connectStorageConnection(connection.id)
}

function connectStorageConnection(connectionId: string): void {
  const connection = storageConnections.value.find((entry) => entry.id === connectionId)
  if (connection === undefined) return
  const adapter = storageProviderRegistry.adapterForConnection(connection)
  if (adapter === undefined) {
    pushToast({ severity: 'warning', title: 'Speicherverbindung', message: `${connection.providerId} ist noch nicht verfügbar.` })
    return
  }
  updateStorageConnection(connectionId, { status: 'connecting' })
  storageState.connectionId = connectionId
  storageState.system = connection.providerId
  storageState.loggedIn = false
  localStorage.setItem(storageDialogResumeKey, 'true')
  persistStorageContext()
  void executeToolbarCommand(`sprovider ${connection.providerId}`)
}

function disconnectStorageConnection(connectionId: string): void {
  void executeToolbarCommand(`sdisconnect ${connectionId}`)
}

function renameStorageConnection(connectionId: string, label: string): void {
  if (label.trim() === '') return
  updateStorageConnection(connectionId, { label: label.trim() })
}

function removeStorageConnection(connectionId: string): void {
  const connection = storageConnections.value.find((entry) => entry.id === connectionId)
  if (connection === undefined) return
  if (!window.confirm(`Verbindung „${connection.label}“ wirklich löschen?`)) return
  const adapter = storageProviderRegistry.adapterForConnection(connection)
  void adapter?.removeConnection(connectionId)
  storageConnections.value = storageConnections.value.filter((entry) => entry.id !== connectionId)
  for (const cacheKey of rootPickerCache.keys()) {
    if (cacheKey.startsWith(`${connectionId}:`)) rootPickerCache.delete(cacheKey)
  }
  if (storageState.connectionId === connectionId) {
    storageState.connectionId = undefined
    storageState.path = ''
    storageState.loggedIn = false
  }
}

function setupFileToolbarTooltips(): void {
  for (const element of document.querySelectorAll<HTMLElement>('[data-file-toolbar-tooltip]')) {
    if (fileToolbarTooltips.has(element)) continue
    const content = element.dataset.fileToolbarTooltip
    if (content === undefined || content === '') continue
    fileToolbarTooltips.set(element, tippy(element, {
      content,
      animation: 'shift-away',
      delay: [180, 0],
      duration: [90, 60],
      placement: 'bottom',
    }) as TippyInstance)
  }
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
  documentText.value = value
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
  const blob = new Blob([documentText.value], { type: 'text/vnd.abc;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${extractSongFilebase(documentText.value) ?? 'zupfnoter'}.abc`
  link.click()
  URL.revokeObjectURL(url)
}

function localStoreKey(id: string): string {
  return `zupfnoter.song.${id}`
}

function saveToLocalStore(): void {
  const id = extractAbcId(abcText.value)
  localStorage.setItem(localStoreKey(id), documentText.value)
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

registerStorageCommands(commandStack, storageState, {
  providers: storageProviderDescriptors.map((provider) => provider.id),
  connections: () => storageConnections.value,
  list: async (path, recursive) => storageProviderRegistry.adapterFor(path, storageConnections.value).list(path, recursive),
  search: async (path, query) => storageProviderRegistry.adapterFor(path, storageConnections.value).search(path, query),
  open: async (path, filename) => {
    const loaded = await storageProviderRegistry.adapterFor(path, storageConnections.value).open(path, filename)
    if (loaded === undefined) return undefined
    return loaded
  },
  save: async (path, filename, content) => storageProviderRegistry.adapterFor(path, storageConnections.value).save(path, filename, content),
  saveArtifacts: async (path, filebase, content) => {
    const adapter = storageProviderRegistry.adapterFor(path, storageConnections.value)
    const extracts = resolvePdfExportVariants(content, currentExtract.value)
    const abcName = `${filebase}.abc`
    const htmlName = `${filebase}.html`
    const names = [abcName, htmlName]
    await adapter.save(path, abcName, content)
    await adapter.save(path, htmlName, renderHtmlExport(content))
    for (const extract of extracts) {
      const suffix = extract.filenamepart
      if (saveFormat.value.includes('A3')) {
        const name = pdfOutputFilename(filebase, suffix, 'A3')
        await adapter.save(path, name, await renderPdfExport(content, extract.extractNr, 'A3'))
        names.push(name)
      }
      if (saveFormat.value.includes('A4')) {
        const name = pdfOutputFilename(filebase, suffix, 'A4')
        await adapter.save(path, name, await renderPdfExport(content, extract.extractNr, 'A4'))
        names.push(name)
      }
    }
    saveResultFiles.value = names
    saveResultDialogOpen.value = true
    return names
  },
  readDocument: () => documentText.value,
  writeDocument: (content) => {
    documentText.value = content
    renderNow()
  },
  login: async (path) => storageProviderRegistry.adapterFor(path, storageConnections.value).login(path),
  logout: async (path) => storageProviderRegistry.adapterFor(path, storageConnections.value).logout(path),
  cleanup: async (path) => storageProviderRegistry.adapterFor(path, storageConnections.value).cleanup(path),
  updateConnectionPath: (connectionId, relativePath) => updateStorageConnection(connectionId, { relativePath }),
  updateConnectionStatus: (connectionId, status) => updateStorageConnection(connectionId, { status }),
})

  registerLegacyCommands(commandStack, {
    getAbcText: () => documentText.value,
    setAbcText: setAbcFromCommand,
    getSound: () => playbackInstrument.value,
    readDocument: () => documentText.value,
    writeDocument: (value) => {
      documentText.value = value
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
  setConfigHistoryState: ({ canUndo, canRedo }) => {
      configCanUndo.value = canUndo
      configCanRedo.value = canRedo
  },
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

watch(documentText, () => {
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
  if (editorTab.value === 'config' && (event.key === 'z' || event.key === 'Z' || event.key === 'y' || event.key === 'Y')) {
    event.preventDefault()
    const isRedo = event.key === 'y' || event.key === 'Y' || event.shiftKey
    void executeToolbarCommand(isRedo ? 'redoconfig' : 'undoconfig')
    return
  }
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
  [documentText, currentExtract, harpSvg, renderError, harpZoom, harpScrollLeft, harpScrollTop, () => playbackStore.highlight, () => selectionStore.selection],
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
  if (storageState.connectionId !== undefined && storageState.system === 'dropbox') {
    void resumeDropboxLoginFromRedirect(storageState.connectionId).then((connected) => {
      if (!connected) return
      storageState.loggedIn = true
      updateStorageConnection(storageState.connectionId as string, { status: 'connected' })
      const connection = storageConnections.value.find((entry) => entry.id === storageState.connectionId)
      const resumeStorageDialog = localStorage.getItem(storageDialogResumeKey) === 'true'
      localStorage.removeItem(storageDialogResumeKey)
      if (connection !== undefined && (connection.rootPath === '' || resumeStorageDialog)) {
        storageConnectionsDialogOpen.value = true
        if (connection.rootPath === '') void openRootPicker(connection.id)
      }
    }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      pushToast({ severity: 'danger', title: 'Dropbox', message })
    })
  }
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('message', handleMirrorMessage)
  try {
    renderWorker = new Worker(new URL('./rendering/renderWorker.ts', import.meta.url), { type: 'module' })
    renderWorker.onmessage = handleRenderWorkerMessage
  } catch (error) {
    appendPipelineLine(`worker: unavailable: ${error instanceof Error ? error.message : String(error)}`)
    renderWorker = undefined
  }
  void nextTick().then(setupFileToolbarTooltips)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('message', handleMirrorMessage)
  renderWorker?.terminate()
  renderWorker = undefined
  for (const tooltip of fileToolbarTooltips.values()) {
    tooltip.destroy()
  }
  fileToolbarTooltips.clear()
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
            <details ref="fileMenuElement" class="file-menu" data-testid="file-menu">
              <summary
                class="file-menu__summary"
                aria-haspopup="menu"
                title="Dateiaktionen"
                data-testid="file-menu-toggle"
                data-file-toolbar-tooltip="Dateiaktionen"
              >
                <ToolbarFileIcon name="file" />
                <span>Datei</span>
                <span class="file-menu__caret" aria-hidden="true">v</span>
              </summary>
              <div class="file-menu__list" role="menu" aria-label="Datei">
                <template v-for="(item, index) in FILE_TOOLBAR_MENU_ITEMS" :key="item.type === 'action' ? item.action : `separator-${index}`">
                  <div v-if="item.type === 'separator'" class="file-menu__separator" role="separator" />
                  <button
                    v-else
                    class="file-menu__item"
                    type="button"
                    role="menuitem"
                    :data-testid="`file-action-${item.action}`"
                    :disabled="isFileToolbarActionDisabled(item.action, hasStorageSaveTarget)"
                    :title="item.action === 'save' ? saveTooltip : item.tooltip"
                    :data-file-toolbar-tooltip="item.action === 'save' ? saveTooltip : item.tooltip"
                    @click="handleFileToolbarAction(item.action)"
                  >
                    <ToolbarFileIcon :name="item.icon" />
                    <span>{{ item.label }}</span>
                  </button>
                </template>
              </div>
            </details>
            <ZnButton
              data-testid="file-shortcut-new"
              variant="ghost"
              title="Neues Dokument anlegen"
              data-file-toolbar-tooltip="Neues Dokument anlegen"
              @click="handleFileToolbarAction('new')"
            >
              <ToolbarFileIcon name="new" />
              <span>Neu</span>
            </ZnButton>
            <ZnButton
              data-testid="file-shortcut-open"
              variant="ghost"
              title="Dokument öffnen"
              data-file-toolbar-tooltip="Dokument öffnen"
              @click="handleFileToolbarAction('open')"
            >
              <ToolbarFileIcon name="open" />
              <span>Öffnen</span>
            </ZnButton>
            <ZnButton
              variant="primary"
              :disabled="isFileToolbarActionDisabled('save', hasStorageSaveTarget)"
              :title="saveTooltip"
              data-testid="file-shortcut-save"
              :data-file-toolbar-tooltip="saveTooltip"
              @click="handleFileToolbarAction('save')"
            >
              <ToolbarFileIcon name="save" />
              <span>Speichern</span>
            </ZnButton>
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
                  :abc-text="documentText"
                  :current-extract="currentExtract"
                  :extract-options="extractMenuItems"
                  :active-section="activeConfigSection"
                  :entry-mutation-version="configEntryMutationVersion"
                  :can-undo="configCanUndo"
                  :can-redo="configCanRedo"
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
  <Teleport to="body">
    <div v-if="saveResultDialogOpen" class="save-result__backdrop">
      <section class="save-result" role="dialog" aria-modal="true" aria-labelledby="save-result-title">
        <header><h2 id="save-result-title">Dateien gespeichert</h2><ZnButton variant="ghost" aria-label="Dialog schließen" @click="saveResultDialogOpen = false">×</ZnButton></header>
        <p>Folgende Dateien wurden gespeichert:</p>
        <ul><li v-for="file in saveResultFiles" :key="file">{{ file }}</li></ul>
        <footer><ZnButton variant="primary" @click="saveResultDialogOpen = false">Schließen</ZnButton></footer>
      </section>
    </div>
  </Teleport>

  <StorageConnectionsDialog
    :open="storageConnectionsDialogOpen"
    :connections="storageConnections"
    :providers="storageProviderDescriptors"
    :active-connection-id="storageState.connectionId"
    @close="closeStorageConnectionsDialog"
    @create="createAndConnectStorageConnection"
    @activate="activateStorageConnection"
    @update="renameStorageConnection"
    @remove="removeStorageConnection"
    @disconnect="disconnectStorageConnection"
    @root="openRootPicker"
    @readonly="updateStorageConnectionReadOnly"
  />

  <StorageRootPickerDialog
    :open="rootPickerConnectionId !== undefined"
    :path="rootPickerPath"
    :folders="rootPickerFolders"
    :loading="rootPickerLoading"
    @close="rootPickerConnectionId = undefined"
    @browse="browseRootPicker"
    @refresh="refreshRootPicker"
    @choose="chooseRootPickerPath"
  />

  <StorageOpenDialog
    :open="storageOpenDialogOpen"
    :location-label="activeStorageConnection?.label ?? 'Kein Speicherort'"
    :path="storageState.path"
    :documents="storageOpenDocuments"
    :loading="storageOpenLoading"
    :preview-url="storagePreviewUrl"
    :preview-loading="storagePreviewLoading"
    :preview-error="storagePreviewError"
    @close="storageOpenDialogOpen = false"
    @search="searchStorageDocuments"
    @open="openStorageDocument"
    @preview="previewStorageFile"
    @connections="openStorageConnectionsFromDialog"
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

.file-menu {
  position: relative;
}

.file-menu__summary {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  min-height: 2.1rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid transparent;
  border-radius: var(--zn-radius-md);
  color: var(--zn-text-soft);
  cursor: pointer;
  list-style: none;
}

.file-menu__summary:hover,
.file-menu[open] .file-menu__summary {
  border-color: var(--zn-border);
  background: var(--zn-bg-surface-soft);
}

.file-menu__summary:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 65%, white);
  outline-offset: 2px;
}

.file-menu__summary::-webkit-details-marker {
  display: none;
}

.file-menu__caret {
  font-size: 0.7rem;
}

.file-menu__list {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  z-index: 30;
  min-width: 17rem;
  padding: 0.35rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-md);
  background: var(--zn-bg-surface);
  box-shadow: var(--zn-shadow-soft);
}

.file-menu__item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  min-height: 2rem;
  padding: 0.45rem 0.55rem;
  border: 0;
  border-radius: var(--zn-radius-sm);
  background: transparent;
  color: var(--zn-text);
  cursor: pointer;
  text-align: left;
}

.file-menu__item:hover:not(:disabled),
.file-menu__item:focus-visible {
  background: var(--zn-bg-surface-soft);
}

.file-menu__item:disabled {
  color: var(--zn-text-soft);
  cursor: not-allowed;
  opacity: 0.6;
}

.file-menu__separator {
  height: 1px;
  margin: 0.32rem 0.2rem;
  background: var(--zn-border);
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

.save-result__backdrop {
  position: fixed;
  inset: 0;
  z-index: 1020;
  display: grid;
  place-items: center;
  padding: 0.75rem;
  background: rgb(15 23 42 / 0.45);
}

.save-result {
  width: min(34rem, calc(100vw - 1.5rem));
  border: 1px solid var(--zn-border-strong);
  border-radius: 0.85rem;
  background: var(--zn-bg-elevated);
  color: var(--zn-text);
  box-shadow: 0 16px 36px rgb(15 23 42 / 0.22);
}

.save-result header,
.save-result footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid var(--zn-border);
}

.save-result h2,
.save-result p,
.save-result ul {
  margin: 0;
}

.save-result h2 { font-size: 1rem; }
.save-result p { padding: 0.85rem 0.9rem 0.35rem; color: var(--zn-text-soft); }
.save-result ul { max-height: 16rem; overflow: auto; padding: 0.25rem 1.9rem 0.85rem; }
.save-result li { padding-block: 0.16rem; font-family: var(--zn-font-mono, monospace); font-size: 0.86rem; }
.save-result footer { justify-content: flex-end; border-top: 1px solid var(--zn-border); border-bottom: 0; }
</style>
