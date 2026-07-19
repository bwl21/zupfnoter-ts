import { describe, expect, it } from 'vitest'

import type { PlaybackEvent, PlaybackPositionMarker } from '@zupfnoter/playback'

import {
  nextPositionBoundaryMarker,
  parsePosition,
  positionAtTime,
  resolveRange,
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

  it('projects time to the selected measure and pass', () => {
    expect(positionAtTime(markers, 4500)).toEqual({ measureNumber: 2, passIndex: 1 })
    expect(parsePosition('27.3')).toEqual({ measureNumber: 27, passIndex: 3 })
    expect(parsePosition('27')).toBeUndefined()
  })
})
