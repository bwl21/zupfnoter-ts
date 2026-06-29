import type { PlaybackStep } from './playback'

export interface PlaybackScheduleCallbacks {
  onStepStart?: (step: PlaybackStep) => void
  onStepEnd?: (step: PlaybackStep) => void
}

export type PlaybackInstrument = 'harp' | 'piano' | 'western-guitar' | 'oscillator'

const INSTRUMENT_CONFIG: Record<PlaybackInstrument, { instrument: string, soundfont: string }> = {
  harp: { instrument: 'orchestral_harp', soundfont: 'FluidR3_GM' },
  piano: { instrument: 'acoustic_grand_piano', soundfont: 'FluidR3_GM' },
  'western-guitar': { instrument: 'acoustic_guitar_steel', soundfont: 'FluidR3_GM' },
}

const INSTRUMENT_GAIN = 0.7
const MAX_CHORD_GAIN = 0.9
const OSCILLATOR_GAIN = 0.12
const OSCILLATOR_ATTACK_SEC = 0.01
const OSCILLATOR_RELEASE_SEC = 0.08
const SCHEDULE_LOOKAHEAD_SEC = 0.05

function midiToFrequency(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12)
}

export function useAudioPlayer(instrument: { value: PlaybackInstrument }) {
  type SoundfontModule = typeof import('soundfont-player')
  type SoundfontPlayer = Awaited<ReturnType<SoundfontModule['instrument']>>

  let ctx: AudioContext | null = null
  let playerPromise: Promise<SoundfontPlayer> | null = null
  let loadedInstrument: PlaybackInstrument | null = null
  let timers: ReturnType<typeof setTimeout>[] = []

  function getContext(): AudioContext {
    if (ctx === null || ctx.state === 'closed') {
      ctx = new AudioContext()
    }
    return ctx
  }

  function loadPlayer(): Promise<SoundfontPlayer> {
    if (loadedInstrument !== instrument.value) {
      playerPromise = null
    }
    if (playerPromise !== null) return playerPromise
    loadedInstrument = instrument.value
    playerPromise = import('soundfont-player').then(async (Soundfont) => {
      const context = getContext()
      if (context.state === 'suspended') {
        await context.resume()
      }
      const config = INSTRUMENT_CONFIG[instrument.value]
      return Soundfont.instrument(context, config.instrument as Parameters<SoundfontModule['instrument']>[1], {
        soundfont: config.soundfont,
        gain: INSTRUMENT_GAIN,
      })
    })
    return playerPromise
  }

  function clearTimers(): void {
    for (const timer of timers) {
      clearTimeout(timer)
    }
    timers = []
  }

  async function ensureRunningContext(): Promise<AudioContext> {
    const context = getContext()
    if (context.state === 'suspended') {
      await context.resume()
    }
    return context
  }

  async function schedule(
    steps: PlaybackStep[],
    speedFactor: number,
    callbacks: PlaybackScheduleCallbacks = {},
  ): Promise<void> {
    const events: Array<{ time: number; note: number; duration: number; gain: number }> = []

    clearTimers()
    for (const step of steps) {
      const stepOffsetMs = step.playbackStartMs / speedFactor
      if (callbacks.onStepStart !== undefined) {
        timers.push(setTimeout(() => {
          callbacks.onStepStart?.(step)
        }, stepOffsetMs))
      }
      if (callbacks.onStepEnd !== undefined) {
        timers.push(setTimeout(() => {
          callbacks.onStepEnd?.(step)
        }, stepOffsetMs + (step.durationMs / speedFactor)))
      }
      const uniqueNotes = new Map<number, number>()
      for (const note of step.activeNotes) {
        if (!note.attack) continue
        const existingDuration = uniqueNotes.get(note.pitch) ?? 0
        uniqueNotes.set(note.pitch, Math.max(existingDuration, note.durationMs / speedFactor / 1000))
      }
      const chordGain = uniqueNotes.size === 0
        ? MAX_CHORD_GAIN
        : Math.min(MAX_CHORD_GAIN, MAX_CHORD_GAIN / Math.sqrt(uniqueNotes.size))
      for (const [pitch, duration] of uniqueNotes.entries()) {
        events.push({
          time: stepOffsetMs / 1000,
          note: pitch,
          duration,
          gain: chordGain,
        })
      }
    }
    if (events.length === 0) return
    const context = await ensureRunningContext()
    const baseStartTime = context.currentTime + SCHEDULE_LOOKAHEAD_SEC
    if (instrument.value === 'oscillator') {
      for (const event of events) {
        const gainNode = context.createGain()
        const oscillator = context.createOscillator()
        const startTime = baseStartTime + event.time
        const releaseSec = Math.min(OSCILLATOR_RELEASE_SEC, event.duration / 2)
        const stopTime = startTime + event.duration + releaseSec
        const peakGain = Math.min(OSCILLATOR_GAIN, event.gain * OSCILLATOR_GAIN)
        const sustainTime = Math.max(startTime + OSCILLATOR_ATTACK_SEC, startTime + event.duration)

        oscillator.type = 'triangle'
        oscillator.frequency.setValueAtTime(midiToFrequency(event.note), startTime)
        gainNode.gain.setValueAtTime(0.0001, startTime)
        gainNode.gain.linearRampToValueAtTime(peakGain, startTime + OSCILLATOR_ATTACK_SEC)
        gainNode.gain.setValueAtTime(peakGain, sustainTime)
        gainNode.gain.linearRampToValueAtTime(0.0001, stopTime)
        oscillator.connect(gainNode)
        gainNode.connect(context.destination)
        oscillator.start(startTime)
        oscillator.stop(stopTime)
      }
      return
    }
    const player = await loadPlayer()
    player.schedule(baseStartTime, events)
  }

  function stop(): void {
    clearTimers()
    if (ctx !== null && ctx.state !== 'closed') {
      ctx.close()
      ctx = null
    }
    playerPromise = null
    loadedInstrument = null
  }

  function suspend(): void {
    if (ctx !== null && ctx.state === 'running') {
      ctx.suspend()
    }
  }

  function resume(): void {
    if (ctx !== null && ctx.state === 'suspended') {
      ctx.resume()
    }
  }

  return { schedule, stop, suspend, resume }
}

export type AudioPlayer = ReturnType<typeof useAudioPlayer>
