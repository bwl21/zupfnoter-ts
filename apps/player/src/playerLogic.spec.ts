import { describe, expect, it } from 'vitest'

import type { PlaybackEvent, PlaybackPositionMarker } from '@zupfnoter/playback'

import {
  nextPositionBoundaryMarker,
  partNameAtTime,
  parsePosition,
  positionAtTime,
  resolveRange,
  tempoBpmAtTime,
} from './playerLogic'

const markers: PlaybackPositionMarker[] = [
  { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
  { timeMs: 4000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
  { timeMs: 8000, position: { measureNumber: 2, passIndex: 1 } },
]

const events: PlaybackEvent[] = [
  { startMs: 0, durationMs: 500, pitch: 60, velocity: 127, position: { measureNumber: 1, passIndex: 1 } },
  { startMs: 4000, durationMs: 500, pitch: 62, velocity: 127, position: { measureNumber: 2, passIndex: 1 } },
]

describe('player logic', () => {
  it('resolves the selected start position instead of resetting to the first measure', () => {
    expect(resolveRange(events, markers, '2.1')).toEqual({ range: [1, 1], startMs: 4000 })
  })

  it('uses a terminal marker with the same position as the last measure boundary', () => {
    expect(nextPositionBoundaryMarker(markers, 1)).toEqual(markers[2])
  })

  it('derives quarter-note BPM from the timed meter', () => {
    expect(tempoBpmAtTime(markers, 0)).toBe(60)
    expect(tempoBpmAtTime([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 6, denominator: 8 } },
      { timeMs: 2250, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 6, denominator: 8 } },
    ], 100)).toBe(80)
    expect(tempoBpmAtTime([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 3, denominator: 4 } },
      { timeMs: 2400, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 3, denominator: 4 } },
    ], 0, 100)).toBe(100)
  })

  it('projects time to the selected measure and pass', () => {
    expect(positionAtTime(markers, 4500)).toEqual({ measureNumber: 2, passIndex: 1 })
    expect(parsePosition('27.3')).toEqual({ measureNumber: 27, passIndex: 3 })
    expect(parsePosition('27')).toBeUndefined()
  })

  it('keeps a trimmed part name until a new non-empty part begins', () => {
    const partMarkers: PlaybackPositionMarker[] = [
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, partName: '  Teil A  ' },
      { timeMs: 1000, position: { measureNumber: 2, passIndex: 1 } },
      { timeMs: 2000, position: { measureNumber: 3, passIndex: 1 }, partName: '   ' },
      { timeMs: 3000, position: { measureNumber: 4, passIndex: 1 }, partName: 'Teil B' },
    ]

    expect(partNameAtTime(partMarkers, 0)).toBe('Teil A')
    expect(partNameAtTime(partMarkers, 2500)).toBe('Teil A')
    expect(partNameAtTime(partMarkers, 3000)).toBe('Teil B')
  })
})
