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
const stereoPannerConnectMock = vi.fn<(target: unknown) => void>()

interface MockStereoPannerNode {
  pan: { value: number }
  connect: typeof stereoPannerConnectMock
}

let createdPanners: MockStereoPannerNode[] = []

const instrumentMock = vi.fn(async (_context: unknown, _instrument: string, options?: { destination?: { pan?: { value: number } } }) => ({
  schedule: options?.destination?.pan?.value === -0.9 ? leftScheduleMock : rightScheduleMock,
}))

vi.mock('soundfont-player', () => ({
  instrument: instrumentMock,
}))

import { useAudioPlayer } from '../useAudioPlayer'

class MockAudioContext {
  currentTime = 10
  state: 'running' | 'suspended' | 'closed' = 'running'
  destination = { kind: 'destination' }

  createOscillator() {
    return {
      type: 'sine' as OscillatorType,
      frequency: {
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
    originZnIds: ['note-1'],
    activeTextRanges: [],
    activeNotes: [{ pitch: 60, durationMs: 1000, attack: true, pan: 'left' }],
    activeTime: '0',
    playbackStartMs: 0,
    durationMs: 1000,
    sourceTime: 0,
    flowIndex: 0,
    passIndex: 1,
  },
  {
    originZnIds: ['note-2'],
    activeTextRanges: [],
    activeNotes: [
      { pitch: 64, durationMs: 500, attack: true, pan: 'right' },
      { pitch: 60, durationMs: 250, attack: true, pan: 'left' },
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
    stereoPannerConnectMock.mockReset()
    createdPanners = []
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
    expect(leftScheduleMock).toHaveBeenCalledWith(10.05, [
      { time: 0, note: 60, duration: 1, gain: 0.9 },
      { time: 1, note: 60, duration: 0.25, gain: 0.6363961030678927 },
    ])
    expect(rightScheduleMock).toHaveBeenCalledTimes(1)
    expect(rightScheduleMock).toHaveBeenCalledWith(10.05, [
      { time: 1, note: 64, duration: 0.5, gain: 0.6363961030678927 },
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
    expect(oscillatorFrequencySetValueAtTimeMock).toHaveBeenCalledWith(261.6255653005986, 10.05)
  })
})
