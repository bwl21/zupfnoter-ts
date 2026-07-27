import { describe, expect, it } from 'vitest'

import type { PlaybackEvent, PlaybackPositionMarker } from '@zupfnoter/playback'

import {
  nextPositionBoundaryMarker,
  parsePosition,
  positionAtTime,
  resolveCountIn,
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
  it.each([
    { name: '3/4', numerator: 3, denominator: 4, beatDurationMs: 600 },
    { name: '4/4', numerator: 4, denominator: 4, beatDurationMs: 600 },
    { name: '6/8', numerator: 6, denominator: 8, beatDurationMs: 300 },
  ])('covers all count-in styles for a complete $name measure', ({ numerator, denominator, beatDurationMs }) => {
    const completeMarkers: PlaybackPositionMarker[] = [
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator, denominator } },
      { timeMs: numerator * beatDurationMs, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator, denominator } },
    ]
    for (const style of ['none', 'classic', 'band', 'last-beats', 'pickup'] as const) {
      const result = resolveCountIn(completeMarkers, 0, style, 100)
      if (style === 'none') expect(result).toBeUndefined()
      else expect(result).toBeDefined()
    }
  })

  it.each([
    { name: '3/4 one-beat pickup', numerator: 3, denominator: 4, pickupBeats: 1, beatDurationMs: 600 },
    { name: '3/4 two-beat pickup', numerator: 3, denominator: 4, pickupBeats: 2, beatDurationMs: 600 },
    { name: '4/4 one-beat pickup', numerator: 4, denominator: 4, pickupBeats: 1, beatDurationMs: 600 },
    { name: '4/4 two-beat pickup', numerator: 4, denominator: 4, pickupBeats: 2, beatDurationMs: 600 },
    { name: '6/8 one-beat pickup', numerator: 6, denominator: 8, pickupBeats: 1, beatDurationMs: 300 },
    { name: '6/8 two-beat pickup', numerator: 6, denominator: 8, pickupBeats: 2, beatDurationMs: 300 },
    { name: '6/8 three-beat pickup', numerator: 6, denominator: 8, pickupBeats: 3, beatDurationMs: 300 },
  ])('covers all count-in styles for a $name', ({ numerator, denominator, pickupBeats, beatDurationMs }) => {
    const pickupDurationMs = pickupBeats * beatDurationMs
    const firstMeasureDurationMs = numerator * beatDurationMs
    const pickupMarkers: PlaybackPositionMarker[] = [
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 } },
      { timeMs: pickupDurationMs, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator, denominator } },
      { timeMs: pickupDurationMs + firstMeasureDurationMs, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator, denominator } },
    ]
    for (const style of ['none', 'classic', 'band', 'last-beats', 'pickup'] as const) {
      const result = resolveCountIn(pickupMarkers, 0, style, 100)
      if (style === 'none') {
        expect(result).toBeUndefined()
      } else {
        expect(result).toBeDefined()
        expect(result?.meter).toEqual({ numerator, denominator })
      }
    }
  })

  it('resolves the selected start position instead of resetting to the first measure', () => {
    expect(resolveRange(events, markers, '2.1')).toEqual({ range: [1, 1], startMs: 4000 })
  })

  it('uses a terminal marker with the same position as the last measure boundary', () => {
    expect(nextPositionBoundaryMarker(markers, 1)).toEqual(markers[2])
  })

  it('resolves one count-in measure from the position track', () => {
    expect(resolveCountIn(markers, 0)).toEqual({
      durationMs: 4000,
      beatDurationMs: 1000,
      beatOffsetsMs: [0, 1000, 2000, 3000],
      meter: { numerator: 4, denominator: 4 },
      beats: [0, 1, 2, 3],
      leadBeatCount: 0,
    })
    expect(resolveCountIn(markers, 4000)).toEqual({
      durationMs: 4000,
      beatDurationMs: 1000,
      beatOffsetsMs: [0, 1000, 2000, 3000],
      meter: { numerator: 4, denominator: 4 },
      beats: [0, 1, 2, 3],
      leadBeatCount: 0,
    })
  })

  it('calculates the selectable count-in styles from one measure', () => {
    expect(resolveCountIn(markers, 0, 'none')).toBeUndefined()
    expect(resolveCountIn(markers, 0, 'band')).toMatchObject({
      durationMs: 8000,
      beatOffsetsMs: [0, 2000, 4000, 5000, 6000, 7000],
      beats: [0, 1, 0, 1, 2, 3],
      leadBeatCount: 2,
    })
    expect(resolveCountIn(markers, 0, 'last-beats')?.beats).toEqual([2, 3])
    expect(resolveCountIn(markers, 0, 'pickup')?.beats).toEqual([0, 1, 2, 3])
    expect(resolveCountIn([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 2000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 6000, position: { measureNumber: 3, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
    ], 0, 'pickup')?.beats).toEqual([0, 1])
  })

  it('keeps count-in available when the first marker is an unmetered pickup', () => {
    expect(resolveCountIn([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 } },
      { timeMs: 600, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 3, denominator: 4 } },
      { timeMs: 2400, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 3, denominator: 4 } },
    ], 0, 'classic', 100)).toMatchObject({
      durationMs: 1200,
      beatDurationMs: 600,
      beats: [0, 1],
    })
    expect(resolveCountIn([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 } },
      { timeMs: 600, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 3, denominator: 4 } },
      { timeMs: 2400, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 3, denominator: 4 } },
    ], 0, 'band', 100)).toMatchObject({
      beats: [0, 1, 0, 1],
      beatOffsetsMs: [0, 1200, 2400, 3000],
      durationMs: 3600,
      leadBeatCount: 2,
    })
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
})
