import { describe, expect, it } from 'vitest'

import { playbackPositionsFromTimeline } from '../playbackLink'
import type { PlaybackStep } from '../playback'

function step(
  playbackStartMs: number,
  durationMs: number,
  measureNumber: number,
  passIndex: number,
  meter?: PlaybackStep['meter'],
): PlaybackStep {
  return {
    originVoiceIds: [],
    originPlaybackIds: [],
    originZnIds: [],
    activeTextRanges: [],
    activeNotes: [],
    activeTime: String(playbackStartMs),
    playbackStartMs,
    durationMs,
    sourceTime: playbackStartMs,
    position: { measureNumber, passIndex },
    meter,
    flowIndex: playbackStartMs,
    passIndex,
  }
}

describe('playback position export', () => {
  it('exports only position changes and one terminal marker', () => {
    const markers = playbackPositionsFromTimeline([
      step(0, 380, 1, 1, { numerator: 4, denominator: 4 }),
      step(380, 2620, 1, 1),
      step(3000, 500, 2, 1, { numerator: 4, denominator: 4 }),
      step(3500, 2500, 2, 1),
    ])

    expect(markers).toEqual([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 3000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 6000, position: { measureNumber: 2, passIndex: 1 }, meter: undefined },
    ])
  })
})
