import { describe, expect, it } from 'vitest'
import { createConfigEditorContext } from '../../ConfigEditorContext.js'
import { buildConfigEditorTargetTree, buildConfigEditorAllParametersTree } from '../../configEditorTree.js'
import { Confstack } from '../../Confstack.js'
import type { ZupfnoterConfig } from '@zupfnoter/types'
import type { CommandArgumentValue } from '../../commands.js'

describe('config editor context', () => {
  it('unites schema, base entries and active entries in every generic tree', () => {
    const document = {
      extract: {
        '0': { notes: { base: { text: 'Basis', pos: [1, 2] } } },
        '3': { notes: { local: { text: 'Aktiv', pos: [3, 4] } } },
      },
    } as unknown as Partial<ZupfnoterConfig>
    const context = createConfigEditorContext(document, 3)
    const effective = context.stack.getAll() as Record<string, CommandArgumentValue>
    const raw = document as Record<string, CommandArgumentValue>
    for (const tree of [
      buildConfigEditorTargetTree('extract.3.notes', raw, effective, 3),
      buildConfigEditorAllParametersTree(raw, effective, 3),
    ]) {
      const serialized = JSON.stringify(tree)
      expect(serialized).toContain('base')
      expect(serialized).toContain('local')
      expect(serialized).toContain('align')
    }
    expect(context.resolve('extract.3.notes.base.text')).toMatchObject({ value: 'Basis', source: 'extract.0' })
    expect(context.resolve('extract.3.notes.local.text')).toMatchObject({ value: 'Aktiv', source: 'active' })
  })

  it('resolves schema-declared defaults without per-field UI fallbacks', () => {
    const context = createConfigEditorContext({}, 3)
    expect(context.resolve('extract.3.notebound.annotation.v_1.0.show')).toEqual({
      value: true, path: 'defaults.notebound.annotation.show', source: 'built-in',
    })
    expect(context.resolve('extract.3.notebound.tuplet.v_2.1536.cp1').value).toEqual([5, 2])
    expect(context.resolve('extract.3.layout.X_SPACING').value).toBe(context.stack.get('layout.X_SPACING'))
  })

  it('tracks layer provenance through overlays, pop and reset', () => {
    const stack = new Confstack()
    stack.push({ obj: { a: 1, b: 2 } }, 'base')
    stack.push({ obj: { a: 3 } }, 'active')
    expect(stack.getSource('obj.a')).toBe('active')
    expect(stack.getSource('obj.b')).toBe('base')
    stack.pop()
    expect(stack.getSource('obj.a')).toBe('base')
    stack.push({ obj: { a: 4 } }, 'again')
    stack.resetTo(1)
    expect(stack.getSource('obj.a')).toBe('base')
  })
})
