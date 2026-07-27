import { describe, expect, it } from 'vitest'

import { bezierControlToLegacyValue } from '../../bezierPath.js'

describe('bezierPath', () => {
  it('evaluates cp1 from the start point and cp2 from the end point', () => {
    const from: [number, number] = [10, 20]
    const to: [number, number] = [110, 20]

    expect(bezierControlToLegacyValue(from, to, [10, 30], 'from')).toEqual([-10, 0])
    expect(bezierControlToLegacyValue(from, to, [110, 30], 'to')).toEqual([-10, 0])
    const upperCp2 = bezierControlToLegacyValue(from, to, [110, 10], 'to')
    expect(upperCp2[0]).toBe(10)
    expect(Math.abs(upperCp2[1])).toBe(0)
  })
})
