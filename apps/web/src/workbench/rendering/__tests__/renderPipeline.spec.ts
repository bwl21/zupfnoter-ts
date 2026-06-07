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
})
