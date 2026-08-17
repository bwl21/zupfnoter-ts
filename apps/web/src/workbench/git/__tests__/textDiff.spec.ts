import { describe, expect, it } from 'vitest'
import { diffText } from '../textDiff'

describe('diffText', () => {
  it('marks removed and added lines while retaining unchanged lines', () => {
    const result = diffText('B2 B2 B3 A\nK:C', 'B2 B2 B2 A\nK:C')

    expect(result).toEqual([
      { value: '+ B2 B2 B2 A\n', added: true },
      { value: '- B2 B2 B3 A\n', removed: true },
      { value: 'K:C\n' },
    ])
  })

  it('handles an empty side', () => {
    expect(diffText('', 'K:C')).toEqual([
      { value: '+ K:C\n', added: true },
    ])
  })
})
