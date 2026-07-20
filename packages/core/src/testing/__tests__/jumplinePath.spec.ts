import { describe, expect, it } from 'vitest'
import { makeJumplinePathData } from '../../jumplinePath.js'

describe('makeJumplinePathData', () => {
  it('keeps both note-side horizontals anchored while moving the vertical passage', () => {
    const base = {
      from: { center: [10, 20] as [number, number], size: [2, 1] as [number, number], anchor: 'after' as const },
      to: { center: [30, 60] as [number, number], size: [2, 1] as [number, number], anchor: 'before' as const },
      vertical_anchor: 'from' as const,
      jumpline_anchor: [1, 1] as [number, number],
      verticalcut: 0,
    }

    const first = makeJumplinePathData({ ...base, vertical: 8 }).outlinePathData
    const second = makeJumplinePathData({ ...base, vertical: 16 }).outlinePathData

    expect(first).toMatch(/^M13 22l5 0/)
    expect(second).toMatch(/^M13 22l13 0/)
    expect(first).toMatch(/L25 58$/)
    expect(second).toMatch(/L25 58$/)
  })
})
