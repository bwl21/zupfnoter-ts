<script setup lang="ts">
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { SelectionTextRange } from '@zupfnoter/types'

import ZnPanel from '../../design-system/components/ZnPanel.vue'
import {
  createAbcEditorExtensions,
  syncEditorDiagnostics,
  syncEditorPlaybackHighlight,
  type EditorDiagnostic,
} from './abcEditorCodeMirror'
import type { PlaybackHighlight } from '@zupfnoter/types'

interface CursorPosition {
  line: number
  column: number
}

interface EditorSelectionRange {
  startpos: number
  endpos: number
  start: CursorPosition
  end: CursorPosition
}

const abcText = defineModel<string>({
  required: true,
})

const props = withDefaults(defineProps<{
  diagnostics?: EditorDiagnostic[]
  playbackHighlight?: PlaybackHighlight
  selectedTextRange?: SelectionTextRange
}>(), {
  diagnostics: () => [],
})

const emit = defineEmits<{
  (event: 'cursor-change', position: CursorPosition): void
  (event: 'selection-change', selection: EditorSelectionRange): void
}>()

const editorHost = ref<HTMLDivElement | null>(null)
let editorView: EditorView | null = null
let isApplyingExternalSelection = false
const editorUpdateListener = EditorView.updateListener.of((update) => {
  if (!update.docChanged) return
  const nextValue = update.state.doc.toString()
  if (nextValue !== abcText.value) {
    abcText.value = nextValue
  }
})

function syncDocument(nextValue: string): void {
  if (editorView === null) return
  const currentValue = editorView.state.doc.toString()
  if (nextValue === currentValue) return

  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: nextValue,
    },
  })
}

function syncExternalSelection(nextSelection: SelectionTextRange | undefined): void {
  if (editorView === null) return
  if (nextSelection === undefined) return

  const normalizedFrom = Math.max(0, Math.min(nextSelection.startpos, editorView.state.doc.length))
  const normalizedTo = Math.max(0, Math.min(nextSelection.endpos, editorView.state.doc.length))
  const currentSelection = editorView.state.selection.main
  if (currentSelection.from === normalizedFrom && currentSelection.to === normalizedTo) return

  isApplyingExternalSelection = true
  editorView.dispatch({
    selection: {
      anchor: normalizedFrom,
      head: normalizedTo,
    },
    scrollIntoView: true,
  })
  isApplyingExternalSelection = false
}

function emitCursorPosition(view: EditorView): void {
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)
  emit('cursor-change', {
    line: line.number,
    column: head - line.from + 1,
  })
}

function emitSelectionRange(view: EditorView): void {
  const selection = view.state.selection.main
  const startLine = view.state.doc.lineAt(selection.from)
  const endLine = view.state.doc.lineAt(selection.to)
  emit('selection-change', {
    startpos: selection.from,
    endpos: selection.to,
    start: {
      line: startLine.number,
      column: selection.from - startLine.from + 1,
    },
    end: {
      line: endLine.number,
      column: selection.to - endLine.from + 1,
    },
  })
}

onMounted(() => {
  if (editorHost.value === null) return

  editorView = new EditorView({
    state: EditorState.create({
      doc: abcText.value,
      extensions: [
        ...createAbcEditorExtensions(),
        editorUpdateListener,
        EditorView.updateListener.of((update) => {
          if (isApplyingExternalSelection) return
          if (!update.selectionSet && !update.docChanged) return
          emitCursorPosition(update.view)
          emitSelectionRange(update.view)
        }),
      ],
    }),
    parent: editorHost.value,
  })

  syncEditorDiagnostics(editorView, props.diagnostics)
  syncEditorPlaybackHighlight(editorView, props.playbackHighlight)
  emitCursorPosition(editorView)
  emitSelectionRange(editorView)
})

watch(abcText, (nextValue) => {
  syncDocument(nextValue)
}, { immediate: true })

watch(
  () => props.diagnostics,
  (diagnostics) => {
    if (editorView === null) return
    syncEditorDiagnostics(editorView, diagnostics)
  },
  { immediate: true, deep: true },
)

watch(
  () => props.playbackHighlight,
  (highlight) => {
  if (editorView === null) return
  syncEditorPlaybackHighlight(editorView, highlight)
  },
  { immediate: true, deep: true },
)

watch(
  () => props.selectedTextRange,
  (selectedTextRange) => {
    syncExternalSelection(selectedTextRange)
  },
  { immediate: true, deep: true },
)

onBeforeUnmount(() => {
  editorView?.destroy()
  editorView = null
})
</script>

<template>
  <ZnPanel tone="surface">
    <div class="panel-shell">
      <slot name="toolbar" />
      <div ref="editorHost" class="panel-shell__editor" />
    </div>
  </ZnPanel>
</template>

<style scoped>
.panel-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--zn-space-2);
  min-height: 0;
  min-width: 0;
  height: 100%;
}

.panel-shell__editor {
  min-height: 0;
  min-width: 0;
  height: 100%;
}
</style>
