<script setup lang="ts">
import { Compartment, EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { SelectionTextRange } from '@zupfnoter/types'

import { ZnPanel } from '@zupfnoter/design-system'
import {
  createAbcEditorExtensions,
  createInvisibleCharactersCompartment,
  createInvisibleCharactersExtension,
  syncEditorDiagnostics,
  syncEditorPlaybackHighlight,
  type EditorDiagnostic,
} from './abcEditorCodeMirror'
import type { PlaybackHighlight } from '@zupfnoter/types'

interface LineColumn {
  line: number
  column: number
}

interface CursorPosition extends LineColumn {
  offset: number
  unicode: string | undefined
}

interface EditorSelectionRange {
  startpos: number
  endpos: number
  start: LineColumn
  end: LineColumn
}

interface EditorSelectionChange {
  startpos: number
  endpos: number
  start: LineColumn
  end: LineColumn
  ranges?: EditorSelectionRange[]
  extend?: boolean
  startNewSegment?: boolean
}

const abcText = defineModel<string>({
  required: true,
})

const props = withDefaults(defineProps<{
  diagnostics?: EditorDiagnostic[]
  playbackHighlight?: PlaybackHighlight
  selectedTextRanges?: SelectionTextRange[]
  selectionPending?: boolean
  showInvisibleCharacters?: boolean
  cursorOffset?: number
}>(), {
  diagnostics: () => [],
  showInvisibleCharacters: false,
  selectionPending: false,
})

const emit = defineEmits<{
  (event: 'cursor-change', position: CursorPosition): void
  (event: 'selection-change', selection: EditorSelectionChange): void
}>()

const editorHost = ref<HTMLDivElement | null>(null)
let editorView: EditorView | null = null
let isApplyingExternalSelection = false
let pendingPointerModifiers: { shiftKey: boolean; altKey: boolean } | undefined
const invisibleCharactersCompartment: Compartment = createInvisibleCharactersCompartment()
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

function syncExternalSelection(nextSelections: SelectionTextRange[] | undefined): void {
  if (editorView === null) return
  if (props.selectionPending) return
  if (nextSelections === undefined || nextSelections.length === 0) return

  const ranges = nextSelections
    .map((selection) => ({
      from: Math.max(0, Math.min(selection.startpos, editorView?.state.doc.length ?? 0)),
      to: Math.max(0, Math.min(selection.endpos, editorView?.state.doc.length ?? 0)),
    }))
    .filter((selection) => selection.from !== selection.to)
    .sort((left, right) => left.from - right.from || left.to - right.to)
  if (ranges.length === 0) return

  const currentRanges = editorView.state.selection.ranges
  if (currentRanges.length === ranges.length && ranges.every((range, index) => {
    const currentRange = currentRanges[index]
    return currentRange !== undefined
      && currentRange.from === range.from
      && currentRange.to === range.to
  })) return

  isApplyingExternalSelection = true
  editorView.dispatch({
    selection: EditorSelection.create(
      ranges.map((range) => EditorSelection.range(range.from, range.to)),
    ),
    scrollIntoView: true,
  })
  editorView.focus()
  isApplyingExternalSelection = false
}

function emitCursorPosition(view: EditorView): void {
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)
  const text = view.state.doc.toString()
  const previousOffset = head - 1
  const previousCodeUnit = previousOffset >= 0 ? text.charCodeAt(previousOffset) : undefined
  const codePointOffset = previousCodeUnit !== undefined
    && previousCodeUnit >= 0xdc00
    && previousCodeUnit <= 0xdfff
    && previousOffset > 0
    ? previousOffset - 1
    : previousOffset
  const codePoint = codePointOffset >= 0 ? text.codePointAt(codePointOffset) : undefined
  emit('cursor-change', {
    offset: head,
    line: line.number,
    column: head - line.from + 1,
    unicode: codePoint === undefined
      ? undefined
      : `U+${codePoint.toString(16).toUpperCase().padStart(codePoint <= 0xffff ? 4 : 6, '0')}`,
  })
}

function emitSelectionRange(view: EditorView): void {
  const selection = view.state.selection.main
  const startLine = view.state.doc.lineAt(selection.from)
  const endLine = view.state.doc.lineAt(selection.to)
  const ranges = view.state.selection.ranges.map((range) => {
    const rangeStartLine = view.state.doc.lineAt(range.from)
    const rangeEndLine = view.state.doc.lineAt(range.to)
    return {
      startpos: range.from,
      endpos: range.to,
      start: {
        line: rangeStartLine.number,
        column: range.from - rangeStartLine.from + 1,
      },
      end: {
        line: rangeEndLine.number,
        column: range.to - rangeEndLine.from + 1,
      },
    }
  })
  const selectionChange: EditorSelectionChange = {
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
  }
  if (pendingPointerModifiers?.shiftKey === true && pendingPointerModifiers.altKey !== true) {
    selectionChange.extend = true
  }
  if (pendingPointerModifiers?.shiftKey === true && pendingPointerModifiers.altKey === true) {
    selectionChange.startNewSegment = true
  }
  pendingPointerModifiers = undefined
  if (ranges.length > 1) selectionChange.ranges = ranges
  emit('selection-change', selectionChange)
}

onMounted(() => {
  if (editorHost.value === null) return

  editorView = new EditorView({
    state: EditorState.create({
      doc: abcText.value,
      selection: {
        anchor: Math.max(0, Math.min(props.cursorOffset ?? 0, abcText.value.length)),
      },
      extensions: [
        ...createAbcEditorExtensions(),
        EditorView.domEventHandlers({
          mousedown: (event) => {
            pendingPointerModifiers = {
              shiftKey: event.shiftKey,
              altKey: event.altKey,
            }
            return false
          },
        }),
        EditorState.allowMultipleSelections.of(true),
        invisibleCharactersCompartment.of(createInvisibleCharactersExtension(props.showInvisibleCharacters)),
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

  syncExternalSelection(props.selectedTextRanges)
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
  [() => props.selectedTextRanges, () => props.selectionPending],
  ([selectedTextRanges, selectionPending]) => {
    if (selectionPending !== true) syncExternalSelection(selectedTextRanges)
  },
  { immediate: true, deep: true },
)

watch(
  () => props.showInvisibleCharacters,
  (showInvisibleCharacters) => {
    if (editorView === null) return
    editorView.dispatch({
      effects: invisibleCharactersCompartment.reconfigure(
        createInvisibleCharactersExtension(showInvisibleCharacters),
      ),
    })
  },
)

onBeforeUnmount(() => {
  editorView?.destroy()
  editorView = null
})
</script>

<template>
  <ZnPanel tone="surface" variant="workspace">
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
