import { describe, expect, it } from 'vitest'

import { resolvePlaybackInstrument } from '../sound'

describe('resolvePlaybackInstrument', () => {
  it('resolves sound prefixes', () => {
    expect(resolvePlaybackInstrument('p')).toBe('piano')
    expect(resolvePlaybackInstrument('ha')).toBe('harp')
    expect(resolvePlaybackInstrument('osc')).toBe('oscillator')
    expect(resolvePlaybackInstrument('west')).toBe('western-guitar')
  })

  it('keeps aliases working', () => {
    expect(resolvePlaybackInstrument('harfe')).toBe('harp')
    expect(resolvePlaybackInstrument('klavier')).toBe('piano')
    expect(resolvePlaybackInstrument('synthie')).toBe('oscillator')
  })
})
