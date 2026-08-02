import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = process.cwd().endsWith('/apps/web')
  ? process.cwd()
  : resolve(process.cwd(), 'apps/web')

function readSource(relativePath: string): string {
  return readFileSync(resolve(WEB_ROOT, relativePath), 'utf8')
}

describe('selection architecture', () => {
  it('keeps preview panels on the shared selection gesture adapter', () => {
    for (const panel of ['ScorePreviewPanel.vue', 'HarpPreviewPanel.vue']) {
      const source = readSource(`src/workbench/panels/${panel}`)
      expect(source).toContain('usePreviewSelectionGesture')
      expect(source).not.toContain('dispatchSelectionEvent')
    }
  })

  it('prevents preview gestures from triggering native editor selection', () => {
    const source = readSource('src/workbench/panels/usePreviewSelectionGesture.ts')

    expect(source).toContain('event.preventDefault()')
  })

  it('keeps selection state transitions in the selection manager', () => {
    const source = readSource('src/workbench/selectionManager.ts')
    expect(source).toContain("type: 'selection.interaction-pending'")
    expect(source).toContain("event.type === 'selection.interaction-pending'")
  })

  it('carries editor pointer modifiers into the shared selection path', () => {
    const source = readSource('src/workbench/panels/AbcEditorPanel.vue')

    expect(source).toContain('EditorView.domEventHandlers')
    expect(source).toContain('selectionChange.startNewSegment = true')
  })

  it('keeps preview range extension based on musical time', () => {
    const source = readSource('src/workbench/selectionManager.ts')
    const functionStart = source.indexOf('function resolveExtendedSelectionByTextRange(')
    const functionEnd = source.indexOf('function resolveExtendedSelectionByLineColumnRange(', functionStart)
    const functionSource = source.slice(functionStart, functionEnd)

    expect(functionStart).toBeGreaterThanOrEqual(0)
    expect(functionEnd).toBeGreaterThan(functionStart)
    expect(functionSource).toContain("typeof anchorEntry?.musicTime === 'number'")
    expect(functionSource).toContain('entry.musicTime >= minTime')
    expect(functionSource).toContain('entry.musicTime <= maxTime')
  })
})
