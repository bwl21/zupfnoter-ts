import { describe, expect, it } from 'vitest'

import { computeWheelZoomDelta } from '../useZoomableSvgPreview'

describe('computeWheelZoomDelta', () => {
  it('keeps small wheel movements gentle and scales larger gestures progressively', () => {
    expect(computeWheelZoomDelta(1)).toBe(1)
    expect(computeWheelZoomDelta(10)).toBe(1)
    expect(computeWheelZoomDelta(40)).toBe(2)
    expect(computeWheelZoomDelta(120)).toBe(5)
    expect(computeWheelZoomDelta(480)).toBe(12)
  })
})
