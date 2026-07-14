import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'
import {
  type EditorState,
  StateEffect,
  StateField,
  type Extension,
  type Transaction,
  RangeSetBuilder,
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  GutterMarker,
  ViewPlugin,
  type ViewUpdate,
  type DecorationSet,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  gutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import type { PlaybackHighlight } from '@zupfnoter/types'

export interface EditorDiagnostic {
  severity: 'warning' | 'error'
  message: string
  line: number
  column?: number
  length?: number
  source?: string
}

export const setEditorDiagnostics = StateEffect.define<EditorDiagnostic[]>()
export const setPlaybackHighlight = StateEffect.define<PlaybackHighlight | undefined>()

const diagnosticsField = StateField.define<EditorDiagnostic[]>({
  create: (): EditorDiagnostic[] => [],
  update(value: EditorDiagnostic[], tr: Transaction): EditorDiagnostic[] {
    for (const effect of tr.effects) {
      if (effect.is(setEditorDiagnostics)) {
        return effect.value
      }
    }
    return value
  },
})

const playbackHighlightField = StateField.define<PlaybackHighlight | undefined>({
  create: (): PlaybackHighlight | undefined => undefined,
  update(value: PlaybackHighlight | undefined, tr: Transaction): PlaybackHighlight | undefined {
    for (const effect of tr.effects) {
      if (effect.is(setPlaybackHighlight)) {
        return effect.value
      }
    }
    return value
  },
})

class DiagnosticMarker extends GutterMarker {
  constructor(
    private readonly severity: 'warning' | 'error',
    private readonly tooltipLine: number,
  ) {
    super()
  }

  toDOM(): HTMLElement {
    const marker = document.createElement('span')
    marker.className = `cm-abc-gutter-marker cm-abc-gutter-marker--${this.severity}`
    const icon = document.createElement('span')
    icon.className = 'cm-abc-gutter-marker__icon'
    icon.textContent = this.severity === 'error' ? '×' : '!'
    marker.append(icon)
    marker.dataset.tooltipLine = String(this.tooltipLine)
    marker.setAttribute('aria-hidden', 'true')
    return marker
  }
}

function formatDiagnosticTitle(diagnostic: EditorDiagnostic): string {
  const column = diagnostic.column === undefined ? '' : `:${diagnostic.column}`
  return `${diagnostic.line}${column} ${diagnostic.message}`
}

function createDiagnosticTooltipContent(diagnostics: EditorDiagnostic[]): HTMLElement {
  const container = document.createElement('div')
  container.className = 'cm-abc-diagnostic-tooltip'

  for (const diagnostic of diagnostics) {
    const row = document.createElement('div')
    row.className = `cm-abc-diagnostic-tooltip__row cm-abc-diagnostic-tooltip__row--${diagnostic.severity}`

    const badge = document.createElement('span')
    badge.className = 'cm-abc-diagnostic-tooltip__badge'
    badge.textContent = diagnostic.severity === 'error' ? 'Fehler ' : 'Warnung '

    const text = document.createElement('span')
    text.className = 'cm-abc-diagnostic-tooltip__text'
    text.textContent = formatDiagnosticTitle(diagnostic)

    row.append(badge, text)
    container.append(row)
  }

  return container
}

function createMark(className: string): Decoration {
  return Decoration.mark({ class: className, inclusive: true })
}

function buildSyntaxDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  let insideConfig = false
  let configBraceDepth = 0

  for (let lineNo = 1; lineNo <= state.doc.lines; lineNo += 1) {
    const line = state.doc.line(lineNo)
    const text = line.text
    const trimmed = text.trimStart()
    const lineOffset = line.from
    const ranges: Array<{ from: number; to: number; decoration: Decoration }> = []

    if (insideConfig) {
      ranges.push({ from: line.from, to: line.to, decoration: createMark('cm-abc-config-line') })
      if (text.includes('{')) configBraceDepth += (text.match(/{/g) ?? []).length
      if (text.includes('}')) configBraceDepth -= (text.match(/}/g) ?? []).length
      if (configBraceDepth <= 0 && trimmed === '}') {
        insideConfig = false
        configBraceDepth = 0
      }
      for (const match of text.matchAll(/"(?:[^"\\]|\\.)*"|\b-?\d+(?:\.\d+)?\b|\b(?:true|false|null)\b/g)) {
        const from = lineOffset + (match.index ?? 0)
        ranges.push({ from, to: from + match[0].length, decoration: createMark(tokenClassForConfigValue(match[0])) })
      }
    } else if (text.startsWith('%%%%zupfnoter.config')) {
      ranges.push({ from: line.from, to: line.to, decoration: createMark('cm-abc-directive-line') })
      insideConfig = true
      configBraceDepth = 0
    } else if (trimmed.startsWith('%')) {
      ranges.push({ from: line.from, to: line.to, decoration: createMark('cm-abc-comment cm-abc-comment-line') })
    } else if (/^[A-Za-z]:/.test(text)) {
      const prefixEnd = lineOffset + 2
      const headerKind = classifyHeaderKind(text)
      const prefixClass = `cm-abc-header-prefix cm-abc-header-prefix--${headerKind}`
      const valueClass = `cm-abc-header-value cm-abc-header-value--${headerKind}`
      ranges.push({ from: line.from, to: prefixEnd, decoration: createMark(prefixClass) })
      ranges.push({ from: prefixEnd, to: line.to, decoration: createMark(valueClass) })
    }

    if (!insideConfig && !text.startsWith('%%%%zupfnoter.config') && !trimmed.startsWith('%') && !/^[A-Za-z]:/.test(text)) {
      for (const match of text.matchAll(/"(?:[^"\\]|\\.)*"/g)) {
        const from = lineOffset + (match.index ?? 0)
        ranges.push({ from, to: from + match[0].length, decoration: createMark('cm-abc-annotation') })
      }

      for (const match of text.matchAll(/!\w+!/g)) {
        const from = lineOffset + (match.index ?? 0)
        ranges.push({ from, to: from + match[0].length, decoration: createMark('cm-abc-decoration') })
      }

      for (const match of text.matchAll(/\|\:|\:\||\|\||\|/g)) {
        const from = lineOffset + (match.index ?? 0)
        ranges.push({ from, to: from + match[0].length, decoration: createMark('cm-abc-bar') })
      }

      for (const match of text.matchAll(/[_^=]*[A-Ga-gz][,']*(?:\d+|\/\d+|\/|\/\/)?/g)) {
        const from = lineOffset + (match.index ?? 0)
        const token = match[0]
        const className = token.toLowerCase().includes('z') ? 'cm-abc-rest' : 'cm-abc-note'
        ranges.push({ from, to: from + token.length, decoration: createMark(className) })
        const durationMatch = token.match(/(\d+|\/\d+|\/|\/\/)$/)
        if (durationMatch !== null) {
          const duration = durationMatch[0]
          ranges.push({
            from: from + token.length - duration.length,
            to: from + token.length,
            decoration: createMark('cm-abc-duration'),
          })
        }
      }
    }

    ranges.sort((left, right) => left.from - right.from || left.to - right.to)
    for (const range of ranges) {
      builder.add(range.from, range.to, range.decoration)
    }
  }

  return builder.finish()
}

function classifyHeaderKind(
  text: string,
): 'title' | 'extract' | 'file' | 'voice' | 'lyrics' | 'composer' | 'source' | 'meter' | 'key' | 'length' | 'tempo' | 'metadata' {
  if (text.startsWith('T:')) return 'title'
  if (text.startsWith('X:')) return 'extract'
  if (text.startsWith('F:')) return 'file'
  if (text.startsWith('V:')) return 'voice'
  if (text.startsWith('W:')) return 'lyrics'
  if (text.startsWith('C:')) return 'composer'
  if (text.startsWith('S:')) return 'source'
  if (text.startsWith('M:')) return 'meter'
  if (text.startsWith('K:')) return 'key'
  if (text.startsWith('L:')) return 'length'
  if (text.startsWith('Q:')) return 'tempo'
  return 'metadata'
}

function buildDiagnosticDecorations(state: EditorState): DecorationSet {
  if (typeof document.createRange().getClientRects !== 'function') {
    return Decoration.none
  }

  const builder = new RangeSetBuilder<Decoration>()
  const linesWithDiagnostics = new Map<number, EditorDiagnostic[]>()

  for (const diagnostic of state.field(diagnosticsField)) {
    const existing = linesWithDiagnostics.get(diagnostic.line)
    if (existing === undefined) {
      linesWithDiagnostics.set(diagnostic.line, [diagnostic])
    } else {
      existing.push(diagnostic)
    }
  }

  for (const [lineNo, diagnostics] of linesWithDiagnostics) {
    if (lineNo < 1 || lineNo > state.doc.lines) {
      continue
    }

    const line = state.doc.line(lineNo)
    const diagnostic = diagnostics.find((entry) => entry.severity === 'error') ?? diagnostics[0]
    if (diagnostic === undefined) continue

    const column = Math.max(1, diagnostic.column ?? 1)
    const start = line.from + column - 1
    const end = Math.min(line.to, line.from + findDiagnosticTokenEnd(line.text, column - 1))
    const severity = diagnostic.severity === 'error' ? 'error' : 'warning'

    builder.add(
      start,
      Math.max(start + 1, end),
      Decoration.mark({
        class: `cm-abc-diagnostic-underline cm-abc-diagnostic-underline--${severity}`,
      }),
    )
  }

  return builder.finish()
}

function buildPlaybackDecorations(state: EditorState): DecorationSet {
  const highlight = state.field(playbackHighlightField)
  if (highlight === undefined || highlight.activeStartChar === undefined) {
    return Decoration.none
  }

  const start = Math.max(0, Math.min(state.doc.length, highlight.activeStartChar))
  const line = state.doc.lineAt(start)
  const tokenEnd = line.from + findDiagnosticTokenEnd(line.text, start - line.from)
  const end = Math.max(start + 1, Math.min(line.to, tokenEnd))
  const builder = new RangeSetBuilder<Decoration>()

  builder.add(
    start,
    end,
    Decoration.mark({
      class: 'cm-abc-playback-highlight',
    }),
  )

  return builder.finish()
}

function buildDiagnosticGutterMarkers(state: EditorState): import('@codemirror/state').RangeSet<GutterMarker> {
  const builder = new RangeSetBuilder<GutterMarker>()
  const linesWithDiagnostics = new Map<number, EditorDiagnostic[]>()

  for (const diagnostic of state.field(diagnosticsField)) {
    const existing = linesWithDiagnostics.get(diagnostic.line)
    if (existing === undefined) {
      linesWithDiagnostics.set(diagnostic.line, [diagnostic])
    } else {
      existing.push(diagnostic)
    }
  }

  for (const [lineNo, diagnostics] of linesWithDiagnostics) {
    if (lineNo < 1 || lineNo > state.doc.lines) {
      continue
    }

    const severity = diagnostics.some((diagnostic) => diagnostic.severity === 'error') ? 'error' : 'warning'
    const line = state.doc.line(lineNo)
    builder.add(line.from, line.from, new DiagnosticMarker(severity, lineNo))
  }

  return builder.finish()
}

function tokenClassForConfigValue(value: string): string {
  if (value.startsWith('"')) return 'cm-abc-config-string'
  if (value === 'true' || value === 'false' || value === 'null') return 'cm-abc-config-keyword'
  return 'cm-abc-config-number'
}

function findDiagnosticTokenEnd(text: string, startIndex: number): number {
  let index = Math.max(0, startIndex)
  while (index < text.length) {
    const char = text[index]
    if (char === undefined || /\s/.test(char) || char === '|' || char === ',' || char === ';') {
      break
    }
    index += 1
  }
  return index
}

const syntaxField = StateField.define<DecorationSet>({
  create(state: EditorState): DecorationSet {
    return buildSyntaxDecorations(state)
  },
  update(decorations: DecorationSet, tr: Transaction): DecorationSet {
    if (!tr.docChanged) return decorations
    return buildSyntaxDecorations(tr.state)
  },
  provide: (field) => EditorView.decorations.from(field),
})

const diagnosticField = StateField.define<DecorationSet>({
  create(state: EditorState): DecorationSet {
    return buildDiagnosticDecorations(state)
  },
  update(decorations: DecorationSet, tr: Transaction): DecorationSet {
    if (!tr.docChanged && !tr.effects.some((effect) => effect.is(setEditorDiagnostics))) {
      return decorations
    }
    return buildDiagnosticDecorations(tr.state)
  },
  provide: (field) => EditorView.decorations.from(field),
})

const playbackDecorationField = StateField.define<DecorationSet>({
  create(state: EditorState): DecorationSet {
    return buildPlaybackDecorations(state)
  },
  update(decorations: DecorationSet, tr: Transaction): DecorationSet {
    if (!tr.docChanged && !tr.effects.some((effect) => effect.is(setPlaybackHighlight))) {
      return decorations
    }
    return buildPlaybackDecorations(tr.state)
  },
  provide: (field) => EditorView.decorations.from(field),
})

const diagnosticGutterField = StateField.define<import('@codemirror/state').RangeSet<GutterMarker>>({
  create(state: EditorState) {
    return buildDiagnosticGutterMarkers(state)
  },
  update(markers, tr: Transaction) {
    if (!tr.docChanged && !tr.effects.some((effect) => effect.is(setEditorDiagnostics))) {
      return markers
    }
    return buildDiagnosticGutterMarkers(tr.state)
  },
  provide: (field) =>
    gutter({
      class: 'cm-abc-diagnostic-gutter',
      markers: (view) => view.state.field(field),
    }),
})

const diagnosticTooltipPlugin = ViewPlugin.fromClass(class {
  private readonly tooltips = new Map<HTMLElement, TippyInstance>()

  constructor(view: EditorView) {
    this.sync(view)
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged || update.transactions.some((transaction) => transaction.effects.length > 0)) {
      this.sync(update.view)
    }
  }

  destroy(): void {
    for (const instance of this.tooltips.values()) {
      instance.destroy()
    }
    this.tooltips.clear()
  }

  private sync(view: EditorView): void {
    const markerElements = new Set<HTMLElement>()

    for (const element of view.dom.querySelectorAll<HTMLElement>('.cm-abc-gutter-marker')) {
      markerElements.add(element)
      if (this.tooltips.has(element)) continue

      const tooltipLine = Number(element.dataset.tooltipLine)
      if (Number.isNaN(tooltipLine) || tooltipLine <= 0) continue

      const diagnostics = view.state.field(diagnosticsField).filter((diagnostic) => diagnostic.line === tooltipLine)
      if (diagnostics.length === 0) continue

      const instance = tippy(element, {
        content: createDiagnosticTooltipContent(diagnostics),
        allowHTML: false,
        animation: 'shift-away',
        arrow: true,
        delay: [0, 0],
        duration: [90, 60],
        interactive: true,
        placement: 'right-start',
        theme: 'zn-diagnostic',
        appendTo: () => document.body,
      }) as TippyInstance

      this.tooltips.set(element, instance)
    }

    for (const [element, instance] of this.tooltips) {
      if (markerElements.has(element)) continue
      instance.destroy()
      this.tooltips.delete(element)
    }
  }
})

export function createAbcEditorExtensions(): Extension[] {
  return [
    diagnosticGutterField,
    diagnosticTooltipPlugin,
    lineNumbers(),
    highlightActiveLineGutter(),
    drawSelection(),
    highlightActiveLine(),
    history(),
    search(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    EditorView.contentAttributes.of({
      'aria-label': 'ABC notation editor',
      role: 'textbox',
      spellcheck: 'false',
    }),
    EditorView.theme({
      '&': {
        height: '100%',
        minHeight: '0',
        minWidth: '0',
        maxWidth: '100%',
        backgroundColor: 'var(--zn-bg-surface)',
        color: 'var(--zn-text-soft)',
        fontFamily: 'var(--zn-font-mono)',
        fontSize: '0.82rem',
        lineHeight: '1.55',
        border: '1px solid var(--zn-border)',
        borderRadius: 'var(--zn-radius-md)',
        overflow: 'hidden',
      },
      '.cm-editor': {
        width: '100%',
        minWidth: '0',
        height: '100%',
      },
      '.cm-scroller': {
        fontFamily: 'inherit',
        minWidth: '0',
        overflowX: 'auto',
        overflowY: 'auto',
        backgroundColor: 'var(--zn-bg-surface)',
      },
      '.cm-content': {
        minWidth: 'max-content',
        width: '100%',
        padding: 'var(--zn-space-3) 0',
        caretColor: 'var(--zn-accent)',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--zn-bg-surface)',
        borderRight: '1px solid var(--zn-border)',
      },
      '.cm-abc-diagnostic-gutter': {
        width: '1.35em',
      },
      '.cm-abc-gutter-marker': {
        display: 'grid',
        placeItems: 'center',
        width: '1em',
        height: '1em',
        margin: '0.16em auto 0',
        borderRadius: '0.18rem',
        fontSize: '0.82em',
        lineHeight: '1',
        fontWeight: '800',
        color: '#fff',
        overflow: 'hidden',
        boxShadow: '0 0 0 1px color-mix(in srgb, currentColor 22%, transparent)',
      },
      '.cm-abc-gutter-marker__icon': {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        transform: 'translateY(-0.02em)',
      },
      '.cm-abc-gutter-marker--error': {
        backgroundColor: 'var(--zn-danger)',
      },
      '.cm-abc-gutter-marker--warning': {
        backgroundColor: 'var(--zn-warning)',
        color: 'var(--zn-heading)',
      },
      '.cm-abc-diagnostic-underline--error': {
        textDecorationLine: 'underline',
        textDecorationStyle: 'wavy',
        textDecorationColor: 'var(--zn-danger)',
        textDecorationThickness: '1.5px',
      },
      '.cm-abc-diagnostic-underline--warning': {
        textDecorationLine: 'underline',
        textDecorationStyle: 'wavy',
        textDecorationColor: 'var(--zn-danger)',
        textDecorationThickness: '1.5px',
      },
      '.cm-abc-playback-highlight': {
        backgroundColor: 'color-mix(in srgb, var(--zn-accent) 16%, transparent)',
        boxShadow: 'inset 0 -2px 0 color-mix(in srgb, var(--zn-accent-strong) 55%, transparent)',
        borderRadius: '0.14rem',
      },
      '.tippy-box[data-theme~="zn-diagnostic"]': {
        backgroundColor: 'var(--zn-bg-elevated)',
        color: 'var(--zn-text-default)',
        border: '1px solid var(--zn-border)',
        boxShadow: '0 12px 30px color-mix(in srgb, black 16%, transparent)',
        fontFamily: 'var(--zn-font-sans)',
        fontSize: '0.78rem',
      },
      '.tippy-box[data-theme~="zn-diagnostic"] > .tippy-arrow': {
        color: 'var(--zn-bg-elevated)',
      },
      '.cm-abc-diagnostic-tooltip': {
        display: 'grid',
        gap: '0.25rem',
        padding: '0.1rem 0',
      },
      '.cm-abc-diagnostic-tooltip__row': {
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '0.45rem',
        alignItems: 'start',
      },
      '.cm-abc-diagnostic-tooltip__badge': {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '4.2em',
        padding: '0.1rem 0.35rem',
        borderRadius: '999px',
        fontSize: '0.68rem',
        fontWeight: '700',
        lineHeight: '1.2',
      },
      '.cm-abc-diagnostic-tooltip__row--error .cm-abc-diagnostic-tooltip__badge': {
        backgroundColor: 'color-mix(in srgb, var(--zn-danger) 18%, white 82%)',
        color: 'var(--zn-danger)',
      },
      '.cm-abc-diagnostic-tooltip__row--warning .cm-abc-diagnostic-tooltip__badge': {
        backgroundColor: 'color-mix(in srgb, var(--zn-danger) 18%, white 82%)',
        color: 'var(--zn-danger)',
      },
      '.cm-abc-diagnostic-tooltip__text': {
        lineHeight: '1.35',
      },
      '.cm-focused': {
        outline: 'none',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        color: 'var(--zn-text-muted)',
      },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: 'color-mix(in srgb, var(--zn-accent) 8%, transparent)',
      },
      '.cm-abc-header-prefix, .cm-abc-header-value': {
        fontWeight: '700',
      },
      '.cm-abc-header-prefix, .cm-abc-directive-line': {
        color: 'var(--zn-danger)',
      },
      '.cm-abc-header-prefix--title': {
        color: 'var(--zn-danger)',
      },
      '.cm-abc-header-prefix--extract': {
        color: 'var(--zn-danger)',
      },
      '.cm-abc-header-prefix--file': {
        color: 'var(--zn-danger)',
      },
      '.cm-abc-header-prefix--voice': {
        color: 'var(--zn-danger)',
      },
      '.cm-abc-header-prefix--lyrics': {
        color: 'var(--zn-danger)',
      },
      '.cm-abc-header-prefix--metadata': {
        color: 'var(--zn-danger)',
      },
      '.cm-abc-header-value': {
        color: 'var(--zn-accent)',
      },
      '.cm-abc-header-value--title': {
        color: 'var(--zn-accent-strong)',
      },
      '.cm-abc-header-value--extract': {
        color: 'color-mix(in srgb, var(--zn-accent) 92%, white 8%)',
      },
      '.cm-abc-header-value--file': {
        color: 'color-mix(in srgb, var(--zn-accent) 84%, white 16%)',
      },
      '.cm-abc-header-value--voice': {
        color: 'color-mix(in srgb, var(--zn-heading) 80%, white 20%)',
      },
      '.cm-abc-header-value--lyrics': {
        color: 'color-mix(in srgb, var(--zn-accent) 88%, white 12%)',
      },
      '.cm-abc-header-value--composer': {
        color: 'color-mix(in srgb, var(--zn-danger) 78%, white 22%)',
      },
      '.cm-abc-header-value--source': {
        color: 'color-mix(in srgb, var(--zn-accent) 82%, white 18%)',
      },
      '.cm-abc-header-value--meter': {
        color: 'color-mix(in srgb, var(--zn-danger) 70%, white 30%)',
      },
      '.cm-abc-header-value--key': {
        color: 'color-mix(in srgb, var(--zn-accent) 76%, white 24%)',
      },
      '.cm-abc-header-value--length': {
        color: 'color-mix(in srgb, var(--zn-accent) 88%, white 12%)',
      },
      '.cm-abc-header-value--tempo': {
        color: 'color-mix(in srgb, var(--zn-warning) 82%, white 18%)',
      },
      '.cm-abc-header-value--metadata': {
        color: 'color-mix(in srgb, var(--zn-accent) 88%, white 12%)',
      },
      '.cm-abc-comment, .cm-abc-comment-line': {
        color: 'var(--zn-success)',
        fontStyle: 'italic',
      },
      '.cm-abc-directive-line, .cm-abc-config-line': {
        backgroundColor: 'color-mix(in srgb, var(--zn-accent) 5%, transparent)',
      },
      '.cm-abc-annotation': {
        color: 'var(--zn-danger)',
      },
      '.cm-abc-decoration': {
        color: 'var(--zn-danger)',
      },
      '.cm-abc-note': {
        color: 'var(--zn-danger)',
        fontWeight: '600',
      },
      '.cm-abc-rest': {
        color: 'var(--zn-danger)',
        fontWeight: '700',
      },
      '.cm-abc-duration': {
        color: 'var(--zn-accent)',
      },
      '.cm-abc-bar': {
        color: 'var(--zn-danger)',
        fontWeight: '700',
      },
      '.cm-abc-config-string': {
        color: 'var(--zn-accent)',
      },
      '.cm-abc-config-number': {
        color: 'var(--zn-accent)',
      },
      '.cm-abc-config-keyword': {
        color: 'var(--zn-danger)',
      },
    }),
    syntaxField,
    diagnosticsField,
    diagnosticField,
    playbackHighlightField,
    playbackDecorationField,
  ]
}

export function syncEditorDiagnostics(view: EditorView, diagnostics: EditorDiagnostic[]): void {
  view.dispatch({
    effects: setEditorDiagnostics.of(diagnostics),
  })
}

export function syncEditorPlaybackHighlight(view: EditorView, highlight: PlaybackHighlight | undefined): void {
  view.dispatch({
    effects: setPlaybackHighlight.of(highlight),
  })
}
