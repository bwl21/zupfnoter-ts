import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAudioSession, AudioSessionCancelledError } from '@zupfnoter/playback-audio/session'

const instrument = vi.hoisted(() => vi.fn())
vi.mock('soundfont-player', () => ({ instrument }))

class Context {
  state: 'running' | 'suspended' | 'closed' = 'suspended'
  currentTime = 0
  resume = vi.fn(async () => { this.state = 'running' })
  suspend = vi.fn(async () => { this.state = 'suspended' })
  close = vi.fn(async () => { this.state = 'closed' })
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('shared audio session', () => {
  it('resumes synchronously in the gesture and owns pause/resume/close', async () => {
    vi.stubGlobal('AudioContext', Context)
    const session = createAudioSession()
    const pending = session.ensureRunning()
    expect(session.getContext().state).toBe('running')
    await pending
    session.suspend()
    expect(session.getContext().state).toBe('suspended')
    session.resume()
    const previous = session.getContext()
    session.stop()
    expect(previous.state).toBe('closed')
    expect(session.getContext()).not.toBe(previous)
    session.stop()
  })

  it('cancels loading without reviving a stopped context', async () => {
    vi.stubGlobal('AudioContext', Context)
    instrument.mockImplementation(() => new Promise(() => undefined))
    const session = createAudioSession()
    const previous = session.getContext()
    const loading = session.loadInstrument('harp', 'orchestral_harp', {})
    session.stop()
    await expect(loading).rejects.toBeInstanceOf(AudioSessionCancelledError)
    expect(previous.state).toBe('closed')
    expect(instrument).not.toHaveBeenCalled()
  })

  it('retries a failed sample load', async () => {
    vi.stubGlobal('AudioContext', Context)
    instrument.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ schedule: vi.fn() })
    const session = createAudioSession()
    await expect(session.loadInstrument('harp', 'orchestral_harp', {})).rejects.toThrow('offline')
    await expect(session.loadInstrument('harp', 'orchestral_harp', {})).resolves.toHaveProperty('schedule')
    session.stop()
  })

  it('uses one full window for prepared Web events', () => {
    const session = createAudioSession()
    const onWindow = vi.fn()
    session.scheduleWindows({ durationMs: 2000, elapsedMs: () => 0, onWindow })
    expect(onWindow.mock.calls).toEqual([[0, 2000, true]])
    session.stop()
  })

  it('uses audio time for mobile refill and cancels all future windows', () => {
    vi.useFakeTimers()
    const session = createAudioSession()
    const onWindow = vi.fn()
    let elapsed = 1000
    session.scheduleWindows({ durationMs: 6000, startOffsetMs: 1000,
      elapsedMs: () => elapsed, windowMs: 750, lookaheadMs: 2500, refillMs: 150, onWindow })
    expect(onWindow.mock.calls).toEqual([[1000, 1750, true]])
    elapsed = 1900
    vi.advanceTimersByTime(150)
    expect(onWindow.mock.calls[1]).toEqual([1900, 2650, false])
    session.stop()
    vi.advanceTimersByTime(1000)
    expect(onWindow).toHaveBeenCalledTimes(2)
  })
})
