<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import {
  ZnBadge,
  ZnButton,
  ZnSplitPane,
  ZnTabs,
  ZnToolbar,
} from '../design-system/index'
import AbcEditorPanel from './panels/AbcEditorPanel.vue'
import ConfigEditorPanel from './panels/ConfigEditorPanel.vue'
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
import type { PlaybackStep } from './playback'
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
const { toggle: togglePlayback, stop: stopPlayback } = usePlaybackDriver(
  playbackStore,
  computed(() => selectionStore.selection),
  computed(() => selectionStore.sheetObjectIndex),
  computed(() => ({
    timeline: playbackTimeline.value,
    baseTempoFromQ: baseTempoFromQ.value,
  })),
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

const previewErrorMessage = computed(() => {
  return renderError.value
})

let renderTimer: ReturnType<typeof setTimeout> | undefined

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

onBeforeUnmount(() => {
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
            <ZnButton variant="ghost">Datei</ZnButton>
            <ZnButton variant="ghost">Neu</ZnButton>
            <ZnButton variant="ghost">DI abc</ZnButton>
            <ZnButton variant="ghost">Dropbox</ZnButton>
            <ZnButton variant="ghost">Einloggen</ZnButton>
            <ZnButton variant="ghost">Öffnen</ZnButton>
            <ZnButton variant="primary">Speichern</ZnButton>
            <ZnButton variant="ghost">Extras</ZnButton>
          </template>
          <template #default />
          <template #trailing>
            <ZnButton variant="ghost">Drucken</ZnButton>
            <ZnButton variant="ghost">Ansicht</ZnButton>
            <ZnBadge tone="info">Extract 0</ZnBadge>
            <ZnButton variant="ghost">Rendern</ZnButton>
            <ZnButton
              :variant="playbackStore.state.status === 'playing' ? 'primary' : 'ghost'"
              @click="togglePlayback"
            >
              Play
            </ZnButton>
            <ZnBadge :tone="renderIssueTone">{{ renderIssueLabel }}</ZnBadge>
            <ZnButton variant="ghost">Hilfe</ZnButton>
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
                <ZnButton variant="ghost">Dekoration einfügen</ZnButton>
                <ZnButton variant="ghost">Zusatz einfügen</ZnButton>
                <ZnButton variant="ghost">Zusatz bearbeiten</ZnButton>
                <ZnButton variant="ghost">Konfig. bearb.</ZnButton>
              </template>
            </ZnToolbar>

            <ZnTabs v-model="editorTab" :items="[
              { id: 'abc', label: 'ABC-Notation' },
              { id: 'lyrics', label: 'Liedtexte' },
              { id: 'config', label: 'Konfiguration' },
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
                <ConfigEditorPanel v-else />
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
      <FooterBar
        extract-label="Extract 0"
        :storage-path="renderSummary"
        :dirty="true"
        save-format="SVG + PDF"
        :cursor-position="editorCursor"
        :speed-factor="playbackStore.state.speedFactor"
        @speed-down="playbackStore.decreaseSpeed"
        @speed-reset="playbackStore.resetSpeed"
        @speed-up="playbackStore.increaseSpeed"
      />
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

.editor-pane > :deep(.zn-tabs),
.editor-pane > :deep(.zn-tabs .zn-tabs__panel) {
  min-height: 0;
  height: 100%;
  overflow: hidden;
}
</style>
