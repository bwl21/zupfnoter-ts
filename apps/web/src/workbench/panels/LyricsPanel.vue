<script setup lang="ts">
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { extractLyricsText, replaceLyricsText } from '@zupfnoter/core'
import { ZnPanel, ZnToolbar } from '@zupfnoter/design-system'

const props = defineProps<{
  documentText: string
}>()

const emit = defineEmits<{
  (event: 'update:documentText', value: string): void
}>()

const editorHost = ref<HTMLDivElement | null>(null)
let editorView: EditorView | null = null
let updatingFromParent = false

function syncDocument(): void {
  if (editorView === null) return
  const nextText = extractLyricsText(props.documentText)
  if (editorView.state.doc.toString() === nextText) return
  updatingFromParent = true
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: nextText,
    },
  })
  updatingFromParent = false
}

onMounted(() => {
  if (editorHost.value === null) return

  editorView = new EditorView({
    state: EditorState.create({
      doc: extractLyricsText(props.documentText),
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || updatingFromParent) return
          emit('update:documentText', replaceLyricsText(props.documentText, update.state.doc.toString()))
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            minHeight: '12rem',
            border: '1px solid var(--zn-border)',
            borderRadius: 'var(--zn-radius-md)',
            overflow: 'hidden',
            backgroundColor: 'var(--zn-bg-surface)',
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: 'var(--zn-font-mono, monospace)',
          },
          '.cm-content': {
            minHeight: '12rem',
            padding: 'var(--zn-space-3) 0',
          },
          '.cm-gutters': {
            backgroundColor: 'var(--zn-bg-surface)',
            borderRight: '1px solid var(--zn-border)',
          },
        }),
      ],
    }),
    parent: editorHost.value,
  })
})

watch(() => props.documentText, syncDocument)

onBeforeUnmount(() => {
  editorView?.destroy()
  editorView = null
})
</script>

<template>
  <ZnPanel>
    <div class="lyrics-panel">
      <ZnToolbar>
        <template #leading>
          <span class="lyrics-panel__toolbar-title">Liedtexte</span>
        </template>
      </ZnToolbar>
      <div ref="editorHost" class="lyrics-panel__editor" aria-label="Liedtexteditor" />
      <p class="lyrics-panel__hint">Der Text wird im ABC als globale W:-Zeilen gespeichert.</p>
    </div>
  </ZnPanel>
</template>

<style scoped>
.lyrics-panel {
  display: grid;
  grid-template-rows: auto minmax(12rem, 1fr) auto;
  gap: var(--zn-space-3);
  min-height: 0;
  height: 100%;
}

.lyrics-panel__toolbar-title {
  color: var(--zn-heading);
  font-size: 0.86rem;
  font-weight: 700;
}

.lyrics-panel__editor {
  min-height: 12rem;
  min-width: 0;
}

.lyrics-panel__hint {
  margin: 0;
  color: var(--zn-text-muted);
  font-size: 0.78rem;
}
</style>
