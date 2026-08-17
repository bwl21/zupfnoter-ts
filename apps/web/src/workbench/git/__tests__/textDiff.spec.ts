import { describe, expect, it } from 'vitest'
import { createTextDiff } from '../textDiff'

describe('createTextDiff', () => {
  it('handles identical text with line numbers', () => {
    expect(createTextDiff('A\nB', 'A\nB')).toEqual([
      { type: 'unchanged', oldLineNumber: 1, newLineNumber: 1, segments: [{ value: 'A', type: 'unchanged' }] },
      { type: 'unchanged', oldLineNumber: 2, newLineNumber: 2, segments: [{ value: 'B', type: 'unchanged' }] },
    ])
  })

  it('highlights one changed character inline', () => {
    const result = createTextDiff('M: 3/4', 'M: 4/4')
    expect(result[0]).toMatchObject({ type: 'changed', oldLineNumber: 1, newLineNumber: 1 })
    expect(result[0]?.segments).toContainEqual({ value: '3', type: 'removed' })
    expect(result[0]?.segments).toContainEqual({ value: '4', type: 'added' })
  })

  it('highlights changed words and preserves unchanged words', () => {
    const result = createTextDiff('C D E F G', 'C D E A G')
    expect(result[0]?.segments).toContainEqual({ value: 'F', type: 'removed' })
    expect(result[0]?.segments).toContainEqual({ value: 'A', type: 'added' })
    expect(result[0]?.segments).toContainEqual({ value: 'C D E ', type: 'unchanged' })
  })

  it('handles complete added and removed lines', () => {
    expect(createTextDiff('A', 'A\nB')).toEqual([
      { type: 'unchanged', oldLineNumber: 1, newLineNumber: 1, segments: [{ value: 'A', type: 'unchanged' }] },
      { type: 'added', newLineNumber: 2, segments: [{ value: 'B', type: 'added' }] },
    ])
    expect(createTextDiff('A\nB', 'A')).toEqual([
      { type: 'unchanged', oldLineNumber: 1, newLineNumber: 1, segments: [{ value: 'A', type: 'unchanged' }] },
      { type: 'removed', oldLineNumber: 2, segments: [{ value: 'B', type: 'removed' }] },
    ])
  })

  it('handles empty lines and whitespace changes', () => {
    const result = createTextDiff('A\n\nC', 'A\n  \nC')
    expect(result[1]?.type).toBe('changed')
    expect(result[1]?.segments).toContainEqual({ value: '  ', type: 'added' })
  })

  it('supports ABC directives and Unicode', () => {
    const result = createTextDiff('%%score { 1 }\nT: Grüße', '%%score { 1 2 }\nT: Grüße!')
    expect(result).toHaveLength(2)
    expect(result[0]?.type).toBe('changed')
    expect(result[1]?.segments).toContainEqual({ value: '!', type: 'added' })
  })

  it('handles an entirely empty side', () => {
    expect(createTextDiff('', 'K:C')[0]).toEqual({ type: 'added', newLineNumber: 1, segments: [{ value: 'K:C', type: 'added' }] })
  })
})
