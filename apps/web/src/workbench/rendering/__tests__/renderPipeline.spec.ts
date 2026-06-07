import { describe, expect, it } from 'vitest'

import { renderWorkbenchPreviews } from '../renderPipeline'

describe('renderWorkbenchPreviews', () => {
  it('surfaces translated abc2svg tie errors in the editor diagnostics', () => {
    const result = renderWorkbenchPreviews('X:1\nT:Demo\nK:C\ng-d')

    expect(result.diagnostics.length).toBeGreaterThan(0)
    expect(result.editorDiagnostics.length).toBeGreaterThan(0)
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.toastDiagnostics).toHaveLength(0)
    expect(result.editorDiagnostics.some((diagnostic) => diagnostic.message.includes('fehlerhafter Haltebogen'))).toBe(true)
    expect(result.editorDiagnostics.some((diagnostic) => diagnostic.line === 4)).toBe(true)
  })

  it('builds a selection index from the rendered song model', () => {
    const result = renderWorkbenchPreviews('X:1\nT:Demo\nK:C\nC D')

    expect(result.selectionIndex).toBeDefined()
    expect(result.selectionIndex?.entries.length).toBeGreaterThan(0)
    expect(Object.keys(result.selectionIndex?.byZnId ?? {})).not.toHaveLength(0)
    expect(result.scoreSvg).toContain('data-start-char=')
    expect(result.scoreSvg).toContain('class="zn-score-annotation"')
  })
})
