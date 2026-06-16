import type { PlaybackStep } from './playback'

export interface PlaybackScheduleCallbacks {
  onStepStart?: (step: PlaybackStep) => void
  onStepEnd?: (step: PlaybackStep) => void
}

export type PlaybackInstrument = 'harp' | 'piano' | 'western-guitar' | 'oscillator'

const INSTRUMENT_CONFIG: Record<'harp' | 'piano' | 'western-guitar', { instrument: string, soundfont: string, gain: number, attack: number, decay: number, sustain: number, release: number }> = {
  harp: { instrument: 'orchestral_harp', soundfont: 'FluidR3_GM', gain: 1.1, attack: 0.01, decay: 0.18, sustain: 0.55, release: 0.18 },
  piano: { instrument: 'acoustic_grand_piano', soundfont: 'FluidR3_GM', gain: 0.85, attack: 0.004, decay: 0.1, sustain: 0.55, release: 0.08 },
  'western-guitar': { instrument: 'acoustic_guitar_steel', soundfont: 'FluidR3_GM', gain: 1.3, attack: 0.008, decay: 0.15, sustain: 0.5, release: 0.1 },
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

function midiPitchToNoteName(pitch: number): string {
  const octave = Math.trunc(pitch / 12) - 1
  const noteName = NOTE_NAMES[((pitch % 12) + 12) % 12]
  return `${noteName}${octave}`
}

function isSoundfontInstrument(value: PlaybackInstrument): value is 'harp' | 'piano' | 'western-guitar' {
  return value !== 'oscillator'
}

function playTriangleHarpNote(
  pitch: number,
  startTime: number,
  durationSec: number,
  context: AudioContext,
): OscillatorNode {
  const frequency = 440 * (2 ** ((pitch - 69) / 12))
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const attackSec = 0.008
  const noteDurationSec = Math.max(durationSec, 0.05)
  const releaseSec = noteDurationSec * 0.9
  const endTime = startTime + noteDurationSec

  oscillator.type = 'triangle'
  oscillator.frequency.value = frequency

  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(0.25, startTime + attackSec)
  gain.gain.setValueAtTime(0.25, startTime + releaseSec)
  gain.gain.exponentialRampToValueAtTime(0.001, endTime)

  oscillator.connect(gain)
  gain.connect(context.destination)

  oscillator.start(startTime)
  oscillator.stop(endTime + 0.02)
  return oscillator
}

export function useAudioPlayer(instrument: { value: PlaybackInstrument }) {
  type SoundfontModule = typeof import('soundfont-player')
  type SoundfontPlayer = Awaited<ReturnType<SoundfontModule['instrument']>>

  let ctx: AudioContext | null = null
  let playerPromise: Promise<SoundfontPlayer> | null = null
  let loadedInstrument: PlaybackInstrument | null = null
  let timers: ReturnType<typeof setTimeout>[] = []
  let activeNotes: SoundfontPlayer[] = []

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
    if (instrument.value === 'oscillator') {
      loadedInstrument = 'oscillator'
      playerPromise = Promise.resolve({
        play: (note: string, when?: number, options?: { duration?: number }) => {
          const context = getContext()
          const startAt = when ?? context.currentTime
          const duration = options?.duration ?? 0.5
          const oscillator = context.createOscillator()
          const gainNode = context.createGain()
          oscillator.type = 'sine'
          oscillator.frequency.value = noteNameToFrequency(note)
          gainNode.gain.setValueAtTime(0.00001, startAt)
          gainNode.gain.linearRampToValueAtTime(0.9, startAt + 0.02)
          gainNode.gain.exponentialRampToValueAtTime(0.00001, startAt + duration)
          oscillator.connect(gainNode)
          gainNode.connect(context.destination)
          oscillator.start(startAt)
          oscillator.stop(startAt + duration + 0.05)
          return {
            stop: (stopAt?: number) => {
              oscillator.stop(stopAt ?? context.currentTime)
            },
          } as SoundfontPlayer
        },
      } as SoundfontPlayer)
      return playerPromise
    }
    const config = INSTRUMENT_CONFIG[instrument.value]
    if (playerPromise !== null) return playerPromise
    loadedInstrument = instrument.value
    playerPromise = import('soundfont-player').then(async (module) => {
      const Soundfont = module.default ?? module
      const context = getContext()
      if (context.state === 'suspended') {
        await context.resume()
      }
      if (typeof Soundfont.instrument !== 'function') {
        throw new Error('soundfont-player instrument API unavailable')
      }
      return Soundfont.instrument(context, config.instrument as Parameters<SoundfontModule['instrument']>[1], {
        soundfont: config.soundfont,
        gain: config.gain,
        attack: config.attack,
        release: config.release,
      })
    })
    return playerPromise
  }

  function noteNameToFrequency(note: string): number {
    const match = /^([A-G])(#?)(-?\d+)$/.exec(note)
    if (match === null || match.length < 4) return 440
    const [, letterRaw, sharp, octaveText] = match as unknown as [string, string, string, string]
    const letter = letterRaw as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
    const semitoneBase: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G', number> = {
      C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
    }
    const octave = Number.parseInt(octaveText, 10)
    const semitone = semitoneBase[letter] + (sharp === '#' ? 1 : 0)
    const midi = (octave + 1) * 12 + semitone
    return 440 * (2 ** ((midi - 69) / 12))
  }

  function clearTimers(): void {
    for (const timer of timers) {
      clearTimeout(timer)
    }
    timers = []
  }

  function clearActiveNotes(): void {
    activeNotes = []
  }

  async function schedule(
    steps: PlaybackStep[],
    speedFactor: number,
    callbacks: PlaybackScheduleCallbacks = {},
  ): Promise<void> {
    const player = await loadPlayer()
    const context = getContext()
    const config = isSoundfontInstrument(instrument.value)
      ? INSTRUMENT_CONFIG[instrument.value]
      : undefined

    clearTimers()
    clearActiveNotes()
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
      for (const note of step.activeNotes) {
        if (!note.attack) continue
        const startTime = context.currentTime + (stepOffsetMs / 1000)
        const duration = note.durationMs / speedFactor / 1000
        if (config !== undefined) {
          const node = player.play(midiPitchToNoteName(note.pitch), startTime, {
            duration,
            gain: config.gain,
            attack: config.attack,
            decay: config.decay,
            sustain: config.sustain,
            release: config.release,
          })
          if (node !== undefined) {
            activeNotes.push(node)
          }
        } else {
          const oscillator = playTriangleHarpNote(note.pitch, startTime, duration, context)
          activeNotes.push({
            stop: (stopAt?: number) => {
              oscillator.stop(stopAt ?? context.currentTime)
            },
          } as SoundfontPlayer)
        }
      }
    }
    console.debug('audio-schedule', JSON.stringify({
      contextState: context.state,
      steps: steps.length,
      events: activeNotes.length,
      speedFactor,
      instrument: instrument.value,
    }))
    if (activeNotes.length === 0) return
  }

  function stop(): void {
    clearTimers()
    clearActiveNotes()
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
