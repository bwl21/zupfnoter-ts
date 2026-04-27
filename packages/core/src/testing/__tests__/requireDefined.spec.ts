import { describe, expect, it } from 'vitest'
import { requireDefined } from '../../requireDefined.js'

describe('requireDefined', () => {
  it('returns defined values unchanged', () => {
    expect(requireDefined(0, 'x')).toBe(0)
    expect(requireDefined('', 'x')).toBe('')
    expect(requireDefined(false, 'x')).toBe(false)
  })

  it('throws for nullish values', () => {
    expect(() => requireDefined(undefined, 'missing value')).toThrow('missing value')
    expect(() => requireDefined(null, 'missing value')).toThrow('missing value')
  })
})
