<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import QRCode from 'qrcode'
import 'tippy.js/dist/tippy.css'

import {
  ZnBadge,
  ZnButton,
  ZnIcon,
  ZnIconButton,
  ZnMaximizeButton,
  ZnSplitPane,
  ZnTabs,
  ZnToolbar,
} from '@zupfnoter/design-system'
import AbcEditorPanel from './panels/AbcEditorPanel.vue'
import ConfigEditorPanel from './panels/ConfigEditorPanel.vue'
import ConsolePanel from './panels/ConsolePanel.vue'
import FooterBar from './FooterBar.vue'
import PlaybackStatusOverlay from './PlaybackStatusOverlay.vue'
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
import {
  extractSongFilebase,
  extractSongResources,
  inspectSongConfig,
  pdfOutputFilename,
  PLAYER_QR_IMAGE_NAME,
  replaceSongDocumentAbc,
  replaceSongDocumentConfigText,
  replaceSongDocumentResources,
  splitSongDocument,
} from '@zupfnoter/core'
import type { PlaybackMetronomeMode, Song, SongResources } from '@zupfnoter/types'
import { createPlayerQrJpeg } from './playbackLink'
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
  storageSaveTooltip,
  type FileToolbarAction,
} from './toolbarFileActions'
import WorkbenchLayout from './WorkbenchLayout.vue'
import { usePlaybackStore } from '../stores/playback'
import { useSelectionStore } from '../stores/selection'
import { useWorkbenchConfigStore } from '../stores/workbenchConfig'
import { usePlaybackDriver } from './usePlaybackDriver'
import { useAudioPlayer, type PlaybackInstrument } from './useAudioPlayer'
import { resolvePlaybackInstrument } from './sound'
import type { PlaybackStep } from './playback'
import { createPlaybackLinkFromTimeline } from './playbackLink'
import type { SelectionOrigin } from '@zupfnoter/types'
import type { StorageConnection, StorageDocument, StorageProviderDescriptor } from '@zupfnoter/types'
import {
  CommandError,
  CommandStack,
  registerLegacyCommands,
  registerStorageCommands,
  StorageTargetUnavailableError,
} from '@zupfnoter/core'
import type { CommandArgumentValue } from '@zupfnoter/core'
import { WorkbenchLogger, type ConsoleLogEntry } from './consoleLog'
import { ShortcutManager } from './ShortcutManager'
import {
  INDEXED_DB_DOCUMENT_MARKER,
  CURRENT_DOCUMENT_LOCAL_STORAGE_KEY,
  INITIAL_DOCUMENT_KEY,
  loadCurrentDocumentFromIndexedDb,
  saveCurrentDocumentToIndexedDb,
} from './documentPersistence'
import {
  canTargetCreateSelection,
  createConfKeySelectedSelectionEvent,
  createExtractChangedSelectionEvent,
  createPreviewBackgroundClickedSelectionEvent,
  createRenderRefreshedSelectionEvent,
  createScopeChangedSelectionEvent,
  createSelectionInteractionEvent,
  createSongLoadedSelectionEvent,
  createTextRangeSelectionEvent,
  createTextRangesSelectionEvent,
  resolvePlaybackProjection,
  resolvePlaybackScoreRanges,
  resolveSelectionProjection,
} from './selectionManager'
import { resolveConfKeyForConfigPath, resolveIndexesByConfigPath } from './selectionIndex'
import { ABC_PARSER_DIAGNOSTIC_SOURCE, workbenchDiagnosticKey, type WorkbenchDiagnostic as WebWorkbenchDiagnostic } from './diagnostics'
import {
  createHarpMirrorChannel,
  postHarpMirrorSnapshot,
  type HarpMirrorSnapshot,
  type HarpPreviewDragEnd,
} from './multiWindow/harpMirrorChannel'
import { createDropboxProvider, removeDropboxConnection, resumeDropboxLoginFromRedirect } from './storage/dropboxProvider'
import { createLocalFsProvider } from './storage/localFsProvider'
import { createStorageConnection, loadStorageConnections, saveStorageConnections } from './storage/connections'
import { createStorageProviderRegistry } from './storage/providerRegistry'
import { readLocalImport, resourceKeyFromFileName, UnsupportedImportError } from './fileImport'

const props = withDefaults(defineProps<{
  openStorageOnMount?: boolean
}>(), {
  openStorageOnMount: false,
})

interface ConfigEditorIntent {
  action: string
  path?: string
  value?: CommandArgumentValue
  extractId: number
  targetExtract?: number
}

type SaveArtifactStatus = 'pending' | 'saving' | 'saved' | 'failed'

type ViewPerspective = 'all' | 'notes-input' | 'harp-input' | 'notes' | 'harp'
type MaximizedPanel = 'editor' | 'score' | 'harp'

interface SavedViewLayout {
  perspective: ViewPerspective
  editorPaneSize: number
  previewPaneSize: number
}

const viewPerspectiveItems: Array<{ id: ViewPerspective; label: string; icon: string }> = [
  { id: 'all', label: 'Alle Fenster', icon: '▦' },
  { id: 'notes-input', label: 'Noteneingabe', icon: '♫' },
  { id: 'harp-input', label: 'Harfeneingabe', icon: '▧' },
  { id: 'notes', label: 'Noten', icon: '♫' },
  { id: 'harp', label: 'Harfennoten', icon: '⤢' },
]

interface SaveArtifactProgress {
  name: string
  status: SaveArtifactStatus
  error?: string
}

interface SaveArtifactPlan {
  name: string
  create(): Promise<string | Blob>
}

/** Eine im Fehler-Chip sichtbare Diagnose aus der Renderpipeline. */
interface RenderIssueChipItem {
  severity: 'warning' | 'error'
  message: string
  source: string
  location?: string
}

const editorTab = ref('abc')
const showInvisibleCharacters = ref(false)
const editorPaneSize = ref(54)
const previewPaneSize = ref(62)
const viewPerspective = ref<ViewPerspective>('all')
const viewMenuElement = ref<HTMLDetailsElement | null>(null)
const maximizedPanel = ref<MaximizedPanel | null>(null)
const savedViewLayout = ref<SavedViewLayout | null>(null)
const harpZoom = ref(100)
const harpPreviewMode = ref<'gross' | 'normal' | 'klein' | 'eingepasst' | 'pdf'>('normal')
const harpPdfPreviewUrl = ref<string>()
const harpPdfPreviewLoading = ref(false)
const harpPdfPreviewError = ref('')
const harpScrollLeft = ref(0)
const harpScrollTop = ref(0)
const initialDocument = inject(INITIAL_DOCUMENT_KEY)
const documentText = ref(initialDocument ?? DEFAULT_ABC)
const songConfigInspection = computed(() => inspectSongConfig(documentText.value))
const parsedSongConfig = computed(() => songConfigInspection.value.config ?? {})
const documentResources = computed<SongResources>(() => extractSongResources(documentText.value))
const savedDocumentText = ref(documentText.value)
const documentDirty = computed(() => documentText.value !== savedDocumentText.value)
const abcText = computed({
  get: () => splitSongDocument(documentText.value).abcText,
  set: (value: string) => {
    documentText.value = replaceSongDocumentAbc(documentText.value, value)
  },
})
const currentExtract = ref(0)
const activeConfigSection = ref('basic_settings')
const hoveredConfigKey = ref<string>()
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
const storageConnections = ref<StorageConnection[]>(loadStorageConnections())
const dropboxProvider = createDropboxProvider({
  onTokenRefreshed: (connectionId) => {
    const connection = storageConnections.value.find((entry) => entry.id === connectionId)
    logger.info(`storage access renewed: ${connection?.label ?? connectionId}`)
  },
})
const localFsProvider = createLocalFsProvider()
const activeStorageConnection = computed(() => storageConnections.value.find((connection) => connection.id === storageState.connectionId))
const activeStorageReadOnly = computed(() => activeStorageConnection.value?.readOnly === true)
const storageLocation = computed(() => {
  const connection = activeStorageConnection.value
  if (connection === undefined) return 'Kein Speicherziel'
  const pathParts = [connection.rootPath, storageState.path]
    .map((path) => path.replace(/^\/+|\/+$/g, ''))
    .filter((path) => path !== '')
  const path = pathParts.length === 0 ? '/' : `/${pathParts.join('/')}`
  return `${connection.label} (${connection.providerId}) · ${path}`
})
const hasStorageSaveTarget = computed(() => activeStorageConnection.value !== undefined && !activeStorageConnection.value.readOnly)
const saveInProgress = ref(false)
const canSave = computed(() => hasStorageSaveTarget.value && !saveInProgress.value)
const saveTooltip = computed(() => saveInProgress.value
  ? 'Speichern läuft …'
  : storageSaveTooltip(activeStorageConnection.value, storageState.path))
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
}, {
  descriptor: { id: 'local', label: 'Lokaler Ordner', availability: 'available' },
  login: (state) => localFsProvider.login(state),
  logout: (state) => localFsProvider.logout(state),
  list: (state, recursive) => localFsProvider.list(state, recursive),
  search: (state, query) => localFsProvider.search(state, query),
  open: (state, filename) => localFsProvider.open(state, filename),
  save: (state, filename, content) => localFsProvider.save(state, filename, content),
  cleanup: (state) => localFsProvider.cleanup(state),
  listFolders: (state, path) => localFsProvider.listFolders(state, path),
  listDocuments: (state) => localFsProvider.listDocuments(state),
  openPreview: (state, path) => localFsProvider.openPreview(state, path),
  removeConnection: (connectionId) => localFsProvider.removeConnection(connectionId),
}])
const storageProviderDescriptors: StorageProviderDescriptor[] = [
  ...storageProviderRegistry.descriptors,
]

function rootPickerProviderLabel(): string {
  const providerId = storageConnections.value.find((connection) => connection.id === rootPickerConnectionId.value)?.providerId
  return storageProviderDescriptors.find((provider) => provider.id === providerId)?.label ?? providerId ?? 'Speicher'
}
const playbackInstrument = ref<PlaybackInstrument>('harp')
const logLevel = ref('warning')
const autoRefresh = ref<'on' | 'off' | 'remote'>('on')
const workbenchConfig = useWorkbenchConfigStore()
const runtimeSettings = ref<Record<string, string>>({
  autoscroll: 'true',
  follow: 'true',
  validate: 'true',
})
const flowconfEnabled = computed(() => workbenchConfig.config.flowconf)
const storageStateKey = 'zupfnoter.storage.context'
const storageDialogResumeKey = 'zupfnoter.storage.connections-dialog.resume'
const abcTextKey = CURRENT_DOCUMENT_LOCAL_STORAGE_KEY
const workbenchUiStateKey = 'zupfnoter.workbench.ui-state'
const playbackInstrumentKey = 'zupfnoter.playback.instrument'
const extractPickerOpen = ref(false)
const aboutDialogOpen = ref(false)
const storageConnectionsDialogOpen = ref(false)
const returnToStorageOpenDialog = ref(false)
const storageOpenDialogOpen = ref(false)
const storageOpenDocuments = ref<StorageDocument[]>([])
const storageOpenLoading = ref(false)
const storageOpenOpening = ref(false)
const storageOpenDocumentsLoaded = ref(false)
const storageOpenDocumentCache = new Map<string, StorageDocument[]>()
const storagePreviewUrl = ref<string>()
const storagePreviewLoading = ref(false)
const storagePreviewError = ref('')
const saveResultDialogOpen = ref(false)
const saveResultComplete = ref(false)
const saveProgressCompleted = ref(0)
const saveProgressTotal = ref(0)
const saveProgressFile = ref('')
const saveArtifactsProgress = ref<SaveArtifactProgress[]>([])
const saveResultHasFailures = computed(() => saveArtifactsProgress.value.some((artifact) => artifact.status === 'failed'))
const saveProgressLabel = computed(() => saveProgressFile.value === ''
  ? 'Speichervorgang wird vorbereitet …'
  : `Speichere ${saveProgressFile.value} (${saveProgressCompleted.value} von ${saveProgressTotal.value})`)
const rootPickerConnectionId = ref<string>()
const rootPickerPath = ref('')
const rootPickerFolders = ref<Array<{ name: string; path: string }>>([])
const rootPickerLoading = ref(false)
const rootPickerCache = new Map<string, Array<{ name: string; path: string }>>()
const fileMenuElement = ref<HTMLDetailsElement | null>(null)
const localFileInput = ref<HTMLInputElement | null>(null)
const fileDropActive = ref(false)
const editorEditMenuElement = ref<HTMLDetailsElement | null>(null)
const fileToolbarTooltips = new Map<HTMLElement, TippyInstance>()
const consoleLines = ref<ConsoleLogEntry[]>([])
const logger = new WorkbenchLogger((entry) => {
  consoleLines.value = [...consoleLines.value.slice(-199), entry]
})
const shortcutManager = new ShortcutManager((command) => {
  void dispatchShortcutCommand(command)
})
logger.info('command stack ready')
const scoreSvg = ref('')
const harpSvg = ref('')
const renderIssues = ref<RenderIssue[]>([])
const workbenchDiagnostics = ref<WorkbenchDiagnostic[]>([])
const editorDiagnostics = ref<EditorDiagnostic[]>([])
const editorCursor = ref('01:01')
const editorCursorUnicode = ref<string | undefined>(undefined)
const editorCursorOffset = ref(0)
const renderError = ref('')
const renderSummary = ref('not rendered')
const playbackTimeline = ref<PlaybackStep[]>([])
const song = ref<Song | undefined>(undefined)
const playerQrJpegUrl = ref<string | undefined>()
const baseTempoFromQ = ref<number | undefined>(undefined)
const tempoUnitFromQ = ref<number | undefined>(undefined)
const playbackConfig = ref<import('@zupfnoter/types').PlaybackConfig | undefined>(undefined)
const metronomeMode = ref<PlaybackMetronomeMode>('off')
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
const selectedEditorTextRanges = computed(() => selectionStore.selection.source === 'abc-editor'
  ? undefined
  : resolveSelectionProjection(
    selectionStore.sheetObjectIndex,
    selectionStore.selection,
    'abc-editor',
    {
      voiceScope: selectionStore.selection.voiceScope,
      activeVoiceIds: activeVoiceIds.value,
    },
  ).textRanges)
const playbackScoreTextRanges = computed(() => resolvePlaybackScoreRanges(
  selectionStore.sheetObjectIndex,
  playbackStore.highlight,
))
const audioPlayer = useAudioPlayer(playbackInstrument)
const playbackMetronomeConfig = computed(() => {
  const config = playbackConfig.value
  if (config === undefined) return undefined
  return {
    mode: metronomeMode.value,
    minLeadIn: config.minLeadIn,
    bandPreCount: config.bandPreCount,
    division: config.division,
    subdivision: config.subdivision,
  }
})
const { metronomeBeat: playbackMetronomeBeat, toggle: togglePlayback, stop: stopPlayback } = usePlaybackDriver(
  playbackStore,
  computed(() => selectionStore.selection),
  computed(() => selectionStore.sheetObjectIndex),
  computed(() => ({
    timeline: playbackTimeline.value,
    baseTempoFromQ: baseTempoFromQ.value,
    tempoUnitFromQ: tempoUnitFromQ.value,
    activeVoiceIds: activeVoiceIds.value,
    metronomeConfig: playbackMetronomeConfig.value,
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

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function annotationText(value: unknown): string | undefined {
  const annotation = recordValue(value)
  return stringValue(annotation?.text) ?? stringValue(recordValue(annotation?.value)?.text)
}

function abcHeaderValue(text: string, header: string): string | undefined {
  return text.split('\n')
    .find((line) => line.startsWith(`${header}:`))
    ?.slice(header.length + 1)
    .trim() || undefined
}

function resolvePlaybackIdentification(): string | undefined {
  const songConfig = recordValue(parsedSongConfig.value)
  const extracts = recordValue(songConfig?.extract)
  const currentConfig = recordValue(extracts?.[String(currentExtract.value)])
  const defaultConfig = recordValue(extracts?.['0'])
  const extractConfig = currentConfig ?? defaultConfig
  const currentNotes = recordValue(currentConfig?.notes)
  const defaultNotes = recordValue(defaultConfig?.notes)
  const topLevelNotes = recordValue(songConfig?.notes)
  const numberTemplate = annotationText(currentNotes?.T01_number)
    ?? annotationText(defaultNotes?.T01_number)
    ?? annotationText(topLevelNotes?.T01_number)
  const extractTemplate = annotationText(currentNotes?.T01_number_extract)
    ?? annotationText(defaultNotes?.T01_number_extract)
    ?? annotationText(topLevelNotes?.T01_number_extract)
  if (numberTemplate === undefined || extractTemplate === undefined) return undefined

  const number = abcHeaderValue(documentText.value, 'X') ?? ''
  const filenamePart = stringValue(extractConfig?.filenamepart) ?? String(currentExtract.value)
  const extractTitle = stringValue(extractConfig?.title) ?? String(currentExtract.value)
  const resolve = (template: string): string => template.replace(/\{\{([^}]+)\}\}/g, (match: string, key: string) => {
    const values: Record<string, string> = {
      number,
      extract_filename: filenamePart,
      extract_title: extractTitle,
    }
    return values[key] ?? match
  })
  const resolvedNumber = resolve(numberTemplate)
  const resolvedExtractNumber = resolve(extractTemplate)
  const identification = `${resolvedNumber}${resolvedExtractNumber}`.trim()
  return identification === '' || identification.includes('{{') ? undefined : identification
}

const renderIssueLabel = computed(() => {
  const warnings = renderIssueItems.value.filter((issue) => issue.severity === 'warning').length
  const errors = renderIssueItems.value.filter((issue) => issue.severity === 'error').length
  if (errors > 0) return `${errors} error(s)`
  if (warnings > 0) return `${warnings} warning(s)`
  return 'Rendered'
})

const renderIssueTone = computed(() => {
  if (renderIssueItems.value.some((issue) => issue.severity === 'error')) return 'danger'
  if (renderIssueItems.value.some((issue) => issue.severity === 'warning')) return 'warning'
  return 'success'
})

const renderIssueItems = computed<RenderIssueChipItem[]>(() => {
  const items: RenderIssueChipItem[] = [
    ...songConfigInspection.value.issues.map((issue) => ({
      severity: 'error' as const,
      message: `${issue.path === undefined ? '' : `${issue.path}: `}${issue.message}`,
      source: issue.kind === 'syntax' ? 'Konfigurations-JSON' : 'Konfigurationsprüfung',
    })),
    ...(renderError.value === ''
      ? []
      : [{ severity: 'error' as const, message: renderError.value, source: 'Renderpipeline' }]),
    ...renderIssues.value.map((issue) => ({
      severity: issue.severity,
      message: issue.message,
      source: issue.source === ABC_PARSER_DIAGNOSTIC_SOURCE ? 'ABC-Parser' : issue.source ?? 'Renderpipeline',
      location: issue.line === undefined
        ? undefined
        : `Zeile ${issue.line}${issue.column === undefined ? '' : `, Spalte ${issue.column}`}`,
    })),
    ...workbenchDiagnostics.value.map((diagnostic) => ({
      severity: diagnostic.severity,
      message: diagnostic.message,
      source: diagnostic.source === ABC_PARSER_DIAGNOSTIC_SOURCE ? 'ABC-Parser' : diagnostic.source ?? 'Workbench',
      location: diagnostic.startPos === undefined
        ? undefined
        : `Zeile ${diagnostic.startPos[0]}, Spalte ${diagnostic.startPos[1]}`,
    })),
  ]
  const seen = new Set<string>()
  return items.filter((item) => {
    const comparableMessage = item.message.replace(/^line\s+\d+\s*:\s*/i, '').trim().toLocaleLowerCase()
    const key = `${item.severity}|${comparableMessage}|${item.location ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})

const playbackStatusOverlay = computed(() => {
  if (playbackStore.state.status !== 'playing') return undefined
  const measureNumber = playbackStore.highlight.measureNumber
  const passIndex = playbackStore.highlight.passIndex
  if (measureNumber === undefined || passIndex === undefined) return undefined
  return {
    measureNumber,
    partName: playbackStore.highlight.partName,
    passIndex,
  }
})

const playbackBaseTempoBpm = computed(() => baseTempoFromQ.value ?? 120)
const playbackTempoBpm = computed(() => Math.max(1, Math.round(
  playbackBaseTempoBpm.value * playbackStore.state.speedFactor,
)))
const playbackDivisionDefault = computed(() => playbackTimeline.value.find(
  (step) => step.meter !== undefined,
)?.meter?.numerator ?? 4)

function setPlaybackTempoBpm(bpm: number): void {
  playbackStore.setSpeedFactor(bpm / playbackBaseTempoBpm.value)
}

function adjustPlaybackTempoBpm(delta: number): void {
  setPlaybackTempoBpm(playbackTempoBpm.value + delta)
}

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
  const extractConfig = parsedSongConfig.value.extract ?? {}
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
  const config = parsedSongConfig.value
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
const PLAYBACK_URL_WARNING_LENGTH = 1800
let nextRenderRequestId = 0
let pendingRenderRequestId: number | undefined
let renderTimer: ReturnType<typeof setTimeout> | undefined
let pdfPreviewRequestId = 0
let documentPersistenceQueue = Promise.resolve()

function appendDiagnosticLine(message: string, severity: 'warning' | 'error', source?: string): void {
  const prefix = source === undefined || source === ''
    ? ''
    : `${source}: `
  if (severity === 'error') {
    logger.error(`${prefix}${message}`)
    return
  }
  logger.warning(`${prefix}${message}`)
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

async function restoreCurrentAbcText(): Promise<void> {
  if (initialDocument !== undefined) return
  try {
    const indexedDocument = await loadCurrentDocumentFromIndexedDb()
    if (indexedDocument !== undefined) {
      documentText.value = indexedDocument
      return
    }
  } catch (error) {
    logger.warning(`IndexedDB konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`)
  }

  const raw = localStorage.getItem(abcTextKey)
  if (raw !== null && raw !== INDEXED_DB_DOCUMENT_MARKER) {
    documentText.value = raw
  }
}

function restoreWorkbenchUiState(): void {
  const raw = localStorage.getItem(workbenchUiStateKey)
  if (raw === null) return
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return
    const state = parsed as Record<string, unknown>
    if (typeof state.editorTab === 'string') editorTab.value = state.editorTab
    if (typeof state.viewPerspective === 'string' && viewPerspectiveItems.some((item) => item.id === state.viewPerspective)) {
      viewPerspective.value = state.viewPerspective as ViewPerspective
    }
    if (state.maximizedPanel === null || state.maximizedPanel === 'editor' || state.maximizedPanel === 'score' || state.maximizedPanel === 'harp') {
      maximizedPanel.value = state.maximizedPanel
    }
    if (typeof state.editorPaneSize === 'number' && Number.isFinite(state.editorPaneSize) && state.editorPaneSize > 0) editorPaneSize.value = state.editorPaneSize
    if (typeof state.previewPaneSize === 'number' && Number.isFinite(state.previewPaneSize) && state.previewPaneSize > 0) previewPaneSize.value = state.previewPaneSize
    if (typeof state.activeConfigSection === 'string') activeConfigSection.value = state.activeConfigSection
    if (typeof state.currentExtract === 'number' && Number.isInteger(state.currentExtract) && state.currentExtract >= 0) {
      currentExtract.value = state.currentExtract
      playbackStore.setActiveExtract(currentExtract.value)
    }
  } catch {
    // ignore malformed UI state
  }
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

async function persistCurrentAbcText(value: string): Promise<void> {
  try {
    await saveCurrentDocumentToIndexedDb(value)
    localStorage.setItem(abcTextKey, INDEXED_DB_DOCUMENT_MARKER)
    return
  } catch (error) {
    try {
      localStorage.removeItem(abcTextKey)
      localStorage.setItem(abcTextKey, value)
      logger.warning(`Dokument wird ersatzweise in LocalStorage gespeichert: ${error instanceof Error ? error.message : String(error)}`)
    } catch (fallbackError) {
      logger.error(`Dokument konnte nicht dauerhaft gespeichert werden: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`)
    }
  }
}

function persistWorkbenchUiState(): void {
  try {
    localStorage.setItem(workbenchUiStateKey, JSON.stringify({
      editorTab: editorTab.value,
      viewPerspective: viewPerspective.value,
      maximizedPanel: maximizedPanel.value,
      editorPaneSize: editorPaneSize.value,
      previewPaneSize: previewPaneSize.value,
      activeConfigSection: activeConfigSection.value,
      currentExtract: currentExtract.value,
    }))
  } catch (error) {
    logger.warning(`Bildschirmzustand konnte nicht gespeichert werden: ${error instanceof Error ? error.message : String(error)}`)
  }
}

watch(storageState, persistStorageContext, { deep: true })

watch(storageConnections, (connections) => {
  saveStorageConnections(connections)
}, { deep: true })

watch(saveTooltip, () => {
  void nextTick().then(setupFileToolbarTooltips)
})

watch(documentText, (value) => {
  documentPersistenceQueue = documentPersistenceQueue.then(() => persistCurrentAbcText(value))
})

watch([editorTab, viewPerspective, maximizedPanel, editorPaneSize, previewPaneSize, activeConfigSection, currentExtract], persistWorkbenchUiState)

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
    logger.info(record.message)
    return
  }
  if (record.kind === 'perf' && typeof record.totalMs === 'number') {
    logger.info(`worker: perf total ${record.totalMs.toFixed(3)} ms`)
    return
  }
  if (record.kind === 'result') {
    if (pendingRenderRequestId !== record.id) return
    pendingRenderRequestId = undefined
    if (record.result !== undefined) {
      applyRenderResult(record.result)
    }
    if (record.error !== undefined) {
      logger.error(`worker: render failed: ${record.error}`)
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
  song.value = result.song
  baseTempoFromQ.value = result.baseTempoFromQ
  tempoUnitFromQ.value = result.tempoUnitFromQ
  playbackConfig.value = result.playbackConfig
  metronomeMode.value = result.playbackConfig?.metronomeMode ?? 'off'
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
  void ensurePlayerQrForRenderedExtract(result)
}

async function ensurePlayerQrForRenderedExtract(result: WorkbenchRenderResult): Promise<void> {
  if (playerQrJpegUrl.value !== undefined || !documentText.value.includes(PLAYER_QR_IMAGE_NAME)) return

  const sourceDocument = documentText.value
  const sourceExtract = currentExtract.value
  const playerUrl = new URL('https://zupfnoter-player.csweichel.dev/')
  const identification = resolvePlaybackIdentification()
  if (identification !== undefined) playerUrl.searchParams.set('id', identification)

  try {
    const playbackLink = await createPlaybackLinkFromTimeline(
      result.playbackTimeline,
      playerUrl.toString(),
      result.activeVoiceIds.length > 0 ? new Set(result.activeVoiceIds) : undefined,
      10,
      result.baseTempoFromQ,
      result.tempoUnitFromQ,
      result.playbackConfig,
    )
    const qrJpegUrl = await createPlayerQrJpeg(playbackLink.url)
    if (documentText.value !== sourceDocument || currentExtract.value !== sourceExtract) return
    playerQrJpegUrl.value = qrJpegUrl
    renderNow()
  } catch (error) {
    logger.error(`player QR render skipped: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function refreshHarpPdfPreview(): Promise<void> {
  if (harpPreviewMode.value !== 'pdf') return

  const requestId = ++pdfPreviewRequestId
  harpPdfPreviewLoading.value = true
  harpPdfPreviewError.value = ''
  const previousUrl = harpPdfPreviewUrl.value
  harpPdfPreviewUrl.value = undefined

  if (previousUrl !== undefined) URL.revokeObjectURL(previousUrl)

  const playerUrl = new URL('https://zupfnoter-player.csweichel.dev/')
  const identification = resolvePlaybackIdentification()
  if (identification !== undefined) playerUrl.searchParams.set('id', identification)

  try {
    const pdf = await renderPdfExport(documentText.value, currentExtract.value, 'A3', {
      resources: documentResources.value,
      playerQrJpegUrl: playerQrJpegUrl.value,
      playerUrl: playerUrl.toString(),
    })
    if (requestId !== pdfPreviewRequestId) return
    harpPdfPreviewUrl.value = URL.createObjectURL(pdf)
  } catch (error) {
    if (requestId !== pdfPreviewRequestId) return
    harpPdfPreviewError.value = error instanceof Error ? error.message : String(error)
  } finally {
    if (requestId === pdfPreviewRequestId) harpPdfPreviewLoading.value = false
  }
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
        playerQrJpegUrl: playerQrJpegUrl.value,
        resources: documentResources.value,
        flowconf: flowconfEnabled.value,
      })
      return
    }
    logger.info(`worker: render extract ${currentExtract.value}`)
    const result = renderWorkbenchPreviews(documentText.value, currentExtract.value, {
      playerQrJpegUrl: playerQrJpegUrl.value,
      resources: documentResources.value,
      flowconf: flowconfEnabled.value,
    })
    applyRenderResult(result)
    logger.info('worker: render complete in 0.000 sec')
  } catch (error) {
    logger.error(`worker: render failed: ${error instanceof Error ? error.message : String(error)}`)
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

async function dispatchShortcutCommand(command: string): Promise<void> {
  await executeToolbarCommand(command)
}

async function executeCommand(command: string): Promise<void> {
  commandBusy.value = true
  logger.command(command)
  try {
    await commandStack.runString(command)
  } catch (error) {
    handleCommandError(command, error)
  } finally {
    commandBusy.value = false
  }
}

async function executeToolbarCommand(command: string, errorToastTitle?: string): Promise<boolean> {
  commandBusy.value = true
  logger.command(command)
  try {
    await commandStack.runString(command)
    return true
  } catch (error) {
    return !handleCommandError(command, error, errorToastTitle)
  } finally {
    commandBusy.value = false
  }
}

function handleCommandError(command: string, error: unknown, errorToastTitle?: string): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const enrichedMessage = enrichCommandError(command, message)
  logger.error(enrichedMessage)

  if (error instanceof StorageTargetUnavailableError) {
    saveResultDialogOpen.value = false
    returnToStorageOpenDialog.value = false
    storageConnectionsDialogOpen.value = true
    return true
  }

  pushToast({
    severity: 'danger',
    title: errorToastTitle ?? 'Kommando fehlgeschlagen',
    message: enrichedMessage,
    persistent: true,
  })
  return false
}

async function executeParsedToolbarCommand(
  command: string,
  commandName: string,
  values: CommandArgumentValue[],
): Promise<boolean> {
  commandBusy.value = true
  logger.command(command)
  try {
    await commandStack.runParsedCommand(commandName, values)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(enrichCommandError(command, message))
    return false
  } finally {
    commandBusy.value = false
  }
}

function handleConfigEditorIntent(intent: ConfigEditorIntent): void {
  if (intent.action === 'config.replaceRaw' && typeof intent.value === 'string') {
    documentText.value = replaceSongDocumentConfigText(documentText.value, intent.value)
    configEntryMutationVersion.value += 1
    renderNow()
    return
  }

  if (intent.action === 'config.selectAffectedObject' && intent.path !== undefined) {
    const confKey = resolveConfKeyForConfigPath(selectionStore.sheetObjectIndex, intent.path)
    const selectedIndexes = resolveIndexesByConfigPath(selectionStore.sheetObjectIndex, intent.path)
    if (confKey === undefined) {
      logger.warning(`config selection: ${intent.path} -> kein confKey gefunden`)
      return
    }
    selectionStore.dispatchSelectionEvent(createConfKeySelectedSelectionEvent(confKey, 'config-editor'))
    logger.info(
      `config selection: ${intent.path} -> ${confKey} -> `
      + `${selectedIndexes.length} Objekt(e): [${selectedIndexes.join(', ')}]`,
    )
    return
  }

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

  logger.info(`config intent: ${intent.action}${intent.path ? ` ${intent.path}` : ''}`)
}

function canSelectConfigPath(path: string): boolean {
  return resolveConfKeyForConfigPath(selectionStore.sheetObjectIndex, path) !== undefined
}

function closeFileMenu(): void {
  if (fileMenuElement.value !== null) {
    fileMenuElement.value.open = false
  }
}

function handleFileToolbarAction(action: FileToolbarAction): void {
  closeFileMenu()
  if (action === 'open') {
    prepareStorageOpenDocuments()
    storageOpenDialogOpen.value = true
    return
  }
  if (action === 'storage-connections') {
    returnToStorageOpenDialog.value = false
    storageConnectionsDialogOpen.value = true
    return
  }
  if (action === 'import') {
    localFileInput.value?.click()
    return
  }
  const placeholderMessage = fileToolbarPlaceholderMessage(action)
  if (placeholderMessage !== undefined) {
    pushToast({
      severity: 'info',
      title: 'Datei',
      message: placeholderMessage,
    })
    logger.info(placeholderMessage)
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
    void saveDocument()
  }
}

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') === true
}

function handleFileDragOver(event: DragEvent): void {
  if (!hasFiles(event)) return
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy'
  fileDropActive.value = true
}

function handleFileDragLeave(event: DragEvent): void {
  if (!hasFiles(event)) return
  const currentTarget = event.currentTarget
  if (currentTarget instanceof HTMLElement && currentTarget.contains(event.relatedTarget as Node | null)) return
  fileDropActive.value = false
}

async function importLocalFile(file: File): Promise<void> {
  try {
    const imported = await readLocalImport(file)
    if (imported.kind === 'abc') {
      documentText.value = imported.text
      savedDocumentText.value = imported.text
      renderNow()
      pushToast({ severity: 'success', title: 'Datei importiert', message: `„${file.name}“ wurde geöffnet.` })
      return
    }
    const key = resourceKeyFromFileName(imported.name)
    documentText.value = replaceSongDocumentResources(documentText.value, {
      ...documentResources.value,
      [key]: [imported.dataUri],
    })
    activeConfigSection.value = 'images'
    editorTab.value = 'config'
    renderNow()
    pushToast({ severity: 'success', title: 'Ressource importiert', message: `„${file.name}“ wurde als Ressource übernommen.` })
  } catch (error) {
    const message = error instanceof UnsupportedImportError || error instanceof Error
      ? error.message
      : `„${file.name}“ konnte nicht gelesen werden`
    logger.error(message)
    pushToast({ severity: 'danger', title: 'Import fehlgeschlagen', message })
  }
}

async function importLocalFiles(files: readonly File[]): Promise<void> {
  for (const file of files) {
    await importLocalFile(file)
  }
}

function handleFileDrop(event: DragEvent): void {
  if (!hasFiles(event)) return
  event.preventDefault()
  event.stopPropagation()
  fileDropActive.value = false
  const files = event.dataTransfer === null ? [] : Array.from(event.dataTransfer.files)
  if (files.length > 0) void importLocalFiles(files)
}

function handleLocalFileInput(event: Event): void {
  const input = event.currentTarget
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.item(0)
  input.value = ''
  if (file !== null && file !== undefined) void importLocalFile(file)
}

function handleEditorEditAction(action: 'format'): void {
  if (editorEditMenuElement.value !== null) {
    editorEditMenuElement.value.open = false
  }
  if (action === 'format') {
    void executeToolbarCommand('format_abc', 'ABC-Formatierung nicht möglich')
  }
}

async function saveDocument(): Promise<void> {
  if (saveInProgress.value) return
  saveInProgress.value = true
  saveResultComplete.value = false
  saveProgressCompleted.value = 0
  saveProgressTotal.value = 0
  saveProgressFile.value = ''
  saveArtifactsProgress.value = []
  saveResultDialogOpen.value = true
  try {
    const saved = await executeToolbarCommand('ssave', 'Speichern nicht möglich')
    if (!saved) saveResultDialogOpen.value = false
  } finally {
    saveInProgress.value = false
  }
}

async function searchStorageDocuments(query: string): Promise<void> {
  if (query.trim() === '') return
  if (storageOpenDocumentsLoaded.value || storageOpenLoading.value) return
  const connection = activeStorageConnection.value
  if (connection === undefined) return
  const adapter = storageProviderRegistry.adapterFor(storageState, storageConnections.value)
  if (adapter.listDocuments === undefined) return
  const cacheKey = storageOpenDocumentCacheKey()
  const cachedDocuments = storageOpenDocumentCache.get(cacheKey)
  if (cachedDocuments !== undefined) {
    storageOpenDocuments.value = cachedDocuments
    storageOpenDocumentsLoaded.value = true
    return
  }
  storageOpenLoading.value = true
  try {
    const documents = await adapter.listDocuments(storageState)
    storageOpenDocumentCache.set(cacheKey, documents)
    storageOpenDocuments.value = documents
    storageOpenDocumentsLoaded.value = true
  } catch (error) {
    pushToast({ severity: 'warning', title: 'Öffnen', message: error instanceof Error ? error.message : String(error) })
  } finally { storageOpenLoading.value = false }
}

function storageOpenDocumentCacheKey(): string {
  return `${storageState.connectionId ?? '-'}:${storageState.rootPath}:${storageState.path}`
}

function prepareStorageOpenDocuments(): void {
  const cachedDocuments = storageOpenDocumentCache.get(storageOpenDocumentCacheKey())
  storageOpenDocuments.value = cachedDocuments ?? []
  storageOpenDocumentsLoaded.value = cachedDocuments !== undefined
}

function refreshStorageDocuments(query: string): void {
  storageOpenDocumentCache.delete(storageOpenDocumentCacheKey())
  storageOpenDocuments.value = []
  storageOpenDocumentsLoaded.value = false
  void searchStorageDocuments(query)
}

async function openStorageDocument(document: StorageDocument): Promise<void> {
  storageOpenOpening.value = true
  try {
    const opened = await executeParsedToolbarCommand(
      `sopen ${JSON.stringify(document.path)}`,
      'sopen',
      ['', document.path],
    )
    if (opened) {
      savedDocumentText.value = documentText.value
      storageOpenDialogOpen.value = false
    }
  } finally {
    storageOpenOpening.value = false
  }
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

async function activateStorageConnection(connectionId: string): Promise<void> {
  const connection = storageConnections.value.find((entry) => entry.id === connectionId)
  if (connection?.status === 'disconnected') {
    connectStorageConnection(connectionId)
    return
  }
  const activated = await executeToolbarCommand(`sconnection ${connectionId}`)
  if (!activated) return
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
    const content = element.dataset.fileToolbarTooltip
    if (content === undefined || content === '') continue
    const existing = fileToolbarTooltips.get(element)
    if (existing !== undefined) {
      existing.setContent(content)
      continue
    }
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

function toggleConsole(): void {
  editorTab.value = editorTab.value === 'console' ? 'abc' : 'console'
}

async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement !== null) {
    await document.exitFullscreen()
    return
  }
  await document.documentElement.requestFullscreen()
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard !== undefined) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Fall through to the compatibility path below.
    }
  }

  const input = document.createElement('textarea')
  input.value = value
  input.setAttribute('readonly', 'true')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } finally {
    input.remove()
  }
  return copied
}

async function exportPlaybackLinkCommand(): Promise<void> {
  const playerUrl = new URL('https://zupfnoter-player.csweichel.dev/')
  const identification = resolvePlaybackIdentification()
  if (identification !== undefined) playerUrl.searchParams.set('id', identification)
  const result = await createPlaybackLinkFromTimeline(
    playbackTimeline.value,
    playerUrl.toString(),
    activeVoiceIds.value.length > 0 ? new Set(activeVoiceIds.value) : undefined,
    10,
    baseTempoFromQ.value,
    tempoUnitFromQ.value,
    playbackConfig.value,
  )
  const qrCodeDataUrl = await QRCode.toDataURL(result.url, {
    errorCorrectionLevel: 'L',
    margin: 4,
    width: 320,
  })
  playerQrJpegUrl.value = await createPlayerQrJpeg(result.url)
  renderNow()
  const urlLength = result.url.length
  const qrAssessment = urlLength < 1500
    ? { severity: 'info' as const, label: 'QR-Code: gut' }
    : urlLength < 2000
      ? { severity: 'warning' as const, label: 'QR-Code: dicht, aber brauchbar' }
      : urlLength < 2500
        ? { severity: 'warning' as const, label: 'QR-Code: kritisch' }
        : { severity: 'danger' as const, label: 'QR-Code: eher ungeeignet' }
  const isLongUrl = urlLength >= PLAYBACK_URL_WARNING_LENGTH
  const analysis = result.analysis
  const formatBytes = (value: number): string => `${value.toLocaleString('de-DE')} Byte`
  const sizeMessage = `URL-Länge: ${urlLength.toLocaleString('de-DE')} Zeichen · ${qrAssessment.label}.`
  const userSummary = [
    `Ereignisse: ${analysis.eventCount.toLocaleString('de-DE')}`,
    sizeMessage,
  ].join('\n')
  logger.info(`playback link analysis: events=${analysis.eventCount}, binary=${formatBytes(analysis.binaryBytes)}, compressed=${formatBytes(analysis.compressedBytes)}, base64=${analysis.base64UrlChars} chars, bytes/event=${analysis.bytesPerEvent.toFixed(2)}`)
  const copied = await copyTextToClipboard(result.url)
  if (copied) {
    logger.info('playback link copied to clipboard')
    const identityMessage = identification === undefined ? '' : ` (${identification})`
    pushToast({ severity: qrAssessment.severity, title: 'Playback-Link', message: isLongUrl
      ? `${userSummary}\nDer Link${identityMessage} ist lang und kann sich für QR-Code oder Messenger schlecht eignen.`
      : `${userSummary}\nDer Playback-Link${identityMessage} wurde in die Zwischenablage kopiert.`, qrCodeDataUrl, persistent: true })
    return
  }

  logger.error(`playback link could not be copied: ${result.url}`)
  window.prompt('Playback-Link manuell kopieren:', result.url)
  pushToast({ severity: 'warning', title: 'Playback-Link', message: `${userSummary}\nDas automatische Kopieren wurde vom Browser blockiert. Der Link wurde zur manuellen Übernahme angezeigt.`, qrCodeDataUrl, persistent: true })
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
    logger.info(`sound set to ${sound}`)
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
  logger.info(`saved ${id} to local storage`)
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
  log: (message) => logger.output(message),
  shortcutHelp: () => shortcutManager.help().map((binding) => shortcutManager.format(binding)),
})

let resetConfigHistory = (): void => undefined

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
  resetConfigHistory: () => resetConfigHistory(),
  save: async (path, filename, content) => storageProviderRegistry.adapterFor(path, storageConnections.value).save(path, filename, content),
  saveArtifacts: async (path, filebase, content) => {
    const adapter = storageProviderRegistry.adapterFor(path, storageConnections.value)
    const extracts = resolvePdfExportVariants(content, currentExtract.value)
    const playerUrl = new URL('https://zupfnoter-player.csweichel.dev/')
    const identification = resolvePlaybackIdentification()
    if (identification !== undefined) playerUrl.searchParams.set('id', identification)
    const abcName = `${filebase}.abc`
    const htmlName = `${filebase}.html`
    const plans: SaveArtifactPlan[] = [
      { name: abcName, create: async () => content },
      { name: htmlName, create: async () => renderHtmlExport(content) },
    ]
    for (const extract of extracts) {
      const suffix = extract.filenamepart
      if (saveFormat.value.includes('A3')) {
        const name = pdfOutputFilename(filebase, suffix, 'A3')
        plans.push({ name, create: async () => renderPdfExport(content, extract.extractNr, 'A3', {
          playerUrl: playerUrl.toString(),
        }) })
      }
      if (saveFormat.value.includes('A4')) {
        const name = pdfOutputFilename(filebase, suffix, 'A4')
        plans.push({ name, create: async () => renderPdfExport(content, extract.extractNr, 'A4', {
          playerUrl: playerUrl.toString(),
        }) })
      }
    }
    const names: string[] = []
    const failedNames: string[] = []
    saveResultDialogOpen.value = true
    saveResultComplete.value = false
    saveProgressCompleted.value = 0
    saveProgressTotal.value = plans.length
    saveArtifactsProgress.value = plans.map((plan) => ({ name: plan.name, status: 'pending' }))
    const saveArtifact = async (plan: SaveArtifactPlan, index: number): Promise<void> => {
      saveProgressFile.value = plan.name
      saveArtifactsProgress.value = saveArtifactsProgress.value.map((artifact, artifactIndex) => artifactIndex === index
        ? { ...artifact, status: 'saving' }
        : artifact)
      try {
        await adapter.save(path, plan.name, await plan.create())
        names.push(plan.name)
        saveArtifactsProgress.value = saveArtifactsProgress.value.map((artifact, artifactIndex) => artifactIndex === index
          ? { ...artifact, status: 'saved' }
          : artifact)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failedNames.push(plan.name)
        logger.error(`save ${plan.name}: ${message}`)
        pushToast({
          severity: 'danger',
          title: 'Speichern fehlgeschlagen',
          message: `${plan.name}\nSpeicherziel: ${activeStorageConnection.value?.label ?? storageState.system}\n${message}`,
          persistent: true,
        })
        saveArtifactsProgress.value = saveArtifactsProgress.value.map((artifact, artifactIndex) => artifactIndex === index
          ? { ...artifact, status: 'failed', error: message }
          : artifact)
      }
      saveProgressCompleted.value = saveArtifactsProgress.value.filter((artifact) => artifact.status === 'saved' || artifact.status === 'failed').length
    }
    for (const [index, plan] of plans.entries()) {
      await saveArtifact(plan, index)
    }
    if (!saveResultHasFailures.value) savedDocumentText.value = content
    saveResultComplete.value = true
    saveResultDialogOpen.value = true
    return { saved: names, failed: failedNames }
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

const legacyCommandController = registerLegacyCommands(commandStack, {
    getAbcText: () => documentText.value,
    setAbcText: setAbcFromCommand,
    setResource: (key, value) => {
      const parts = Array.from({ length: Math.ceil(value.length / 60) }, (_entry, index) => value.slice(index * 60, (index + 1) * 60))
      documentText.value = replaceSongDocumentResources(documentText.value, { ...documentResources.value, [key]: parts })
    },
    deleteResource: (key) => {
      const resources = { ...documentResources.value }
      delete resources[key]
      documentText.value = replaceSongDocumentResources(documentText.value, resources)
    },
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
    workbenchConfig.setRuntimeSetting(key, value)
    if (key === 'flowconf') renderNow()
  },
  getSetting: (key) => workbenchConfig.getRuntimeSetting(key) ?? runtimeSettings.value[key],
  listSettings: () => ({ ...runtimeSettings.value, ...workbenchConfig.runtimeSettings }),
  downloadAbc,
  listLocalStore,
  saveLocalStore: saveToLocalStore,
  openLocalStore: openFromLocalStore,
  setConfigHistoryState: ({ canUndo, canRedo }) => {
      configCanUndo.value = canUndo
      configCanRedo.value = canRedo
  },
})
resetConfigHistory = legacyCommandController.resetConfigHistory

commandStack.addCommand({
  name: 'toggleconsole',
  help: 'show or hide the console',
  undoable: false,
  perform: () => toggleConsole(),
})

commandStack.addCommand({
  name: 'togglefullscreen',
  help: 'toggle fullscreen mode',
  undoable: false,
  perform: () => toggleFullscreen(),
})

commandStack.addCommand({
  name: 'toggleharpfullscreen',
  help: 'show or restore harp notes in the full workbench area',
  undoable: false,
  perform: () => togglePanelMaximize('harp'),
})

commandStack.addCommand({
  name: 'playbacklink',
  help: 'create a playback link from the current timeline',
  undoable: false,
  perform: () => exportPlaybackLinkCommand(),
})

shortcutManager.register({
  id: 'save',
  keys: ['Mod-S'],
  command: 'ssave',
  scope: 'global',
  label: 'Speichern',
  help: 'Aktuelles Dokument speichern',
  enabled: () => !saveInProgress.value,
})
shortcutManager.register({
  id: 'render',
  keys: ['Mod-R', 'Mod-Enter'],
  command: 'render',
  scope: 'global',
  label: 'Rendern',
  help: 'Vorschau aktualisieren',
})
shortcutManager.register({
  id: 'play',
  keys: ['Mod-P'],
  command: 'p auto',
  scope: 'global',
  label: 'Abspielen',
  help: 'Aktuelles Stück abspielen',
})
shortcutManager.register({
  id: 'console',
  keys: ['Mod-K'],
  command: 'toggleconsole',
  scope: 'global',
  label: 'Konsole',
  help: 'Konsole ein- oder ausblenden',
})
shortcutManager.register({
  id: 'harp-fullscreen',
  keys: ['Mod-L'],
  command: 'toggleharpfullscreen',
  scope: 'global',
  label: 'Harfennoten-Vollbild',
  help: 'Harfennoten im gesamten Workbench-Bereich anzeigen oder Ansicht wiederherstellen',
})
for (const extractNumber of Array.from({ length: 10 }, (_, index) => index)) {
  shortcutManager.register({
    id: `view-${extractNumber}`,
    keys: [`Mod-${extractNumber}`],
    command: (event) => `view ${event.key}`,
    scope: 'global',
    label: `Auszug ${extractNumber}`,
    help: `Auszug ${extractNumber} anzeigen`,
  })
}
shortcutManager.register({
  id: 'config-undo',
  keys: ['Mod-Z'],
  command: 'undoconfig',
  scope: 'global',
  label: 'Konfiguration zurücknehmen',
  help: 'Letzte Konfigurationsänderung zurücknehmen',
  enabled: () => editorTab.value === 'config',
})
shortcutManager.register({
  id: 'config-redo',
  keys: ['Mod-Y', 'Mod-Shift-Z'],
  command: 'redoconfig',
  scope: 'global',
  label: 'Konfiguration wiederholen',
  help: 'Zurückgenommene Konfigurationsänderung wiederholen',
  enabled: () => editorTab.value === 'config',
})


function handleEditorCursorChange(position: { offset: number, line: number, column: number, unicode: string | undefined }): void {
  editorCursorOffset.value = position.offset
  editorCursorUnicode.value = position.unicode
  const line = String(position.line).padStart(2, '0')
  const column = String(position.column).padStart(2, '0')
  editorCursor.value = `${line}:${column}`
}

function handleEditorSelectionChange(payload: {
  startpos: number
  endpos: number
  start: { line: number; column: number }
  end: { line: number; column: number }
  ranges?: Array<{ startpos: number; endpos: number }>
  extend?: boolean
  startNewSegment?: boolean
}): void {
  const ranges = (payload.ranges ?? [{ startpos: payload.startpos, endpos: payload.endpos }])
    .filter((range) => range.startpos !== range.endpos)
  if (ranges.length > 1) {
    selectionStore.dispatchSelectionEvent(
      createTextRangesSelectionEvent(ranges, 'abc-editor'),
    )
    return
  }

  if (payload.startpos === payload.endpos) {
    selectionStore.dispatchSelectionEvent(
      createSongLoadedSelectionEvent('abc-editor', selectionStore.selection.voiceScope),
    )
    return
  }

  selectionStore.dispatchSelectionEvent(
    createTextRangeSelectionEvent(
      payload.startpos,
      payload.endpos,
      'abc-editor',
      payload.extend,
      undefined,
      payload.startNewSegment,
    ),
  )
}

function handleSelectionVoiceScopeChange(voiceScope: 'single-voice' | 'extract-voices' | 'all-voices'): void {
  selectionStore.dispatchSelectionEvent(createScopeChangedSelectionEvent(voiceScope))
}

watch([documentText, currentExtract], () => {
  playerQrJpegUrl.value = undefined
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
  startNewSegment: boolean
  origin?: SelectionOrigin
  source: 'harp-preview'
}): void {
  if (!canTargetCreateSelection(payload.source, 'textRange')) return
  selectionStore.dispatchSelectionEvent(
    createTextRangeSelectionEvent(
      payload.startpos,
      payload.endpos,
      payload.source,
      payload.extend,
      payload.origin,
      payload.startNewSegment,
    ),
  )
}

function handleHarpPreviewSelectionGesture(active: boolean): void {
  selectionStore.dispatchSelectionEvent(createSelectionInteractionEvent(active))
}

function handleScorePreviewSelectionGesture(active: boolean): void {
  selectionStore.dispatchSelectionEvent(createSelectionInteractionEvent(active))
}

function handleScorePreviewBackgroundClick(): void {
  selectionStore.dispatchSelectionEvent(createPreviewBackgroundClickedSelectionEvent('score-preview'))
}

function handleHarpPreviewBackgroundClick(): void {
  selectionStore.dispatchSelectionEvent(createPreviewBackgroundClickedSelectionEvent('harp-preview'))
}

function handleHarpPreviewDragEnd(payload: HarpPreviewDragEnd): void {
  if (payload.updates !== undefined) {
    for (const update of payload.updates) {
      void executeParsedToolbarCommand(
        `cconf ${update.confKey} ${JSON.stringify(update.value)}`,
        'cconf',
        [update.confKey, update.value],
      )
    }
    return
  }
  if (payload.value === undefined) {
    logger.warning(`dragend ${payload.handler}: kein konfigurierbarer Zielwert für ${payload.confKey}`)
    return
  }
  void executeParsedToolbarCommand(
    `cconf ${payload.confKey} ${JSON.stringify(payload.value)}`,
    'cconf',
    [payload.confKey, payload.value],
  )
}

function handleHarpResourceDrop(payload: {
  resourceKey: string
  targetConfKey?: string
  position: [number, number]
}): void {
  const targetPath = payload.targetConfKey?.endsWith('.pos')
    ? payload.targetConfKey.replace(/\.pos$/, '.imagename')
    : undefined
  if (targetPath !== undefined) {
    void executeParsedToolbarCommand(
      `cconf ${targetPath} ${JSON.stringify(payload.resourceKey)}`,
      'cconf',
      [targetPath, payload.resourceKey],
    )
    return
  }

  const config = parsedSongConfig.value
  const extract = config.extract?.[String(currentExtract.value)]
  const images = extract?.images ?? {}
  const numericKeys = Object.keys(images)
    .map((key) => Number(key))
    .filter((key) => Number.isInteger(key) && key >= 0)
  const nextKey = numericKeys.length === 0 ? 0 : Math.max(...numericKeys) + 1
  const path = `extract.${currentExtract.value}.images.${nextKey}`
  const value = {
    imagename: payload.resourceKey,
    show: true,
    pos: payload.position,
    height: 100,
  }
  void executeParsedToolbarCommand(`cconf ${path} ${JSON.stringify(value)}`, 'cconf', [path, value])
}

function handleHarpPreviewContextMenu(payload: {
  action: 'set' | 'edit' | 'reset-shape' | 'delete-shape'
  path: string
  value?: CommandArgumentValue
}): void {
  if (payload.action === 'edit') {
    void executeToolbarCommand(`editconf ${payload.path}`)
    return
  }
  if (payload.action === 'delete-shape') {
    void executeToolbarCommand(`delconfig ${payload.path}`)
    return
  }
  if (payload.action === 'reset-shape') {
    if (!isRecordValue(payload.value)) return
    const cp1 = payload.value.cp1
    const cp2 = payload.value.cp2
    if (!isPointValue(cp1) || !isPointValue(cp2)) return
    void executeParsedToolbarCommand(
      `cconf ${payload.path}.cp1 ${JSON.stringify(cp1)}`,
      'cconf',
      [`${payload.path}.cp1`, cp1],
    ).then((succeeded) => {
      if (!succeeded) return
      void executeParsedToolbarCommand(
        `cconf ${payload.path}.cp2 ${JSON.stringify(cp2)}`,
        'cconf',
        [`${payload.path}.cp2`, cp2],
      )
    })
    return
  }
  if (payload.value === undefined) return
  void executeParsedToolbarCommand(
    `cconf ${payload.path} ${JSON.stringify(payload.value)}`,
    'cconf',
    [payload.path, payload.value],
  ).then((succeeded) => {
    if (succeeded) {
      void executeToolbarCommand(`editconf ${payload.path.replace(/\.[^.]+$/, '')}`)
    }
  })
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPointValue(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && typeof value[0] === 'number'
    && typeof value[1] === 'number'
}

function handleHarpPreviewConfigHover(payload: { confKey?: string }): void {
  hoveredConfigKey.value = payload.confKey
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
  startNewSegment: boolean
  origin?: SelectionOrigin
  source: 'score-preview'
}): void {
  if (!canTargetCreateSelection(payload.source, 'textRange')) return
  selectionStore.dispatchSelectionEvent(
    createTextRangeSelectionEvent(
      payload.startpos,
      payload.endpos,
      payload.source,
      payload.extend,
      payload.origin,
      payload.startNewSegment,
    ),
  )
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  shortcutManager.handle(event)
}

watch(
  [documentText, currentExtract, harpSvg, renderError, harpZoom, harpScrollLeft, harpScrollTop, () => playbackStore.highlight, () => selectionStore.selection],
  publishHarpMirrorSnapshot,
  { deep: true },
)

watch(harpPreviewMode, (mode) => {
  if (mode === 'pdf') void refreshHarpPdfPreview()
})

watch([documentText, currentExtract, playerQrJpegUrl], () => {
  if (harpPreviewMode.value === 'pdf') void refreshHarpPdfPreview()
})

function chooseExtract(extractNumber: number): void {
  executeToolbarCommand(`view ${extractNumber}`)
  extractPickerOpen.value = false
}

function chooseViewPerspective(perspective: ViewPerspective): void {
  maximizedPanel.value = null
  savedViewLayout.value = null
  viewPerspective.value = perspective
  if (viewMenuElement.value !== null) {
    viewMenuElement.value.open = false
  }
}

const editorPanelVisible = computed(() => maximizedPanel.value === 'editor' || (maximizedPanel.value === null && (viewPerspective.value === 'all' || viewPerspective.value === 'notes-input' || viewPerspective.value === 'harp-input')))
const previewPanelVisible = computed(() => maximizedPanel.value !== 'editor')
const scorePanelVisible = computed(() => maximizedPanel.value === 'score' || (maximizedPanel.value === null && (viewPerspective.value === 'all' || viewPerspective.value === 'notes-input' || viewPerspective.value === 'notes')))
const harpPanelVisible = computed(() => maximizedPanel.value === 'harp' || (maximizedPanel.value === null && (viewPerspective.value === 'all' || viewPerspective.value === 'harp-input' || viewPerspective.value === 'harp')))

function togglePanelMaximize(panel: MaximizedPanel): void {
  if (maximizedPanel.value === panel) {
    const layout = savedViewLayout.value
    maximizedPanel.value = null
    savedViewLayout.value = null
    if (layout !== null) {
      viewPerspective.value = layout.perspective
      editorPaneSize.value = layout.editorPaneSize
      previewPaneSize.value = layout.previewPaneSize
    }
    return
  }

  if (maximizedPanel.value === null) {
    savedViewLayout.value = {
      perspective: viewPerspective.value,
      editorPaneSize: editorPaneSize.value,
      previewPaneSize: previewPaneSize.value,
    }
  }
  maximizedPanel.value = panel
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

onMounted(async () => {
  await restoreCurrentAbcText()
  restoreWorkbenchUiState()
  savedDocumentText.value = documentText.value
  restorePlaybackInstrument()
  restoreStorageContext()
  if (props.openStorageOnMount) {
    prepareStorageOpenDocuments()
    storageOpenDialogOpen.value = true
  }
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
  window.addEventListener('keydown', handleGlobalKeydown, true)
  window.addEventListener('message', handleMirrorMessage)
  try {
    renderWorker = new Worker(new URL('./rendering/renderWorker.ts', import.meta.url), { type: 'module' })
    renderWorker.onmessage = handleRenderWorkerMessage
  } catch (error) {
    logger.warning(`worker: unavailable: ${error instanceof Error ? error.message : String(error)}`)
    renderWorker = undefined
  }
  void nextTick().then(setupFileToolbarTooltips)
})

onBeforeUnmount(() => {
  pdfPreviewRequestId += 1
  if (harpPdfPreviewUrl.value !== undefined) URL.revokeObjectURL(harpPdfPreviewUrl.value)
  window.removeEventListener('keydown', handleGlobalKeydown, true)
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
  const record = data as {
    kind?: string
    target?: string
    zoom?: number
    payload?: HarpPreviewDragEnd
  }
  if (record.kind === 'mirror-drag-end' && record.payload !== undefined) {
    handleHarpPreviewDragEnd(record.payload)
    return
  }
  const source = event.source
  if (source === null || typeof source !== 'object' || !('postMessage' in source)) return
  if (record.kind === 'mirror-request') {
    if (record.target !== 'harp' && record.target !== 'notes') return
    sendHarpMirrorSnapshotToWindow(source as Window)
    return
  }
  if (record.kind !== 'mirror-ready') return
  sendHarpMirrorSnapshotToWindow(source as Window)
}
</script>

<template>
  <WorkbenchLayout
    :class="{ 'workbench-layout--file-drop-active': fileDropActive }"
    @dragover.capture="handleFileDragOver"
    @dragleave="handleFileDragLeave"
    @drop.capture="handleFileDrop"
  >
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
                  <span
                    v-else
                    class="file-menu__item-tooltip-target"
                    :data-file-toolbar-tooltip="item.action === 'save' ? saveTooltip : item.tooltip"
                  >
                    <button
                      class="file-menu__item"
                      type="button"
                      role="menuitem"
                      :data-testid="`file-action-${item.action}`"
                      :disabled="isFileToolbarActionDisabled(item.action, canSave)"
                      @click="handleFileToolbarAction(item.action)"
                    >
                      <ToolbarFileIcon :name="item.icon" />
                      <span>{{ item.label }}</span>
                    </button>
                  </span>
                </template>
              </div>
            </details>
            <input ref="localFileInput" class="local-file-input" type="file" accept=".abc,.xml,.mxl,.jpg,.jpeg,image/jpeg" @change="handleLocalFileInput">
            <ZnButton
              data-testid="file-shortcut-new"
              variant="ghost"
              data-file-toolbar-tooltip="Neues Dokument anlegen"
              @click="handleFileToolbarAction('new')"
            >
              <ToolbarFileIcon name="new" />
              <span>Neu</span>
            </ZnButton>
            <ZnButton
              data-testid="file-shortcut-open"
              variant="ghost"
              data-file-toolbar-tooltip="Dokument öffnen"
              @click="handleFileToolbarAction('open')"
            >
              <ToolbarFileIcon name="open" />
              <span>Öffnen</span>
            </ZnButton>
            <span class="file-toolbar__tooltip-target" :data-file-toolbar-tooltip="saveTooltip">
              <ZnButton
                :variant="documentDirty ? 'danger' : 'primary'"
                :disabled="isFileToolbarActionDisabled('save', canSave)"
                data-testid="file-shortcut-save"
                @click="handleFileToolbarAction('save')"
              >
                <ToolbarFileIcon name="save" />
                <span>Speichern</span>
              </ZnButton>
            </span>
            <ZnButton variant="ghost" @click="executeToolbarCommand('togglesetting flowconf')">Extras</ZnButton>
          </template>
          <template #default />
          <template #trailing>
            <ZnButton variant="ghost">Drucken</ZnButton>
            <details ref="viewMenuElement" class="view-picker" data-testid="view-menu">
              <summary class="view-picker__summary" aria-haspopup="menu" data-testid="view-menu-toggle">
                <span class="view-picker__icon" aria-hidden="true">◈</span>
                <span>Ansicht</span>
                <span class="view-picker__caret" aria-hidden="true">▾</span>
              </summary>
              <div class="view-picker__menu" role="menu" aria-label="Ansicht">
                <button
                  v-for="item in viewPerspectiveItems"
                  :key="item.id"
                  type="button"
                  class="view-picker__item"
                  :class="{ 'view-picker__item--active': viewPerspective === item.id }"
                  role="menuitem"
                  @click="chooseViewPerspective(item.id)"
                >
                  <span class="view-picker__item-icon" aria-hidden="true">{{ item.icon }}</span>
                  <span>{{ item.label }}</span>
                </button>
              </div>
            </details>
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
            <ZnIconButton
              label="Playback-Link teilen"
              variant="ghost"
              data-testid="playback-link"
              @click="executeToolbarCommand('playbacklink', 'Playback-Link nicht möglich')"
            >
              <ZnIcon name="share" />
            </ZnIconButton>
            <ZnButton
              :variant="playbackStore.state.status === 'playing' ? 'primary' : 'ghost'"
              :aria-pressed="playbackStore.state.status === 'playing'"
              @click="executeToolbarCommand('p auto')"
            >
              {{ playbackStore.state.status === 'playing' ? 'Stop' : 'Play' }}
            </ZnButton>
            <details class="render-issue-picker" :class="{ 'render-issue-picker--empty': renderIssueItems.length === 0 }">
              <summary
                class="render-issue-picker__summary"
                :aria-label="renderIssueItems.length === 0 ? 'Keine Fehler oder Warnungen' : 'Fehler und Warnungen anzeigen'"
              >
                <ZnBadge :tone="renderIssueTone">{{ renderIssueLabel }}</ZnBadge>
              </summary>
              <div v-if="renderIssueItems.length > 0" class="render-issue-picker__menu" role="status" aria-label="Fehler und Warnungen">
                <p v-for="(issue, index) in renderIssueItems" :key="`${issue.source}-${issue.message}-${index}`" class="render-issue-picker__item" :data-severity="issue.severity">
                  <strong>{{ issue.source }}<span v-if="issue.location"> · {{ issue.location }}</span></strong>
                  <span>{{ issue.message }}</span>
                </p>
              </div>
            </details>
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
        :primary-visible="editorPanelVisible"
        :secondary-visible="previewPanelVisible"
      >
        <template #primary>
          <div class="editor-pane">
            <div class="workbench-panel-action">
              <ZnMaximizeButton
                :maximized="maximizedPanel === 'editor'"
                maximize-label="Editor maximieren"
                restore-label="Editor wiederherstellen"
                @toggle="togglePanelMaximize('editor')"
              />
            </div>
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
                  :selected-text-ranges="selectedEditorTextRanges"
                  :selection-pending="selectionStore.selection.interactionPending === true"
                  :show-invisible-characters="showInvisibleCharacters"
                  :cursor-offset="editorCursorOffset"
                  @cursor-change="handleEditorCursorChange"
                  @selection-change="handleEditorSelectionChange"
                >
                  <template #toolbar>
                    <ZnToolbar class="abc-editor-toolbar">
                      <template #leading>
                        <details ref="editorEditMenuElement" class="file-menu" data-testid="editor-edit-menu">
                          <summary
                            class="file-menu__summary"
                            aria-haspopup="menu"
                            data-testid="editor-edit-menu-toggle"
                          >
                            <span>Bearbeiten</span>
                            <span class="file-menu__caret" aria-hidden="true">v</span>
                          </summary>
                          <div class="file-menu__list" role="menu" aria-label="Bearbeiten">
                            <button
                              class="file-menu__item"
                              type="button"
                              role="menuitem"
                              data-testid="editor-action-format"
                              data-file-toolbar-tooltip="Effektive Tonhöhen in die ABC-Quelle schreiben"
                              @click="handleEditorEditAction('format')"
                            >
                              <ToolbarFileIcon name="format" />
                              <span>ABC formatieren</span>
                            </button>
                          </div>
                        </details>
                        <ZnButton variant="ghost" @click="executeToolbarCommand('adddecoration !fermata!')">Dekoration einfügen</ZnButton>
                        <ZnButton variant="ghost" @click="executeToolbarCommand('addsnippet note')">Zusatz einfügen</ZnButton>
                        <ZnButton variant="ghost" @click="executeToolbarCommand('editsnippet')">Zusatz bearbeiten</ZnButton>
                        <ZnButton variant="ghost" @click="executeToolbarCommand('editconf basic_settings')">Konfig. bearb.</ZnButton>
                        <button
                          class="abc-editor-toolbar__invisible-toggle"
                          :class="{ 'abc-editor-toolbar__invisible-toggle--on': showInvisibleCharacters }"
                          type="button"
                          role="switch"
                          :aria-checked="showInvisibleCharacters"
                          aria-label="Unsichtbare Zeichen anzeigen oder ausblenden"
                          @click="showInvisibleCharacters = !showInvisibleCharacters"
                        >
                          <span class="abc-editor-toolbar__invisible-toggle-thumb" aria-hidden="true" />
                          <span>Unsichtbare Zeichen</span>
                        </button>
                      </template>
                    </ZnToolbar>
                  </template>
                </AbcEditorPanel>
                <LyricsPanel
                  v-else-if="activeId === 'lyrics'"
                  :document-text="documentText"
                  @update:document-text="documentText = $event"
                />
                <ConfigEditorPanel
                  v-else-if="activeId === 'config'"
                  :abc-text="documentText"
                  :resources="documentResources"
                  :current-extract="currentExtract"
                  :playback-division-default="playbackDivisionDefault"
                  :song="song"
                  :extract-options="extractMenuItems"
                  :active-section="activeConfigSection"
                  :entry-mutation-version="configEntryMutationVersion"
                  :can-undo="configCanUndo"
                  :can-redo="configCanRedo"
                  :can-select-config-path="canSelectConfigPath"
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
                  @info="logger.info($event)"
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
              :primary-visible="scorePanelVisible"
              :secondary-visible="harpPanelVisible"
            >
              <template #primary>
                <ScorePreviewPanel
                  v-if="viewPerspective === 'all' || viewPerspective === 'notes-input' || viewPerspective === 'notes'"
                  :error-message="previewErrorMessage"
                  :playback-text-ranges="playbackScoreTextRanges"
                  :selected-text-ranges="selectedScoreTextRanges"
                  :sheet-object-index="selectionStore.sheetObjectIndex"
                  :svg="scoreSvg"
                  :maximized="maximizedPanel === 'score'"
                  @select-text-range="handleScorePreviewSelection"
                  @selection-gesture="handleScorePreviewSelectionGesture"
                  @selection-background-click="handleScorePreviewBackgroundClick"
                  @toggle-maximize="togglePanelMaximize('score')"
                />
              </template>
              <template #secondary>
                <HarpPreviewPanel
                  v-if="viewPerspective === 'all' || viewPerspective === 'harp-input' || viewPerspective === 'harp'"
                  v-model:mode="harpPreviewMode"
                  v-model:zoom="harpZoom"
                  :error-message="previewErrorMessage"
                  :pdf-error="harpPdfPreviewError"
                  :pdf-loading="harpPdfPreviewLoading"
                  :pdf-url="harpPdfPreviewUrl"
                  :playback-highlight="projectedPlaybackHighlight"
                  :selection="selectedHarpProjection"
                  :sheet-object-index="selectionStore.sheetObjectIndex"
                  :svg="harpSvg"
                  :maximized="maximizedPanel === 'harp'"
                  @select-text-range="handleHarpPreviewSelection"
                  @selection-gesture="handleHarpPreviewSelectionGesture"
                  @selection-background-click="handleHarpPreviewBackgroundClick"
                  @drag-end="handleHarpPreviewDragEnd"
                  @resource-drop="handleHarpResourceDrop"
                  @context-menu="handleHarpPreviewContextMenu"
                  @config-hover="handleHarpPreviewConfigHover"
                  @toggle-maximize="togglePanelMaximize('harp')"
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
          :storage-location="storageLocation"
          :storage-read-only="activeStorageReadOnly"
          :dirty="documentDirty"
          :save-format="saveFormat"
          :cursor-position="editorCursor"
          :cursor-unicode="editorCursorUnicode"
          :config-hover="hoveredConfigKey"
          :speed-bpm="playbackTempoBpm"
          :metronome-mode="metronomeMode"
          :configured-metronome-mode="playbackConfig?.metronomeMode ?? 'off'"
          :selection-voice-scope="selectionStore.selection.voiceScope"
          :selection-voice-scope-summary="selectionVoiceScopeSummary"
          @speed-change="setPlaybackTempoBpm"
          @speed-down="adjustPlaybackTempoBpm(-5)"
          @speed-up="adjustPlaybackTempoBpm(5)"
          @metronome-mode-change="metronomeMode = $event"
          @playback-config="executeToolbarCommand(`editconf extract.${currentExtract}.playback`)"
          @storage-connections="handleFileToolbarAction('storage-connections')"
          @selection-voice-scope-change="handleSelectionVoiceScopeChange"
        />
        <PlaybackStatusOverlay
          v-if="playbackStatusOverlay !== undefined"
          :measure-number="playbackStatusOverlay.measureNumber"
          :part-name="playbackStatusOverlay.partName"
          :pass-index="playbackStatusOverlay.passIndex"
          :metronome-beat="playbackMetronomeBeat"
        />
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
        <header>
        <h2 id="save-result-title">{{ saveResultComplete ? (saveResultHasFailures ? 'Dateien mit Fehlern gespeichert' : 'Dateien gespeichert') : 'Dateien speichern' }}</h2>
          <ZnButton v-if="saveResultComplete" variant="ghost" aria-label="Dialog schließen" @click="saveResultDialogOpen = false">×</ZnButton>
        </header>
        <p v-if="saveResultComplete">
          {{ saveResultHasFailures ? 'Nicht alle Dateien konnten gespeichert werden.' : 'Alle Dateien wurden gespeichert.' }}
        </p>
        <template v-else>
          <p>{{ saveProgressLabel }}</p>
          <div class="save-result__progress" role="progressbar" :aria-valuemin="0" :aria-valuemax="saveProgressTotal" :aria-valuenow="saveProgressCompleted">
            <span :style="{ width: saveProgressTotal === 0 ? '0%' : `${saveProgressCompleted / saveProgressTotal * 100}%` }" />
          </div>
        </template>
        <ul v-if="!saveResultComplete" class="save-result__files">
          <li v-for="artifact in saveArtifactsProgress" :key="artifact.name" :data-status="artifact.status">
            <span class="save-result__file-status" aria-hidden="true">{{ artifact.status === 'saved' ? '✓' : artifact.status === 'failed' ? '!' : artifact.status === 'saving' ? '…' : '○' }}</span>
            <span>{{ artifact.name }}</span>
            <small v-if="artifact.error">{{ artifact.error }}</small>
          </li>
        </ul>
        <footer v-if="saveResultComplete">
          <ZnButton variant="primary" @click="saveResultDialogOpen = false">Schließen</ZnButton>
        </footer>
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
    @reconnect="connectStorageConnection"
    @disconnect="disconnectStorageConnection"
    @root="openRootPicker"
    @readonly="updateStorageConnectionReadOnly"
  />

  <StorageRootPickerDialog
    :open="rootPickerConnectionId !== undefined"
    :provider-label="rootPickerProviderLabel()"
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
    :opening="storageOpenOpening"
    :preview-url="storagePreviewUrl"
    :preview-loading="storagePreviewLoading"
    :preview-error="storagePreviewError"
    @close="storageOpenDialogOpen = false"
    @search="searchStorageDocuments"
    @refresh="refreshStorageDocuments"
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

@media (max-width: 64rem) {
  .workbench-chrome:deep(.zn-toolbar) {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .workbench-chrome:deep(.zn-toolbar__group) {
    flex: 1 1 100%;
    flex-wrap: wrap;
    min-width: 0;
  }

  .workbench-chrome:deep(.zn-toolbar__group--trailing) {
    justify-content: flex-start;
  }
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

.local-file-input {
  display: none;
}

.workbench-layout--file-drop-active {
  outline: 2px dashed var(--zn-accent);
  outline-offset: -2px;
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

.file-menu__item-tooltip-target,
.file-toolbar__tooltip-target {
  display: inline-flex;
}

.file-menu__item-tooltip-target {
  width: 100%;
}

.file-menu__item:hover:not(:disabled),
.file-menu__item:focus-visible {
  background: var(--zn-bg-surface-soft);
}

.file-menu__item:disabled {
  color: var(--zn-text-soft);
  cursor: default;
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

.view-picker {
  position: relative;
}

.view-picker__summary {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.1rem;
  padding: 0.35rem 0.75rem;
  border: 1px solid transparent;
  border-radius: var(--zn-radius-md);
  color: var(--zn-text-soft);
  cursor: pointer;
  list-style: none;
}

.view-picker__summary:hover,
.view-picker[open] .view-picker__summary {
  border-color: var(--zn-border);
  background: var(--zn-bg-surface-soft);
}

.view-picker__summary::-webkit-details-marker {
  display: none;
}

.view-picker__icon {
  color: var(--zn-text-muted);
  font-size: 1.05rem;
}

.view-picker__caret {
  color: var(--zn-text-muted);
  font-size: 0.75rem;
}

.view-picker__menu {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  z-index: 30;
  min-width: 13rem;
  padding: 0.35rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-md);
  background: var(--zn-bg-surface);
  box-shadow: var(--zn-shadow-soft);
}

.view-picker__item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  min-height: 2.25rem;
  padding: 0.45rem 0.6rem;
  border: 0;
  border-radius: var(--zn-radius-sm);
  background: transparent;
  color: var(--zn-text);
  cursor: pointer;
  text-align: left;
}

.view-picker__item:hover,
.view-picker__item:focus-visible,
.view-picker__item--active {
  background: var(--zn-bg-surface-soft);
}

.view-picker__item-icon {
  display: inline-flex;
  width: 1.25rem;
  justify-content: center;
  color: var(--zn-text-muted);
  font-size: 1.05rem;
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

.render-issue-picker {
  position: relative;
}

.render-issue-picker__summary {
  display: inline-flex;
  list-style: none;
  cursor: pointer;
}

.render-issue-picker__summary::-webkit-details-marker {
  display: none;
}

.render-issue-picker--empty .render-issue-picker__summary {
  cursor: default;
}

.render-issue-picker__menu {
  position: absolute;
  top: calc(100% + .35rem);
  right: 0;
  z-index: 30;
  display: grid;
  gap: .35rem;
  width: min(28rem, calc(100vw - 1.5rem));
  max-height: min(22rem, calc(100vh - 5rem));
  overflow: auto;
  padding: .55rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-md);
  background: var(--zn-bg-surface);
  box-shadow: var(--zn-shadow-soft);
}

.render-issue-picker__item {
  display: grid;
  gap: .12rem;
  margin: 0;
  padding: .42rem .5rem;
  border-radius: var(--zn-radius-sm);
  color: var(--zn-text);
  font-size: .78rem;
}

.render-issue-picker__item[data-severity='error'] {
  background: color-mix(in srgb, var(--zn-danger) 10%, transparent);
}

.render-issue-picker__item[data-severity='warning'] {
  background: color-mix(in srgb, var(--zn-warning) 12%, transparent);
}

.render-issue-picker__item strong {
  color: var(--zn-text-soft);
  font-size: .7rem;
  font-weight: 700;
}

.editor-pane {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.workbench-panel-action {
  position: absolute;
  top: 0.25rem;
  right: 0.35rem;
  z-index: 4;
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

.abc-editor-toolbar__invisible-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 1.52rem;
  padding: 0.12rem 0.48rem 0.12rem 0.18rem;
  border: 1px solid var(--zn-border);
  border-radius: 999px;
  background: var(--zn-bg-surface);
  color: var(--zn-text-soft);
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}

.abc-editor-toolbar__invisible-toggle:hover {
  border-color: var(--zn-border-strong);
  background: var(--zn-bg-surface-soft);
}

.abc-editor-toolbar__invisible-toggle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 65%, white);
  outline-offset: 2px;
}

.abc-editor-toolbar__invisible-toggle--on {
  background: color-mix(in srgb, var(--zn-accent) 16%, var(--zn-bg-surface));
  border-color: color-mix(in srgb, var(--zn-accent) 55%, var(--zn-border));
  color: var(--zn-accent-strong);
}

.abc-editor-toolbar__invisible-toggle-thumb {
  position: relative;
  width: 1.55rem;
  height: 0.82rem;
  border: 1px solid var(--zn-border-strong);
  border-radius: 999px;
  background: var(--zn-bg-surface-soft);
  transition: background-color 140ms ease, border-color 140ms ease;
}

.abc-editor-toolbar__invisible-toggle-thumb::after {
  position: absolute;
  top: 0.08rem;
  left: 0.08rem;
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 50%;
  background: var(--zn-text-muted);
  content: '';
  transition: transform 140ms ease, background-color 140ms ease;
}

.abc-editor-toolbar__invisible-toggle--on .abc-editor-toolbar__invisible-toggle-thumb {
  background: var(--zn-accent);
  border-color: var(--zn-accent-strong);
}

.abc-editor-toolbar__invisible-toggle--on .abc-editor-toolbar__invisible-toggle-thumb::after {
  background: white;
  transform: translateX(0.72rem);
}

.preview-pane {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
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
.save-result__files { max-height: 16rem; overflow: auto; padding: 0.25rem 1.15rem 0.85rem; list-style: none; }
.save-result__files li { display: grid; grid-template-columns: 1.1rem minmax(0, 1fr); gap: 0.35rem; padding-block: 0.2rem; font-family: var(--zn-font-mono, monospace); font-size: 0.86rem; }
.save-result__file-status { font-family: var(--zn-font); font-weight: 700; text-align: center; }
.save-result__files li[data-status='saved'] .save-result__file-status { color: var(--zn-success); }
.save-result__files li[data-status='failed'] .save-result__file-status { color: var(--zn-danger); }
.save-result__files li[data-status='saving'] .save-result__file-status { color: var(--zn-accent); }
.save-result__files small { grid-column: 2; color: var(--zn-danger); font-family: var(--zn-font); }
.save-result footer { justify-content: flex-end; border-top: 1px solid var(--zn-border); border-bottom: 0; }
.save-result__progress { height: 0.55rem; margin: 0.45rem 0.9rem 1rem; overflow: hidden; border-radius: 999px; background: var(--zn-bg-surface-soft); }
.save-result__progress > span { display: block; height: 100%; border-radius: inherit; background: var(--zn-accent); transition: width 160ms ease; }
</style>
