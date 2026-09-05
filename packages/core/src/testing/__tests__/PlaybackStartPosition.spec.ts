import { describe, expect, it } from 'vitest'
import type { PlaybackStep } from '@zupfnoter/types'
import { playbackTimelineFromPosition } from '../../PlaybackTimeline.js'

function step(measureNumber: number, passIndex: number, playbackStartMs: number): PlaybackStep {
  return {
    position: { measureNumber, passIndex }, playbackStartMs, passIndex,
    originVoiceIds: [], originPlaybackIds: [], originZnIds: [], activeTextRanges: [],
    activeNotes: [], activeTime: '0', durationMs: 1000, sourceTime: 0, flowIndex: 0,
  }
}

describe('playbackTimelineFromPosition', () => {
  const timeline = [step(15, 1, 0), step(16, 1, 1000), step(15, 2, 2000), step(16, 2, 3000)]
  it('finds the requested pass before rebasing the remaining timeline', () => {
    const result = playbackTimelineFromPosition(timeline, { measureNumber: 15, passIndex: 2 })
    expect(result.map((entry) => entry.position)).toEqual([
      { measureNumber: 15, passIndex: 2 }, { measureNumber: 16, passIndex: 2 },
    ])
    expect(result.map((entry) => entry.playbackStartMs)).toEqual([0, 1000])
    expect(timeline[2]?.playbackStartMs).toBe(2000)
  })
  it('does not silently substitute another measure or pass', () => {
    expect(playbackTimelineFromPosition(timeline, { measureNumber: 14, passIndex: 1 })).toEqual([])
    expect(playbackTimelineFromPosition(timeline, { measureNumber: 15, passIndex: 3 })).toEqual([])
    expect(playbackTimelineFromPosition([], { measureNumber: 1, passIndex: 1 })).toEqual([])
  })
})
