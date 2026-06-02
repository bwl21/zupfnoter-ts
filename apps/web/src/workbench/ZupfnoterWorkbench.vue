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
import WorkbenchLayout from './WorkbenchLayout.vue'

const editorTab = ref('abc')
const editorPaneSize = ref(54)
const previewPaneSize = ref(62)
const scoreZoom = ref(100)
const harpZoom = ref(100)
const abcText = ref(DEFAULT_ABC)
const scoreSvg = ref('')
const harpSvg = ref('')
const renderIssues = ref<RenderIssue[]>([])
const renderError = ref('')
const renderSummary = ref('not rendered')

const renderIssueLabel = computed(() => {
  if (renderError.value) return 'Render error'
  const warnings = renderIssues.value.filter((issue) => issue.severity === 'warning').length
  if (warnings > 0) return `${warnings} warning(s)`
  return 'Rendered'
})

const renderIssueTone = computed(() => renderError.value ? 'danger' : renderIssues.value.length > 0 ? 'warning' : 'success')

const previewErrorMessage = computed(() => {
  if (renderError.value) return renderError.value
  const errors = renderIssues.value.filter((issue) => issue.severity === 'error')
  return errors.map((issue) => issue.message).join('\n')
})

let renderTimer: ReturnType<typeof setTimeout> | undefined

function renderNow(): void {
  try {
    const result = renderWorkbenchPreviews(abcText.value)
    scoreSvg.value = result.scoreSvg
    harpSvg.value = result.harpSvg
    renderIssues.value = result.issues
    renderSummary.value = result.summary
    renderError.value = ''
  } catch (error) {
    renderError.value = error instanceof Error ? error.message : String(error)
    renderIssues.value = []
    renderSummary.value = 'render failed'
  }
}

watch(abcText, () => {
  if (renderTimer !== undefined) {
    clearTimeout(renderTimer)
  }
  renderTimer = setTimeout(renderNow, 250)
}, { immediate: true })

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
            <ZnButton variant="ghost">Play</ZnButton>
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
                <AbcEditorPanel v-if="activeId === 'abc'" v-model="abcText" />
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
                  v-model:zoom="scoreZoom"
                  :error-message="previewErrorMessage"
                  :svg="scoreSvg"
                />
              </template>
              <template #secondary>
                <HarpPreviewPanel
                  v-model:zoom="harpZoom"
                  :error-message="previewErrorMessage"
                  :svg="harpSvg"
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
        speed="1.0x"
      />
    </template>
  </WorkbenchLayout>
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
