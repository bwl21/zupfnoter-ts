import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
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
  type DecorationSet,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'

export interface EditorDiagnostic {
  severity: 'warning' | 'error'
  message: string
  line: number
  column?: number
  length?: number
  source?: string
}

export const setEditorDiagnostics = StateEffect.define<EditorDiagnostic[]>()

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
    const severity = diagnostics.some((diagnostic) => diagnostic.severity === 'error') ? 'error' : 'warning'
    const title = diagnostics.map((diagnostic) => {
      const column = diagnostic.column === undefined ? '' : `:${diagnostic.column}`
      return `${diagnostic.line}${column} ${diagnostic.message}`
    }).join('\n')
    builder.add(
      line.from,
      line.from,
      Decoration.line({
        class: `cm-abc-diagnostic-line cm-abc-diagnostic-line--${severity}`,
        attributes: { title },
      }),
    )
  }

  return builder.finish()
}

function tokenClassForConfigValue(value: string): string {
  if (value.startsWith('"')) return 'cm-abc-config-string'
  if (value === 'true' || value === 'false' || value === 'null') return 'cm-abc-config-keyword'
  return 'cm-abc-config-number'
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

export function createAbcEditorExtensions(): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    drawSelection(),
    highlightActiveLine(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.contentAttributes.of({
      'aria-label': 'ABC notation editor',
      role: 'textbox',
      spellcheck: 'false',
    }),
    EditorView.theme({
      '&': {
        height: '100%',
        minHeight: '0',
        backgroundColor: 'var(--zn-bg-surface)',
        color: 'var(--zn-text-soft)',
        fontFamily: 'var(--zn-font-mono)',
        fontSize: '0.82rem',
        lineHeight: '1.55',
      },
      '.cm-scroller': {
        fontFamily: 'inherit',
        overflow: 'auto',
        backgroundColor: 'var(--zn-bg-surface)',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--zn-bg-surface)',
        borderRight: '1px solid var(--zn-border)',
      },
      '.cm-content': {
        padding: 'var(--zn-space-3) 0',
        caretColor: 'var(--zn-accent)',
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
      '.cm-abc-diagnostic-line': {
        position: 'relative',
        paddingLeft: '0.35rem',
      },
      '.cm-abc-diagnostic-line::before': {
        content: '""',
        position: 'absolute',
        inset: '0 auto 0 0',
        width: '0.24rem',
        borderRadius: '0.24rem',
      },
      '.cm-abc-diagnostic-line--warning::before, .cm-abc-diagnostic-line--error::before': {
        content: '"!"',
        display: 'grid',
        placeItems: 'center',
        width: '0.9rem',
        height: '0.9rem',
        top: '0.28rem',
        color: 'var(--zn-background)',
        fontSize: '0.56rem',
        fontWeight: '800',
        lineHeight: '1',
      },
      '.cm-abc-diagnostic-line--warning::before': {
        backgroundColor: 'var(--zn-warning)',
      },
      '.cm-abc-diagnostic-line--error::before': {
        backgroundColor: 'var(--zn-danger)',
      },
    }),
    syntaxField,
    diagnosticsField,
    diagnosticField,
  ]
}

export function syncEditorDiagnostics(view: EditorView, diagnostics: EditorDiagnostic[]): void {
  view.dispatch({
    effects: setEditorDiagnostics.of(diagnostics),
  })
}
