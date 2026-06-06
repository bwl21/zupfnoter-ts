<script setup lang="ts">
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import ZnPanel from '../../design-system/components/ZnPanel.vue'
import {
  createAbcEditorExtensions,
  syncEditorDiagnostics,
  type EditorDiagnostic,
} from './abcEditorCodeMirror'

interface CursorPosition {
  line: number
  column: number
}

const abcText = defineModel<string>({
  required: true,
})

const props = withDefaults(defineProps<{
  diagnostics?: EditorDiagnostic[]
}>(), {
  diagnostics: () => [],
})

const emit = defineEmits<{
  (event: 'cursor-change', position: CursorPosition): void
}>()

const editorHost = ref<HTMLDivElement | null>(null)
let editorView: EditorView | null = null
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

function emitCursorPosition(view: EditorView): void {
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)
  emit('cursor-change', {
    line: line.number,
    column: head - line.from + 1,
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
          if (!update.selectionSet && !update.docChanged) return
          emitCursorPosition(update.view)
        }),
      ],
    }),
    parent: editorHost.value,
  })

  syncEditorDiagnostics(editorView, props.diagnostics)
  emitCursorPosition(editorView)
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

onBeforeUnmount(() => {
  editorView?.destroy()
  editorView = null
})
</script>

<template>
  <ZnPanel tone="surface">
    <div class="panel-shell">
      <div ref="editorHost" class="panel-shell__editor" />
    </div>
  </ZnPanel>
</template>

<style scoped>
.panel-shell {
  display: grid;
  min-height: 0;
  height: 100%;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-sm);
  background: var(--zn-bg-surface);
}

.panel-shell__editor {
  min-height: 0;
  height: 100%;
}
</style>
