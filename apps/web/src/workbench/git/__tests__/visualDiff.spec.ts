import { describe, expect, it } from 'vitest'
import { svgViewportSize } from '../visualDiff'

describe('svgViewportSize', () => {
  it('uses explicit SVG dimensions', () => {
    expect(svgViewportSize('<svg width="210" height="297"></svg>')).toEqual({ width: 210, height: 297 })
  })

  it('falls back to the viewBox', () => {
    expect(svgViewportSize('<svg viewBox="0 0 800 600"></svg>')).toEqual({ width: 800, height: 600 })
  })
})
