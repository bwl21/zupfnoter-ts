import { describe, expect, it } from 'vitest'
import {
  decodePlaybackFragment,
  decodePlaybackPayload,
  encodePlaybackPayload,
  exportPlaybackLink,
  type PlaybackCompressionCodec,
  type PlaybackEvent,
} from './index.js'

const identityCodec: PlaybackCompressionCodec = {
  compress: async (value) => new Uint8Array(value),
  decompress: async (value) => new Uint8Array(value),
}

const events: PlaybackEvent[] = [
  {
    startMs: 0,
    durationMs: 240,
    pitch: 60,
    velocity: 127,
    position: { measureNumber: 27, passIndex: 1 },
  },
  {
    startMs: 0,
    durationMs: 120,
    pitch: 64,
    velocity: 127,
    position: { measureNumber: 27, passIndex: 1 },
  },
  {
    startMs: 480,
    durationMs: 120,
    pitch: 67,
    velocity: 127,
    position: { measureNumber: 3, passIndex: 2 },
  },
]

describe('playback link format', () => {
  it('round-trips simultaneous events and measure/pass positions', async () => {
    const payload = await encodePlaybackPayload(events, { timeResolutionMs: 10 }, identityCodec)
    const decoded = decodePlaybackPayload(payload)

    expect(decoded.timeResolutionMs).toBe(10)
    expect(decoded.events).toEqual([
      { ...events[0], startMs: 0, durationMs: 240 },
      { ...events[1], startMs: 0, durationMs: 120 },
      { ...events[2], startMs: 480, durationMs: 120 },
    ])
  })

  it('creates a player URL in the fragment and decodes it', async () => {
    const result = await exportPlaybackLink(events, {
      playerUrl: 'https://play.zupfnoter.de/',
    }, identityCodec)

    expect(result.url.startsWith('https://play.zupfnoter.de/#p=')).toBe(true)
    const fragment = new URL(result.url).hash.slice(3)
    const decoded = await decodePlaybackFragment(fragment, identityCodec)
    expect(decoded.events).toHaveLength(3)
    expect(decoded.events[2]?.position).toEqual({ measureNumber: 3, passIndex: 2 })
  })

  it('reports encoded sizes and byte categories', async () => {
    const result = await exportPlaybackLink(events, {
      playerUrl: 'https://play.zupfnoter.de/',
    }, identityCodec)

    expect(result.analysis.eventCount).toBe(3)
    expect(result.analysis.binaryBytes).toBe(result.payload.length)
    expect(result.analysis.compressedBytes).toBe(result.payload.length)
    expect(result.analysis.base64UrlChars).toBe(result.encodedPayload.length)
    expect(result.analysis.breakdown.timeBytes).toBeGreaterThan(0)
    expect(result.analysis.breakdown.durationBytes).toBeGreaterThan(0)
    expect(result.analysis.breakdown.pitchBytes).toBe(3)
    expect(result.analysis.percentages.metadataBytes).toBeGreaterThan(0)
  })
})
