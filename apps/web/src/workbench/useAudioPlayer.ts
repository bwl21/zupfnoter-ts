import type { PlaybackStep } from './playback'

export interface PlaybackScheduleCallbacks {
  onStepStart?: (step: PlaybackStep) => void
  onStepEnd?: (step: PlaybackStep) => void
}

type StereoSide = 'left' | 'right'

export type PlaybackInstrument = 'harp' | 'piano' | 'western-guitar' | 'oscillator'

const INSTRUMENT_CONFIG: Record<PlaybackInstrument, { instrument: string, soundfont: string }> = {
  harp: { instrument: 'orchestral_harp', soundfont: 'FluidR3_GM' },
  piano: { instrument: 'acoustic_grand_piano', soundfont: 'FluidR3_GM' },
  'western-guitar': { instrument: 'acoustic_guitar_steel', soundfont: 'FluidR3_GM' },
}

const INSTRUMENT_GAIN = 1
const MAX_CHORD_GAIN = 0.9
const OSCILLATOR_GAIN = 0.3
const OSCILLATOR_ATTACK_SEC = 0.01
const OSCILLATOR_RELEASE_SEC = 0.2
const SCHEDULE_LOOKAHEAD_SEC = 0.05
const MASTER_OUTPUT_GAIN = 6
const STEREO_PAN_BY_SIDE: Record<StereoSide, number> = {
  left: -0.9,
  right: 0.9,
}

function midiToFrequency(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12)
}

export function useAudioPlayer(instrument: { value: PlaybackInstrument }) {
  type SoundfontModule = typeof import('soundfont-player')
  type SoundfontPlayer = Awaited<ReturnType<SoundfontModule['instrument']>>
  type SoundfontPlayerSet = Record<StereoSide, SoundfontPlayer>

  let ctx: AudioContext | null = null
  let masterGainNode: GainNode | null = null
  let stereoPannerNodes: Record<StereoSide, StereoPannerNode> | null = null
  let playerPromise: Promise<SoundfontPlayerSet> | null = null
  let loadedInstrument: PlaybackInstrument | null = null
  let timers: ReturnType<typeof setTimeout>[] = []

  function getContext(): AudioContext {
    if (ctx === null || ctx.state === 'closed') {
      ctx = new AudioContext()
      masterGainNode = null
      stereoPannerNodes = null
    }
    return ctx
  }

  function getMasterGainNode(): GainNode {
    const context = getContext()
    if (masterGainNode === null) {
      const gainNode = context.createGain()
      gainNode.gain.value = MASTER_OUTPUT_GAIN
      gainNode.connect(context.destination)
      masterGainNode = gainNode
    }
    return masterGainNode
  }

  function getStereoPannerNodes(): Record<StereoSide, StereoPannerNode> {
    const context = getContext()
    if (stereoPannerNodes === null) {
      const masterGain = getMasterGainNode()
      stereoPannerNodes = {
        left: context.createStereoPanner(),
        right: context.createStereoPanner(),
      }
      for (const side of Object.keys(stereoPannerNodes) as StereoSide[]) {
        const panner = stereoPannerNodes[side]
        panner.pan.value = STEREO_PAN_BY_SIDE[side]
        panner.connect(masterGain)
      }
    }
    return stereoPannerNodes
  }

  function loadPlayer(): Promise<SoundfontPlayerSet> {
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
      const panners = getStereoPannerNodes()
      const playerEntries = await Promise.all((['left', 'right'] as StereoSide[]).map(async (side) => {
        const player = await Soundfont.instrument(
          context,
          config.instrument as Parameters<SoundfontModule['instrument']>[1],
          {
            destination: panners[side],
            soundfont: config.soundfont,
            gain: INSTRUMENT_GAIN,
          },
        )
        return [side, player] as const
      }))
      return Object.fromEntries(playerEntries) as SoundfontPlayerSet
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
    const eventsBySide: Record<StereoSide, Array<{ time: number; note: number; duration: number; gain: number }>> = {
      left: [],
      right: [],
    }

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
      const uniqueNotes = new Map<string, { pitch: number; duration: number; side: StereoSide }>()
      for (const note of step.activeNotes) {
        if (!note.attack) continue
        const noteKey = `${note.pitch}:${note.pan}`
        const nextDuration = note.durationMs / speedFactor / 1000
        const existing = uniqueNotes.get(noteKey)
        if (existing === undefined || nextDuration > existing.duration) {
          uniqueNotes.set(noteKey, {
            pitch: note.pitch,
            duration: nextDuration,
            side: note.pan,
          })
        }
      }
      const chordGain = uniqueNotes.size === 0
        ? MAX_CHORD_GAIN
        : Math.min(MAX_CHORD_GAIN, MAX_CHORD_GAIN / Math.sqrt(uniqueNotes.size))
      for (const { pitch, duration, side } of uniqueNotes.values()) {
        eventsBySide[side].push({
          time: stepOffsetMs / 1000,
          note: pitch,
          duration,
          gain: chordGain,
        })
      }
    }
    if (eventsBySide.left.length === 0 && eventsBySide.right.length === 0) return
    const context = await ensureRunningContext()
    const baseStartTime = context.currentTime + SCHEDULE_LOOKAHEAD_SEC
    if (instrument.value === 'oscillator') {
      const masterGain = getMasterGainNode()
      for (const side of ['left', 'right'] as StereoSide[]) {
        const events = eventsBySide[side]
        for (const event of events) {
        const gainNode = context.createGain()
        const oscillator = context.createOscillator()
        const panner = context.createStereoPanner()
        const startTime = baseStartTime + event.time
        const releaseSec = Math.min(OSCILLATOR_RELEASE_SEC, event.duration / 2)
        const stopTime = startTime + event.duration + releaseSec
        const peakGain = Math.min(OSCILLATOR_GAIN, event.gain * OSCILLATOR_GAIN)
        const sustainTime = Math.max(startTime + OSCILLATOR_ATTACK_SEC, startTime + event.duration)

        oscillator.type = 'triangle'
        panner.pan.value = STEREO_PAN_BY_SIDE[side]
        oscillator.frequency.setValueAtTime(midiToFrequency(event.note), startTime)
        gainNode.gain.setValueAtTime(0.0001, startTime)
        gainNode.gain.linearRampToValueAtTime(peakGain, startTime + OSCILLATOR_ATTACK_SEC)
        gainNode.gain.setValueAtTime(peakGain, sustainTime)
        gainNode.gain.linearRampToValueAtTime(0.0001, stopTime)
        oscillator.connect(gainNode)
        gainNode.connect(panner)
        panner.connect(masterGain)
        oscillator.start(startTime)
        oscillator.stop(stopTime)
      }
      }
      return
    }
    const players = await loadPlayer()
    for (const side of ['left', 'right'] as StereoSide[]) {
      const events = eventsBySide[side]
      if (events.length === 0) continue
      players[side].schedule(baseStartTime, events)
    }
  }

  function stop(): void {
    clearTimers()
    if (ctx !== null && ctx.state !== 'closed') {
      ctx.close()
      ctx = null
    }
    masterGainNode = null
    stereoPannerNodes = null
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
