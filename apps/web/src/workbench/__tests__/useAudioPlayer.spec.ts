import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PlaybackStep } from '../playback'

const leftScheduleMock = vi.fn<(when: number, events: Array<{ time: number; note: number; duration: number; gain: number }>) => void>()
const rightScheduleMock = vi.fn<(when: number, events: Array<{ time: number; note: number; duration: number; gain: number }>) => void>()

const oscillatorStartMock = vi.fn<(when?: number) => void>()
const oscillatorStopMock = vi.fn<(when?: number) => void>()
const oscillatorConnectMock = vi.fn<(target: unknown) => void>()
const oscillatorFrequencySetValueAtTimeMock = vi.fn<(value: number, when: number) => void>()
const gainConnectMock = vi.fn<(target: unknown) => void>()
const gainSetValueAtTimeMock = vi.fn<(value: number, when: number) => void>()
const gainLinearRampToValueAtTimeMock = vi.fn<(value: number, when: number) => void>()
const gainExponentialRampToValueAtTimeMock = vi.fn<(value: number, when: number) => void>()
const stereoPannerConnectMock = vi.fn<(target: unknown) => void>()

interface MockStereoPannerNode {
  pan: { value: number }
  connect: typeof stereoPannerConnectMock
}

let createdPanners: MockStereoPannerNode[] = []
let oscillatorFrequencyValues: number[] = []
let mockCurrentTime = 10

const instrumentMock = vi.fn(async (_context: unknown, _instrument: string, options?: { destination?: { pan?: { value: number } } }) => ({
  schedule: options?.destination?.pan?.value === -0.9 ? leftScheduleMock : rightScheduleMock,
}))

vi.mock('soundfont-player', () => ({
  instrument: instrumentMock,
}))

import { useAudioPlayer } from '../useAudioPlayer'

class MockAudioContext {
  get currentTime(): number {
    return mockCurrentTime
  }
  state: 'running' | 'suspended' | 'closed' = 'running'
  destination = { kind: 'destination' }

  createOscillator() {
    return {
      type: 'sine' as OscillatorType,
      frequency: {
        get value() { return oscillatorFrequencyValues[oscillatorFrequencyValues.length - 1] ?? 0 },
        set value(value: number) { oscillatorFrequencyValues.push(value) },
        setValueAtTime: oscillatorFrequencySetValueAtTimeMock,
      },
      connect: oscillatorConnectMock,
      start: oscillatorStartMock,
      stop: oscillatorStopMock,
    }
  }

  createGain() {
    return {
      gain: {
        value: 0,
        setValueAtTime: gainSetValueAtTimeMock,
        linearRampToValueAtTime: gainLinearRampToValueAtTimeMock,
        exponentialRampToValueAtTime: gainExponentialRampToValueAtTimeMock,
      },
      connect: gainConnectMock,
    }
  }

  createStereoPanner() {
    const panner: MockStereoPannerNode = {
      pan: { value: 0 },
      connect: stereoPannerConnectMock,
    }
    createdPanners.push(panner)
    return panner
  }

  close(): Promise<void> {
    this.state = 'closed'
    return Promise.resolve()
  }

  resume(): Promise<void> {
    this.state = 'running'
    return Promise.resolve()
  }

  suspend(): Promise<void> {
    this.state = 'suspended'
    return Promise.resolve()
  }
}

const steps: PlaybackStep[] = [
  {
    originVoiceIds: ['1'],
    originPlaybackIds: ['1::note-1'],
    originZnIds: ['note-1'],
    activeTextRanges: [],
    activeNotes: [{ originVoiceId: '1', originPlaybackId: '1::note-1', originZnId: 'note-1', pitch: 60, durationMs: 1000, attack: true, pan: 'left' }],
    activeTime: '0',
    playbackStartMs: 0,
    durationMs: 1000,
    sourceTime: 0,
    flowIndex: 0,
    passIndex: 1,
  },
  {
    originVoiceIds: ['2'],
    originPlaybackIds: ['2::note-2'],
    originZnIds: ['note-2'],
    activeTextRanges: [],
    activeNotes: [
      { originVoiceId: '2', originPlaybackId: '2::note-2', originZnId: 'note-2', pitch: 64, durationMs: 500, attack: true, pan: 'right' },
      { originVoiceId: '2', originPlaybackId: '2::note-2', originZnId: 'note-2', pitch: 60, durationMs: 250, attack: true, pan: 'left' },
    ],
    activeTime: '1',
    playbackStartMs: 1000,
    durationMs: 500,
    sourceTime: 1536,
    flowIndex: 1,
    passIndex: 1,
  },
]

describe('useAudioPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    leftScheduleMock.mockReset()
    rightScheduleMock.mockReset()
    instrumentMock.mockClear()
    oscillatorStartMock.mockReset()
    oscillatorStopMock.mockReset()
    oscillatorConnectMock.mockReset()
    oscillatorFrequencySetValueAtTimeMock.mockReset()
    gainConnectMock.mockReset()
    gainSetValueAtTimeMock.mockReset()
    gainLinearRampToValueAtTimeMock.mockReset()
    gainExponentialRampToValueAtTimeMock.mockReset()
    stereoPannerConnectMock.mockReset()
    createdPanners = []
    oscillatorFrequencyValues = []
    mockCurrentTime = 10
    Object.defineProperty(globalThis, 'AudioContext', {
      value: MockAudioContext,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('schedules separate stereo event streams for soundfont playback', async () => {
    const player = useAudioPlayer({ value: 'harp' })

    await player.schedule(steps, 1)

    expect(instrumentMock).toHaveBeenCalledTimes(2)
    expect(instrumentMock).toHaveBeenNthCalledWith(
      1,
      expect.any(MockAudioContext),
      'orchestral_harp',
      expect.objectContaining({
        destination: expect.objectContaining({
          pan: expect.objectContaining({ value: -0.9 }),
        }),
        gain: 1,
        soundfont: 'FluidR3_GM',
      }),
    )
    expect(instrumentMock).toHaveBeenNthCalledWith(
      2,
      expect.any(MockAudioContext),
      'orchestral_harp',
      expect.objectContaining({
        destination: expect.objectContaining({
          pan: expect.objectContaining({ value: 0.9 }),
        }),
        gain: 1,
        soundfont: 'FluidR3_GM',
      }),
    )
    expect(leftScheduleMock).toHaveBeenCalledTimes(1)
    expect(leftScheduleMock).toHaveBeenCalledWith(10.2, [
      { time: 0, note: 60, duration: 1, gain: 0.9 },
      { time: 1, note: 60, duration: 0.25, gain: 0.6363961030678927 },
    ])
    expect(rightScheduleMock).toHaveBeenCalledTimes(1)
    expect(rightScheduleMock).toHaveBeenCalledWith(10.2, [
      { time: 1, note: 64, duration: 0.5, gain: 0.6363961030678927 },
    ])
  })

  it('keeps doubled notes from different voices on the same stereo side', async () => {
    const player = useAudioPlayer({ value: 'harp' })

    await player.schedule([
      {
        originVoiceIds: ['1', '2'],
        originPlaybackIds: ['1::note-a', '2::note-b'],
        originZnIds: ['note-a', 'note-b'],
        activeTextRanges: [],
        activeNotes: [
          { originVoiceId: '1', originPlaybackId: '1::note-a', originZnId: 'note-a', pitch: 60, durationMs: 1000, attack: true, pan: 'left' },
          { originVoiceId: '2', originPlaybackId: '2::note-b', originZnId: 'note-b', pitch: 60, durationMs: 1000, attack: true, pan: 'left' },
        ],
        activeTime: '0',
        playbackStartMs: 0,
        durationMs: 1000,
        sourceTime: 0,
        flowIndex: 0,
        passIndex: 1,
      },
    ], 1)

    expect(leftScheduleMock).toHaveBeenCalledTimes(1)
    expect(leftScheduleMock).toHaveBeenCalledWith(10.2, [
      { time: 0, note: 60, duration: 1, gain: 0.6363961030678927 },
      { time: 0, note: 60, duration: 1, gain: 0.6363961030678927 },
    ])
  })

  it('plays oscillator mode without loading soundfont samples', async () => {
    const player = useAudioPlayer({ value: 'oscillator' })

    await player.schedule(steps, 1)

    expect(instrumentMock).not.toHaveBeenCalled()
    expect(leftScheduleMock).not.toHaveBeenCalled()
    expect(rightScheduleMock).not.toHaveBeenCalled()
    expect(oscillatorStartMock).toHaveBeenCalledTimes(3)
    expect(oscillatorStopMock).toHaveBeenCalledTimes(3)
    expect(gainConnectMock).toHaveBeenCalled()
    expect(createdPanners.some((panner) => panner.pan.value === -0.9)).toBe(true)
    expect(createdPanners.some((panner) => panner.pan.value === 0.9)).toBe(true)
    expect(oscillatorFrequencySetValueAtTimeMock).toHaveBeenCalledWith(261.6255653005986, 10.2)
  })

  it('uses a distinct signal tone for the last count-in event before entry', async () => {
    const player = useAudioPlayer({ value: 'harp' })
    const onMetronomeBeat = vi.fn()
    const [firstStep, secondStep] = steps
    if (firstStep === undefined || secondStep === undefined) throw new Error('Missing playback test steps')
    const countInSteps: PlaybackStep[] = [
      {
        ...firstStep,
        position: { measureNumber: 1, passIndex: 1 },
        meter: { numerator: 4, denominator: 4 },
      },
      {
        ...secondStep,
        playbackStartMs: 4000,
        position: { measureNumber: 2, passIndex: 1 },
        meter: { numerator: 4, denominator: 4 },
      },
    ]

    await player.schedule(countInSteps, 1, { onMetronomeBeat }, {
      mode: 'countIn',
      minLeadIn: 4,
      bandPreCount: false,
      division: 4,
      subdivision: 1,
    })

    expect(oscillatorFrequencyValues).toEqual([1200, 850, 850, 1500])

    mockCurrentTime = 10.2
    vi.advanceTimersByTime(16)
    expect(onMetronomeBeat).toHaveBeenLastCalledWith({ beat: 1, division: 4, accent: true })
  })

  it('ends count-in on beat two when an opening pickup enters on beat three', async () => {
    const player = useAudioPlayer({ value: 'harp' })
    const onMetronomeBeat = vi.fn()
    const [firstStep, secondStep] = steps
    if (firstStep === undefined || secondStep === undefined) throw new Error('Missing playback test steps')
    const pickupSteps: PlaybackStep[] = [
      {
        ...firstStep,
        position: { measureNumber: 1, passIndex: 1 },
      },
      {
        ...secondStep,
        activeNotes: [],
        playbackStartMs: 2000,
        durationMs: 4000,
        position: { measureNumber: 1, passIndex: 1 },
        meter: { numerator: 4, denominator: 4 },
      },
      {
        ...secondStep,
        activeNotes: [],
        playbackStartMs: 6000,
        durationMs: 4000,
        position: { measureNumber: 2, passIndex: 1 },
        meter: { numerator: 4, denominator: 4 },
      },
    ]

    await player.schedule(pickupSteps, 1, { onMetronomeBeat }, {
      mode: 'always',
      minLeadIn: 4,
      bandPreCount: false,
      division: 4,
      subdivision: 1,
    })

    expect(oscillatorFrequencyValues.slice(0, 6)).toEqual([1200, 850, 850, 850, 1200, 1500])
    expect(oscillatorFrequencyValues[6]).toBe(850)
    expect(oscillatorStartMock.mock.calls[6]).toEqual([16.2])
    expect(leftScheduleMock).toHaveBeenCalledWith(16.2, expect.arrayContaining([
      expect.objectContaining({ time: 0, note: 60 }),
    ]))

    mockCurrentTime = 15.2
    vi.advanceTimersByTime(16)
    expect(onMetronomeBeat).toHaveBeenLastCalledWith({ beat: 2, division: 4, accent: false })
  })

  it('finishes count-in before a written opening rest begins', async () => {
    const player = useAudioPlayer({ value: 'harp' })
    const onMetronomeBeat = vi.fn()
    const [firstStep, secondStep] = steps
    if (firstStep === undefined || secondStep === undefined) throw new Error('Missing playback test steps')
    const restEntrySteps: PlaybackStep[] = [
      {
        ...firstStep,
        activeNotes: [],
        durationMs: 2000,
        position: { measureNumber: 1, passIndex: 1 },
        meter: { numerator: 4, denominator: 4 },
      },
      {
        ...secondStep,
        playbackStartMs: 2000,
        durationMs: 2000,
        position: { measureNumber: 1, passIndex: 1 },
      },
      {
        ...secondStep,
        activeNotes: [],
        playbackStartMs: 4000,
        durationMs: 4000,
        position: { measureNumber: 2, passIndex: 1 },
        meter: { numerator: 4, denominator: 4 },
      },
    ]

    await player.schedule(restEntrySteps, 1, { onMetronomeBeat }, {
      mode: 'always',
      minLeadIn: 2,
      bandPreCount: false,
      division: 4,
      subdivision: 1,
    })

    expect(oscillatorFrequencyValues.slice(0, 4)).toEqual([1200, 850, 850, 1500])
    expect(oscillatorStartMock.mock.calls.slice(0, 4)).toEqual([[10.2], [11.2], [12.2], [13.2]])
    expect(leftScheduleMock).toHaveBeenCalledWith(14.2, expect.arrayContaining([
      expect.objectContaining({ time: 2, note: 60 }),
    ]))

    mockCurrentTime = 13.2
    vi.advanceTimersByTime(16)
    expect(onMetronomeBeat).toHaveBeenLastCalledWith({ beat: 4, division: 4, accent: false })
  })

  it('shows the band pre-count before the normal count-in', async () => {
    const player = useAudioPlayer({ value: 'harp' })
    const onMetronomeBeat = vi.fn()
    const [firstStep, secondStep] = steps
    if (firstStep === undefined || secondStep === undefined) throw new Error('Missing playback test steps')
    const countInSteps: PlaybackStep[] = [
      { ...firstStep, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { ...secondStep, playbackStartMs: 4000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
    ]

    await player.schedule(countInSteps, 1, { onMetronomeBeat }, {
      mode: 'countIn', minLeadIn: 4, bandPreCount: true, division: 4, subdivision: 1,
    })

    mockCurrentTime = 10.2
    vi.advanceTimersByTime(16)
    expect(onMetronomeBeat).toHaveBeenLastCalledWith({ beat: 1, division: 4, accent: false })
    mockCurrentTime = 12.2
    vi.advanceTimersByTime(16)
    expect(onMetronomeBeat).toHaveBeenLastCalledWith({ beat: 3, division: 4, accent: false })
    mockCurrentTime = 14.2
    vi.advanceTimersByTime(16)
    expect(onMetronomeBeat).toHaveBeenLastCalledWith({ beat: 1, division: 4, accent: true })
  })

  it('schedules audibly distinct main beats and subdivisions during playback', async () => {
    const player = useAudioPlayer({ value: 'harp' })
    const onMetronomeBeat = vi.fn()
    const [firstStep, secondStep] = steps
    if (firstStep === undefined || secondStep === undefined) throw new Error('Missing playback test steps')
    const metronomeSteps: PlaybackStep[] = [
      {
        ...firstStep,
        durationMs: 4000,
        position: { measureNumber: 1, passIndex: 1 },
        meter: { numerator: 4, denominator: 4 },
      },
      {
        ...secondStep,
        playbackStartMs: 4000,
        durationMs: 4000,
        position: { measureNumber: 2, passIndex: 1 },
        meter: { numerator: 4, denominator: 4 },
      },
    ]

    await player.schedule(metronomeSteps, 1, { onMetronomeBeat }, {
      mode: 'playback',
      minLeadIn: 4,
      bandPreCount: false,
      division: 2,
      subdivision: 2,
    })

    expect(oscillatorFrequencyValues.slice(0, 4)).toEqual([1200, 650, 850, 650])
    expect(gainSetValueAtTimeMock.mock.calls.slice(0, 4).map(([gain]) => gain)).toEqual([0.34, 0.11, 0.22, 0.11])

    mockCurrentTime = 10.2
    vi.advanceTimersByTime(16)
    expect(onMetronomeBeat).toHaveBeenLastCalledWith({ beat: 1, division: 2, accent: true })

    mockCurrentTime = 12.2
    vi.advanceTimersByTime(16)
    expect(onMetronomeBeat).toHaveBeenLastCalledWith({ beat: 2, division: 2, accent: false })
  })

  it('keeps the configured tempo across multiple shortened repeat boundaries', async () => {
    const player = useAudioPlayer({ value: 'harp' })
    const firstStep = steps[0]
    if (firstStep === undefined) throw new Error('Missing playback test step')
    const durations = [3000, 4000, 3000, 4000]
    let playbackStartMs = 0
    const repeatSteps: PlaybackStep[] = durations.map((durationMs, index) => {
      const step: PlaybackStep = {
        ...firstStep,
        playbackStartMs,
        durationMs,
        position: { measureNumber: index + 1, passIndex: index + 1 },
        meter: { numerator: 4, denominator: 4 },
        flowIndex: index,
        passIndex: index + 1,
      }
      playbackStartMs += durationMs
      return step
    })

    await player.schedule(repeatSteps, 1, {}, {
      mode: 'playback',
      division: 4,
      subdivision: 1,
    }, 60, 0.25)

    expect(oscillatorStartMock.mock.calls.map(([when]) => when)).toEqual(
      Array.from({ length: 14 }, (_, index) => 10.2 + index),
    )
  })

  it('keeps clicking when a volta jumps to a position without an explicit meter', async () => {
    const player = useAudioPlayer({ value: 'harp' })
    const firstStep = steps[0]
    if (firstStep === undefined) throw new Error('Missing playback test step')
    const voltaSteps: PlaybackStep[] = [
      {
        ...firstStep,
        playbackStartMs: 0,
        durationMs: 1800,
        position: { measureNumber: 3, passIndex: 2 },
        meter: { numerator: 3, denominator: 4 },
        flowIndex: 0,
        passIndex: 2,
        voltaNumber: 1,
      },
      {
        ...firstStep,
        playbackStartMs: 1800,
        durationMs: 1800,
        position: { measureNumber: 2, passIndex: 3 },
        meter: undefined,
        flowIndex: 1,
        passIndex: 3,
      },
      {
        ...firstStep,
        playbackStartMs: 3600,
        durationMs: 1800,
        position: { measureNumber: 4, passIndex: 3 },
        meter: { numerator: 3, denominator: 4 },
        flowIndex: 2,
        passIndex: 3,
        voltaNumber: 2,
      },
    ]

    await player.schedule(voltaSteps, 1, {}, {
      mode: 'playback',
      subdivision: 1,
    }, 100, 0.25)

    expect(oscillatorStartMock.mock.calls.map(([when]) => Math.round((when ?? 0) * 10) / 10)).toEqual([
      10.2, 10.8, 11.4,
      12, 12.6, 13.2,
      13.8, 14.4, 15,
    ])
  })

  it('follows changing ABC meters without a configured division', async () => {
    const player = useAudioPlayer({ value: 'harp' })
    const firstStep = steps[0]
    if (firstStep === undefined) throw new Error('Missing playback test step')
    const meterSteps: PlaybackStep[] = [
      {
        ...firstStep,
        playbackStartMs: 0,
        durationMs: 4000,
        position: { measureNumber: 1, passIndex: 1 },
        meter: { numerator: 4, denominator: 4 },
        flowIndex: 0,
      },
      {
        ...firstStep,
        playbackStartMs: 4000,
        durationMs: 3000,
        position: { measureNumber: 2, passIndex: 1 },
        meter: { numerator: 6, denominator: 8, grouping: [3, 3] },
        flowIndex: 1,
      },
      {
        ...firstStep,
        playbackStartMs: 7000,
        durationMs: 3000,
        position: { measureNumber: 3, passIndex: 1 },
        meter: { numerator: 3, denominator: 4 },
        flowIndex: 2,
      },
    ]

    await player.schedule(meterSteps, 1, {}, {
      mode: 'playback',
      subdivision: 1,
    }, 60, 0.25)

    expect(oscillatorStartMock.mock.calls.map(([when]) => when)).toEqual([
      10.2, 11.2, 12.2, 13.2,
      14.2, 14.7, 15.2, 15.7, 16.2, 16.7,
      17.2, 18.2, 19.2,
    ])
  })

  it('keeps scheduling the music after the count-in in always mode', async () => {
    const player = useAudioPlayer({ value: 'harp' })
    const onStepStart = vi.fn<(step: PlaybackStep) => void>()
    const [firstStep, secondStep] = steps
    if (firstStep === undefined || secondStep === undefined) throw new Error('Missing playback test steps')
    const metronomeSteps: PlaybackStep[] = [
      {
        ...firstStep,
        durationMs: 4000,
        position: { measureNumber: 1, passIndex: 1 },
        meter: { numerator: 4, denominator: 4 },
      },
      {
        ...secondStep,
        playbackStartMs: 4000,
        durationMs: 4000,
        position: { measureNumber: 2, passIndex: 1 },
        meter: { numerator: 4, denominator: 4 },
      },
    ]

    await player.schedule(metronomeSteps, 1, { onStepStart }, {
      mode: 'always',
      minLeadIn: 4,
      bandPreCount: false,
      subdivision: 1,
    })

    expect(leftScheduleMock).toHaveBeenCalledWith(14.2, expect.arrayContaining([
      expect.objectContaining({ time: 0, note: 60 }),
    ]))
    expect(rightScheduleMock).toHaveBeenCalledWith(14.2, expect.arrayContaining([
      expect.objectContaining({ time: 4, note: 64 }),
    ]))

    mockCurrentTime = 14.2
    vi.advanceTimersByTime(16)
    expect(onStepStart).toHaveBeenCalledWith(metronomeSteps[0])
  })

  it('derives visual callbacks from the scheduled audio clock', async () => {
    const player = useAudioPlayer({ value: 'harp' })
    const onStepStart = vi.fn<(step: PlaybackStep) => void>()
    const onStepEnd = vi.fn<(step: PlaybackStep) => void>()

    await player.schedule(steps, 1, { onStepStart, onStepEnd })

    vi.advanceTimersByTime(16)
    expect(onStepStart).not.toHaveBeenCalled()

    mockCurrentTime = 10.2
    vi.advanceTimersByTime(16)
    expect(onStepStart).toHaveBeenCalledWith(steps[0])

    mockCurrentTime = 11.2
    vi.advanceTimersByTime(16)
    expect(onStepEnd).toHaveBeenCalledWith(steps[0])
  })

  it('catches up all visual callbacks after a delayed browser frame', async () => {
    const player = useAudioPlayer({ value: 'harp' })
    const onStepStart = vi.fn<(step: PlaybackStep) => void>()
    const onStepEnd = vi.fn<(step: PlaybackStep) => void>()

    await player.schedule(steps, 1, { onStepStart, onStepEnd })

    mockCurrentTime = 11.7
    vi.advanceTimersByTime(16)

    expect(onStepStart.mock.calls.map(([step]) => step)).toEqual(steps)
    expect(onStepEnd.mock.calls.map(([step]) => step)).toEqual(steps)
  })
})
