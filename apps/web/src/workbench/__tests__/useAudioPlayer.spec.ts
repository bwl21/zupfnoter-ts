import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PlaybackStep } from '../playback'

const scheduleMock = vi.fn<(when: number, events: Array<{ time: number; note: number; duration: number; gain: number }>) => void>()
const instrumentMock = vi.fn(async () => ({
  schedule: scheduleMock,
}))

const oscillatorStartMock = vi.fn<(when?: number) => void>()
const oscillatorStopMock = vi.fn<(when?: number) => void>()
const oscillatorConnectMock = vi.fn<(target: unknown) => void>()
const oscillatorFrequencySetValueAtTimeMock = vi.fn<(value: number, when: number) => void>()
const gainConnectMock = vi.fn<(target: unknown) => void>()
const gainSetValueAtTimeMock = vi.fn<(value: number, when: number) => void>()
const gainLinearRampToValueAtTimeMock = vi.fn<(value: number, when: number) => void>()

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
        setValueAtTime: gainSetValueAtTimeMock,
        linearRampToValueAtTime: gainLinearRampToValueAtTimeMock,
      },
      connect: gainConnectMock,
    }
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
    activeNotes: [{ pitch: 60, durationMs: 1000, attack: true }],
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
      { pitch: 64, durationMs: 500, attack: true },
      { pitch: 60, durationMs: 250, attack: true },
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
    scheduleMock.mockReset()
    instrumentMock.mockClear()
    oscillatorStartMock.mockReset()
    oscillatorStopMock.mockReset()
    oscillatorConnectMock.mockReset()
    oscillatorFrequencySetValueAtTimeMock.mockReset()
    gainConnectMock.mockReset()
    gainSetValueAtTimeMock.mockReset()
    gainLinearRampToValueAtTimeMock.mockReset()
    Object.defineProperty(globalThis, 'AudioContext', {
      value: MockAudioContext,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('schedules relative note times and merges duplicate pitches per step', async () => {
    const player = useAudioPlayer({ value: 'harp' })

    await player.schedule(steps, 1)

    expect(instrumentMock).toHaveBeenCalledTimes(1)
    expect(instrumentMock).toHaveBeenCalledWith(
      expect.any(MockAudioContext),
      'orchestral_harp',
      expect.objectContaining({
        destination: expect.objectContaining({
          connect: gainConnectMock,
        }),
        gain: 1,
        soundfont: 'FluidR3_GM',
      }),
    )
    expect(scheduleMock).toHaveBeenCalledTimes(1)
    expect(scheduleMock).toHaveBeenCalledWith(10.05, [
      { time: 0, note: 60, duration: 1, gain: 0.9 },
      { time: 1, note: 64, duration: 0.5, gain: 0.6363961030678927 },
      { time: 1, note: 60, duration: 0.25, gain: 0.6363961030678927 },
    ])
  })

  it('plays oscillator mode without loading soundfont samples', async () => {
    const player = useAudioPlayer({ value: 'oscillator' })

    await player.schedule(steps, 1)

    expect(instrumentMock).not.toHaveBeenCalled()
    expect(scheduleMock).not.toHaveBeenCalled()
    expect(oscillatorStartMock).toHaveBeenCalledTimes(3)
    expect(oscillatorStopMock).toHaveBeenCalledTimes(3)
    expect(gainConnectMock).toHaveBeenCalled()
    expect(oscillatorFrequencySetValueAtTimeMock).toHaveBeenCalledWith(261.6255653005986, 10.05)
  })
})
