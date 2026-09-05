import { describe, expect, it } from 'vitest'

import { calculateCoverCrop, expandRectangle, isQrPatternRecent } from './qrScanner'

describe('QR scanner padding', () => {
  it('adds context around the visible frame for the QR quiet zone', () => {
    expect(expandRectangle(
      { x: 100, y: 50, width: 200, height: 200 },
      0.15,
    )).toEqual({ x: 70, y: 20, width: 260, height: 260 })
  })

  it('does not shrink the frame for negative padding', () => {
    expect(expandRectangle(
      { x: 100, y: 50, width: 200, height: 200 },
      -0.1,
    )).toEqual({ x: 100, y: 50, width: 200, height: 200 })
  })
})

describe('QR scanner crop', () => {
  it('maps the visible square frame into a centered landscape camera frame', () => {
    expect(calculateCoverCrop(
      { width: 1920, height: 1080 },
      { width: 400, height: 300 },
      { x: 56, y: 6, width: 288, height: 288 },
    )).toEqual({ x: 441, y: 21, width: 1037, height: 1037 })
  })

  it('maps a capped frame without stretching the source image', () => {
    expect(calculateCoverCrop(
      { width: 1920, height: 1080 },
      { width: 512, height: 384 },
      { x: 112, y: 48, width: 288, height: 288 },
    )).toEqual({ x: 555, y: 135, width: 810, height: 810 })
  })

  it('rejects dimensions before the camera metadata is available', () => {
    expect(calculateCoverCrop(
      { width: 0, height: 0 },
      { width: 400, height: 300 },
      { x: 56, y: 6, width: 288, height: 288 },
    )).toBeUndefined()
  })
})

describe('QR pattern retention', () => {
  it('keeps robust decoding active across subsequent fresh frames', () => {
    expect(isQrPatternRecent(1_000, 3_499, 2_500)).toBe(true)
    expect(isQrPatternRecent(1_000, 3_500, 2_500)).toBe(false)
    expect(isQrPatternRecent(Number.NEGATIVE_INFINITY, 1_000, 2_500)).toBe(false)
  })
})
