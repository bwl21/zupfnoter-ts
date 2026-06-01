<script setup lang="ts">
import { ref } from 'vue'

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
import WorkbenchLayout from './WorkbenchLayout.vue'

const editorTab = ref('abc')
const editorPaneSize = ref(54)
const previewPaneSize = ref(62)
const zoom = ref(100)
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
                <AbcEditorPanel v-if="activeId === 'abc'" />
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
                <ScorePreviewPanel />
              </template>
              <template #secondary>
                <HarpPreviewPanel v-model:zoom="zoom" />
              </template>
            </ZnSplitPane>
          </div>
        </template>
      </ZnSplitPane>
    </template>

    <template #footer>
      <FooterBar
        extract-label="Extract 0"
        storage-path="local / demo"
        :dirty="true"
        save-format="SVG + PDF"
        speed="1.0x"
      />
    </template>
  </WorkbenchLayout>
</template>

<style scoped>
.workbench-chrome {
  padding: 0anrem;
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
}

.preview-pane {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-height: 0;
  height: 100%;
}

.preview-pane > :deep(.zn-split-pane) {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
