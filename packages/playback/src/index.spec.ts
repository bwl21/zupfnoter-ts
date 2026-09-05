import { describe, expect, it } from 'vitest'
import {
  decodePlaybackFragment,
  decodePlaybackPayload,
  createPlaybackCountInPlan,
  createPlaybackMetronomeClicks,
  encodePlaybackPayload,
  exportPlaybackLink,
  resolvePlaybackMetronomeEventSound,
  resolvePlaybackMetronomeSound,
  type PlaybackCompressionCodec,
  type PlaybackEvent,
} from './index.js'

const identityCodec: PlaybackCompressionCodec = {
  compress: async (value) => new Uint8Array(value),
  decompress: async (value) => new Uint8Array(value),
}

describe('shared metronome sound profile', () => {
  it('uses one profile and gives the entry signal priority over the metric accent', () => {
    expect(resolvePlaybackMetronomeSound('pre-count')).toEqual({ frequencyHz: 1800, gain: 0.22 })
    expect(resolvePlaybackMetronomeSound('accent')).toEqual({ frequencyHz: 1200, gain: 0.34 })
    expect(resolvePlaybackMetronomeSound('regular')).toEqual({ frequencyHz: 850, gain: 0.22 })
    expect(resolvePlaybackMetronomeSound('subdivision')).toEqual({ frequencyHz: 650, gain: 0.11 })
    expect(resolvePlaybackMetronomeSound('entry')).toEqual({ frequencyHz: 1500, gain: 0.3 })
    expect(resolvePlaybackMetronomeEventSound('PRE_COUNT')).toBe('pre-count')
    expect(resolvePlaybackMetronomeEventSound('BAR_START')).toBe('accent')
    expect(resolvePlaybackMetronomeEventSound('MAIN_BEAT')).toBe('regular')
    expect(resolvePlaybackMetronomeEventSound('SUBDIVISION')).toBe('subdivision')
    expect(resolvePlaybackMetronomeEventSound('BAR_START', true)).toBe('entry')
    expect(resolvePlaybackMetronomeEventSound('SUBDIVISION', true)).toBe('entry')
  })

  it('preserves distinct sound roles in count-in and playback scheduling', () => {
    const markers = [
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 4000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
    ]
    const countIn = createPlaybackCountInPlan(markers, 0, {
      minLeadIn: 2,
      bandPreCount: false,
      division: 2,
      subdivision: 2,
    })
    expect(countIn?.events.map((event) => resolvePlaybackMetronomeEventSound(event.kind, event.isLastBeforeEntry))).toEqual([
      'accent', 'subdivision', 'regular', 'entry',
    ])

    const playback = createPlaybackMetronomeClicks(markers, 4000, 2, 2)
    expect(playback.slice(0, 4).map(({ beat, division, subdivision }) => ({ beat, division, subdivision }))).toEqual([
      { beat: 1, division: 2, subdivision: 0 },
      { beat: 1, division: 2, subdivision: 1 },
      { beat: 2, division: 2, subdivision: 0 },
      { beat: 2, division: 2, subdivision: 1 },
    ])
    expect(playback.slice(0, 4).map((event) => resolvePlaybackMetronomeEventSound(event.kind))).toEqual([
      'accent', 'subdivision', 'regular', 'subdivision',
    ])
  })

  it('uses each ABC meter numerator when division is not configured', () => {
    const markers = [
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 3, denominator: 4 } },
      { timeMs: 3000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 2, denominator: 4 } },
      { timeMs: 5000, position: { measureNumber: 3, passIndex: 1 }, meter: { numerator: 2, denominator: 4 } },
    ]

    const countIn = createPlaybackCountInPlan(markers, 0, {
      minLeadIn: 1, bandPreCount: false, subdivision: 1,
    })
    const playback = createPlaybackMetronomeClicks(markers, 5000, undefined, 1)

    expect(countIn?.events.map((event) => event.beat)).toEqual([0, 1, 2])
    expect(playback.map((click) => click.division)).toEqual([3, 3, 3, 2, 2])
  })

  it('uses the current meter numerator as the default minimum count-in', () => {
    const markers = [
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 3, denominator: 4 } },
      { timeMs: 3000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 3, denominator: 4 } },
    ]

    const countIn = createPlaybackCountInPlan(markers, 3000, {
      bandPreCount: false,
      subdivision: 1,
    })

    expect(countIn?.events.map((event) => event.beat)).toEqual([0, 1, 2])
  })

  it('counts only the required complete measure before a later range start', () => {
    const markers = Array.from({ length: 16 }, (_value, index) => ({
      timeMs: index * 4000,
      position: { measureNumber: index + 1, passIndex: 1 },
      meter: { numerator: 4, denominator: 4 },
    }))

    const countIn = createPlaybackCountInPlan(markers, 56_000, {
      minLeadIn: 4,
      bandPreCount: false,
      division: 4,
      subdivision: 1,
    })

    expect(countIn?.durationMs).toBe(4_000)
    expect(countIn?.events.map((event) => event.offsetMs)).toEqual([0, 1_000, 2_000, 3_000])
  })

  it('changes click division and duration with each ABC meter', () => {
    const markers = [
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 4000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 6, denominator: 8, grouping: [3, 3] } },
      { timeMs: 7000, position: { measureNumber: 3, passIndex: 1 }, meter: { numerator: 3, denominator: 4 } },
      { timeMs: 10000, position: { measureNumber: 4, passIndex: 1 }, meter: { numerator: 12, denominator: 8, grouping: [3, 3, 3, 3] } },
      { timeMs: 16000, position: { measureNumber: 4, passIndex: 1 } },
    ]

    const clicks = createPlaybackMetronomeClicks(markers, 16000, undefined, 1, 60, 0.25)
    const byMeasureStart = [0, 4000, 7000, 10000].map((startMs, index, starts) => {
      const endMs = starts[index + 1] ?? 16000
      return clicks.filter((click) => click.timeMs >= startMs && click.timeMs < endMs)
    })

    expect(byMeasureStart.map((measure) => measure.map((click) => click.timeMs))).toEqual([
      [0, 1000, 2000, 3000],
      [4000, 4500, 5000, 5500, 6000, 6500],
      [7000, 8000, 9000],
      [10000, 10500, 11000, 11500, 12000, 12500, 13000, 13500, 14000, 14500, 15000, 15500],
    ])
    expect(byMeasureStart.map((measure) => measure[0]?.division)).toEqual([4, 6, 3, 12])

    const countInAfterMeterChange = createPlaybackCountInPlan(markers, 7000, {
      minLeadIn: 3,
      bandPreCount: false,
      subdivision: 1,
    }, 60, 0.25)
    expect(countInAfterMeterChange?.meter).toEqual({ numerator: 3, denominator: 4 })
    expect(countInAfterMeterChange?.beatDurationMs).toBe(1000)
  })

  it('uses the Q unit correctly when no complete reference measure exists', () => {
    const plan = createPlaybackCountInPlan([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 6, denominator: 8 } },
    ], 0, {
      minLeadIn: 2,
      bandPreCount: false,
      division: 6,
      subdivision: 1,
    }, 120, 0.25)

    expect(plan?.beatDurationMs).toBe(250)
  })

  it('continues playback clicks on the entry beat of an opening pickup', () => {
    const clicks = createPlaybackMetronomeClicks([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 } },
      { timeMs: 2000, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 6000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
    ], 6000, 4, 1)

    expect(clicks.map(({ timeMs, beat }) => ({ timeMs, beat }))).toEqual([
      { timeMs: 0, beat: 3 },
      { timeMs: 1000, beat: 4 },
      { timeMs: 2000, beat: 1 },
      { timeMs: 3000, beat: 2 },
      { timeMs: 4000, beat: 3 },
      { timeMs: 5000, beat: 4 },
    ])
  })

  it('uses Q tempo for a pickup that begins with a written rest', () => {
    const clicks = createPlaybackMetronomeClicks([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 } },
      { timeMs: 1800, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 4200, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 9000, position: { measureNumber: 3, passIndex: 2 }, meter: { numerator: 4, denominator: 4 } },
    ], 1800, undefined, 1, 100, 0.25)

    expect(clicks.map(({ timeMs, beat }) => ({ timeMs, beat }))).toEqual([
      { timeMs: 0, beat: 2 },
      { timeMs: 600, beat: 3 },
      { timeMs: 1200, beat: 4 },
    ])
  })

  it('keeps a constant beat across a shortened repeat ending and the repeated pickup', () => {
    const clicks = createPlaybackMetronomeClicks([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 } },
      { timeMs: 1000, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 5000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 8000, position: { measureNumber: 1, passIndex: 2 } },
      { timeMs: 9000, position: { measureNumber: 1, passIndex: 2 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 13000, position: { measureNumber: 2, passIndex: 2 }, meter: { numerator: 4, denominator: 4 } },
    ], 13000, 4, 1)

    expect(clicks
      .filter((click) => click.timeMs >= 5000 && click.timeMs < 10000)
      .map(({ timeMs, beat }) => ({ timeMs, beat }))).toEqual([
      { timeMs: 5000, beat: 1 },
      { timeMs: 6000, beat: 2 },
      { timeMs: 7000, beat: 3 },
      { timeMs: 8000, beat: 4 },
      { timeMs: 9000, beat: 1 },
    ])
  })

  it('keeps the tempo across any number of shortened repeat boundaries', () => {
    const clicks = createPlaybackMetronomeClicks([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 } },
      { timeMs: 1000, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 5000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 8000, position: { measureNumber: 1, passIndex: 2 } },
      { timeMs: 9000, position: { measureNumber: 1, passIndex: 2 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 13000, position: { measureNumber: 2, passIndex: 2 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 16000, position: { measureNumber: 1, passIndex: 3 } },
      { timeMs: 17000, position: { measureNumber: 1, passIndex: 3 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 21000, position: { measureNumber: 2, passIndex: 3 }, meter: { numerator: 4, denominator: 4 } },
    ], 21000, 4, 1, 60, 0.25)

    expect(clicks.map((click) => click.timeMs)).toEqual(
      Array.from({ length: 21 }, (_, index) => index * 1000),
    )
    expect(clicks.filter((click) => click.timeMs === 8000 || click.timeMs === 16000)
      .map(({ beat, kind }) => ({ beat, kind }))).toEqual([
      { beat: 4, kind: 'MAIN_BEAT' },
      { beat: 4, kind: 'MAIN_BEAT' },
    ])
  })
})

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
  it('plans the minimum lead-in from the actual entry position', () => {
    const barStart = createPlaybackCountInPlan([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 4000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
    ], 0, { minLeadIn: 2, bandPreCount: false, division: 4, subdivision: 1 })
    expect(barStart?.events.map((event) => event.beat)).toEqual([0, 1, 2, 3])

    const beatThreeEntry = createPlaybackCountInPlan([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 } },
      { timeMs: 2000, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 6000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
    ], 0, { minLeadIn: 2, bandPreCount: false, division: 4, subdivision: 1 })
    expect(beatThreeEntry?.events.map((event) => event.beat)).toEqual([0, 1])
    expect(beatThreeEntry?.events.at(-1)?.isLastBeforeEntry).toBe(true)
  })

  it('counts through written rests to an entry on beat three', () => {
    const markers = [
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 4000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
    ]

    const beatThreeEntry = createPlaybackCountInPlan(
      markers,
      2000,
      { minLeadIn: 2, bandPreCount: false, division: 4, subdivision: 1 },
    )
    const beatTwoEntry = createPlaybackCountInPlan(
      markers,
      1000,
      { minLeadIn: 2, bandPreCount: false, division: 4, subdivision: 1 },
    )

    expect(beatThreeEntry?.durationMs).toBe(2000)
    expect(beatThreeEntry?.events.map((event) => event.beat)).toEqual([0, 1])
    expect(beatThreeEntry?.events.at(-1)?.isLastBeforeEntry).toBe(true)
    expect(beatTwoEntry?.durationMs).toBe(5000)
    expect(beatTwoEntry?.events.map((event) => event.beat)).toEqual([0, 1, 2, 3, 0])
  })

  it('keeps band pre-count and metric subdivisions semantically distinct', () => {
    const plan = createPlaybackCountInPlan([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 6, denominator: 8 } },
      { timeMs: 3000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 6, denominator: 8 } },
    ], 0, { minLeadIn: 2, bandPreCount: true, division: 2, subdivision: 3 })
    expect(plan?.events.slice(0, 2).map((event) => event.kind)).toEqual(['PRE_COUNT', 'PRE_COUNT'])
    expect(plan?.events.slice(2).map((event) => event.kind)).toEqual([
      'BAR_START', 'SUBDIVISION', 'SUBDIVISION',
      'MAIN_BEAT', 'SUBDIVISION', 'SUBDIVISION',
    ])
    expect(plan?.events.at(-1)?.isLastBeforeEntry).toBe(true)
  })

  it('does not shorten count-in timing at a part marker inside the entry measure', () => {
    const plan = createPlaybackCountInPlan([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 }, partName: 'Teil A' },
      { timeMs: 1000, position: { measureNumber: 1, passIndex: 1 }, partName: 'Teil B' },
      { timeMs: 4000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
    ], 0, { minLeadIn: 4, bandPreCount: true, division: 4, subdivision: 1 })

    expect(plan?.beatDurationMs).toBe(1000)
    expect(plan?.durationMs).toBe(8000)
    expect(plan?.events.map((event) => event.offsetMs)).toEqual([0, 2000, 4000, 5000, 6000, 7000])
  })

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
    expect(result.analysis.breakdown.markerBytes).toBeGreaterThan(0)
  })

  it('decodes the compact format without default velocity and pass repetition', async () => {
    const compactEvents: PlaybackEvent[] = [
      { ...events[0], velocity: undefined, position: { measureNumber: 1, passIndex: 1 } },
      { ...events[1], velocity: undefined, position: { measureNumber: 1, passIndex: 1 } },
    ]
    const result = await exportPlaybackLink(compactEvents, {
      playerUrl: 'https://play.zupfnoter.de/',
    }, identityCodec)
    expect(result.analysis.breakdown.velocityBytes).toBe(0)
    expect(result.analysis.breakdown.flagsBytes).toBe(2)
    const decoded = decodePlaybackPayload(result.payload)
    expect(decoded.events.map((event) => event.position)).toEqual([
      { measureNumber: 1, passIndex: 1 },
      { measureNumber: 1, passIndex: 1 },
    ])
  })

  it('keeps position changes independent from audio event starts', async () => {
    const result = await exportPlaybackLink([
      { ...events[0], startMs: 0, durationMs: 960, position: { measureNumber: 1, passIndex: 1 } },
      { ...events[1], startMs: 960, durationMs: 120, position: { measureNumber: 2, passIndex: 1 } },
    ], {
      playerUrl: 'https://play.zupfnoter.de/',
      positionMarkers: [
        { timeMs: 0, position: { measureNumber: 1, passIndex: 1 } },
        { timeMs: 480, position: { measureNumber: 2, passIndex: 1 } },
      ],
    }, identityCodec)

    const decoded = decodePlaybackPayload(result.payload)
    expect(decoded.positionMarkers).toEqual([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 } },
      { timeMs: 480, position: { measureNumber: 2, passIndex: 1 } },
    ])
    expect(decoded.events[0]?.position).toEqual({ measureNumber: 1, passIndex: 1 })
  })

  it('round-trips changing meters and beat grouping in the position track', async () => {
    const result = await exportPlaybackLink(events, {
      playerUrl: 'https://play.zupfnoter.de/',
      positionMarkers: [
        { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 3, denominator: 4 } },
        { timeMs: 480, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 7, denominator: 8, grouping: [2, 2, 3] } },
      ],
    }, identityCodec)

    expect((await decodePlaybackFragment(new URL(result.url).hash.slice(3), identityCodec)).positionMarkers).toEqual([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 3, denominator: 4 } },
      { timeMs: 480, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 7, denominator: 8, grouping: [2, 2, 3] } },
    ])
  })

  it('round-trips named parts in the position track', async () => {
    const result = await exportPlaybackLink(events, {
      playerUrl: 'https://play.zupfnoter.de/',
      positionMarkers: [
        { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, partName: ' A ' },
        { timeMs: 480, position: { measureNumber: 2, passIndex: 1 }, partName: '   ' },
      ],
    }, identityCodec)

    expect(decodePlaybackPayload(result.payload).positionMarkers).toEqual([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: undefined, partName: ' A ' },
      { timeMs: 480, position: { measureNumber: 2, passIndex: 1 }, meter: undefined },
    ])
    expect(result.payload[3]).toBe(8)
  })

  it('round-trips the per-extract metronome settings', async () => {
    const result = await exportPlaybackLink(events, {
      playerUrl: 'https://play.zupfnoter.de/',
      metronome: {
        mode: 'always',
        minLeadIn: 6,
        bandPreCount: true,
        division: 3,
        subdivision: 2,
      },
    }, identityCodec)

    expect(decodePlaybackPayload(result.payload).metronome).toEqual({
      mode: 'always',
      minLeadIn: 6,
      bandPreCount: true,
      division: 3,
      subdivision: 2,
    })
  })

  it('round-trips a meter-derived metronome division', async () => {
    const result = await exportPlaybackLink(events, {
      playerUrl: 'https://play.zupfnoter.de/',
      metronome: { mode: 'always', minLeadIn: 4, bandPreCount: false, subdivision: 1 },
    }, identityCodec)

    expect(decodePlaybackPayload(result.payload).metronome).toEqual({
      mode: 'always', minLeadIn: 4, bandPreCount: false, division: undefined, subdivision: 1,
    })
  })

  it('rejects invalid metronome counting values', async () => {
    await expect(exportPlaybackLink(events, {
      playerUrl: 'https://play.zupfnoter.de/',
      metronome: { mode: 'always', minLeadIn: -1, division: 4, subdivision: 1 },
    }, identityCodec)).rejects.toThrow('Invalid playback count settings')
  })

  it('preserves a terminal marker for the final measure', async () => {
    const result = await exportPlaybackLink(events, {
      playerUrl: 'https://play.zupfnoter.de/',
      positionMarkers: [
        { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
        { timeMs: 1920, position: { measureNumber: 1, passIndex: 1 } },
      ],
    }, identityCodec)

    expect((await decodePlaybackFragment(new URL(result.url).hash.slice(3), identityCodec)).positionMarkers).toEqual([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 1920, position: { measureNumber: 1, passIndex: 1 }, meter: undefined },
    ])
  })

  it('keeps decoding version 1 payloads', () => {
    const legacyPayload = new Uint8Array([
      0x5a, 0x4e, 0x50, 1, 1, 10, 1,
      0, 12, 60, 127, 1, 1,
    ])
    expect(decodePlaybackPayload(legacyPayload).events).toEqual([{
      startMs: 0,
      durationMs: 120,
      pitch: 60,
      velocity: 127,
      position: { measureNumber: 1, passIndex: 1 },
    }])
  })

  it('handles long sequences with simultaneous events and velocity changes', async () => {
    const longEvents: PlaybackEvent[] = Array.from({ length: 1200 }, (_, index) => ({
      startMs: Math.floor(index / 6) * 80,
      durationMs: 80,
      pitch: 48 + (index % 36),
      velocity: 80 + (index % 40),
      position: { measureNumber: Math.floor(index / 24) + 1, passIndex: 1 },
    }))
    const result = await exportPlaybackLink(longEvents, {
      playerUrl: 'https://play.zupfnoter.de/',
    }, identityCodec)
    expect(decodePlaybackPayload(result.payload).events).toHaveLength(longEvents.length)
    expect(result.analysis.eventCount).toBe(1200)
  })

  it('rejects unknown versions and truncated payloads', async () => {
    const result = await exportPlaybackLink(events, {
      playerUrl: 'https://play.zupfnoter.de/',
    }, identityCodec)
    const unknownVersion = new Uint8Array(result.payload)
    unknownVersion[3] = 99
    expect(() => decodePlaybackPayload(unknownVersion)).toThrow('Unsupported playback format version')
    const rejectedDraftVersion = new Uint8Array(result.payload)
    rejectedDraftVersion[3] = 6
    expect(() => decodePlaybackPayload(rejectedDraftVersion)).toThrow('Unsupported playback format version: 6')
    expect(() => decodePlaybackPayload(result.payload.slice(0, -1))).toThrow()
  })
})
