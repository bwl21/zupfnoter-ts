import type { PlaybackStep } from './playback'
import { buildPlaybackExportDataFromTimeline } from '@zupfnoter/core'
import {
  createPlaybackCountInPlan,
  createPlaybackMetronomeClicks,
  resolvePlaybackMetronomeEventSound,
  schedulePlaybackMetronomeClick,
  type PlaybackMetronomeConfig,
  type PlaybackMetronomeClick,
  type PlaybackMetronomeSoundKind,
  type PlaybackPositionMarker,
} from '@zupfnoter/playback'

export interface PlaybackScheduleCallbacks {
  onStepStart?: (step: PlaybackStep) => void
  onStepEnd?: (step: PlaybackStep) => void
  onMetronomeBeat?: (beat: PlaybackMetronomeVisualBeat) => void
}

export interface PlaybackMetronomeVisualBeat {
  /** One-based main beat within the measure. */
  beat: number
  /** Number of displayed main beats per measure. */
  division: number
  /** True when this beat starts the measure. */
  accent: boolean
}

type StereoSide = 'left' | 'right'

export type PlaybackInstrument = 'harp' | 'piano' | 'western-guitar' | 'oscillator'

type SoundfontPlaybackInstrument = Exclude<PlaybackInstrument, 'oscillator'>

const INSTRUMENT_CONFIG: Record<SoundfontPlaybackInstrument, { instrument: string, soundfont: string }> = {
  harp: { instrument: 'orchestral_harp', soundfont: 'FluidR3_GM' },
  piano: { instrument: 'acoustic_grand_piano', soundfont: 'FluidR3_GM' },
  'western-guitar': { instrument: 'acoustic_guitar_steel', soundfont: 'FluidR3_GM' },
}

const INSTRUMENT_GAIN = 1
const MAX_CHORD_GAIN = 0.9
const OSCILLATOR_GAIN = 0.3
const OSCILLATOR_ATTACK_SEC = 0.01
const OSCILLATOR_RELEASE_SEC = 0.2
const SCHEDULE_LOOKAHEAD_SEC = 0.2
const MASTER_OUTPUT_GAIN = 2
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
  let playbackFrame: number | undefined
  let playbackFallbackTimer: ReturnType<typeof setTimeout> | undefined

  function getContext(): AudioContext {
    if (ctx === null || ctx.state === 'closed') {
      ctx = new AudioContext({ latencyHint: 'playback' })
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
    if (instrument.value === 'oscillator') {
      throw new Error('loadPlayer() is unavailable for oscillator playback')
    }
    const currentInstrument = instrument.value
    loadedInstrument = currentInstrument
    playerPromise = import('soundfont-player').then(async (Soundfont) => {
      const context = getContext()
      if (context.state === 'suspended') {
        await context.resume()
      }
      const config = INSTRUMENT_CONFIG[currentInstrument]
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
    if (playbackFrame !== undefined && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(playbackFrame)
      playbackFrame = undefined
    }
    if (playbackFallbackTimer !== undefined) {
      clearTimeout(playbackFallbackTimer)
      playbackFallbackTimer = undefined
    }
  }

  function scheduleVisualCallbacks(
    steps: PlaybackStep[],
    metronomeClicks: readonly PlaybackMetronomeClick[],
    speedFactor: number,
    callbacks: PlaybackScheduleCallbacks,
    context: AudioContext,
    baseStartTime: number,
  ): void {
    if (callbacks.onStepStart === undefined
      && callbacks.onStepEnd === undefined
      && callbacks.onMetronomeBeat === undefined) return
    let nextStepIndex = 0
    let activeStep: PlaybackStep | undefined
    let nextMetronomeClickIndex = 0

    const tick = (): void => {
      playbackFrame = undefined
      playbackFallbackTimer = undefined
      const elapsedMs = (context.currentTime - baseStartTime) * 1000 * speedFactor

      let nextMetronomeClick = metronomeClicks[nextMetronomeClickIndex]
      while (nextMetronomeClick !== undefined && elapsedMs >= nextMetronomeClick.timeMs) {
        if (nextMetronomeClick.subdivision === 0) {
          callbacks.onMetronomeBeat?.({
            beat: nextMetronomeClick.beat,
            division: nextMetronomeClick.division,
            accent: nextMetronomeClick.accent,
          })
        }
        nextMetronomeClickIndex += 1
        nextMetronomeClick = metronomeClicks[nextMetronomeClickIndex]
      }

      if (activeStep !== undefined && elapsedMs >= activeStep.playbackStartMs + activeStep.durationMs) {
        callbacks.onStepEnd?.(activeStep)
        activeStep = undefined
      }

      const nextStep = steps[nextStepIndex]
      if (activeStep === undefined && nextStep !== undefined && elapsedMs >= nextStep.playbackStartMs) {
        callbacks.onStepStart?.(nextStep)
        activeStep = nextStep
        nextStepIndex += 1
        if (nextStep.durationMs <= 0) {
          callbacks.onStepEnd?.(nextStep)
          activeStep = undefined
        }
      }

      if (nextStepIndex >= steps.length
        && activeStep === undefined
        && nextMetronomeClickIndex >= metronomeClicks.length) return
      if (typeof requestAnimationFrame === 'function') {
        playbackFrame = requestAnimationFrame(tick)
      } else {
        playbackFallbackTimer = setTimeout(tick, 16)
      }
    }

    if (typeof requestAnimationFrame === 'function') {
      playbackFrame = requestAnimationFrame(tick)
    } else {
      playbackFallbackTimer = setTimeout(tick, 16)
    }
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
    metronomeConfig?: PlaybackMetronomeConfig,
  ): Promise<void> {
    const eventsBySide: Record<StereoSide, Array<{ time: number; note: number; duration: number; gain: number }>> = {
      left: [],
      right: [],
    }

    clearTimers()
    for (const step of steps) {
      const stepOffsetMs = step.playbackStartMs / speedFactor
      const uniqueNotes = new Map<string, { pitch: number; duration: number; side: StereoSide }>()
      for (const note of step.activeNotes) {
        if (!note.attack) continue
        const noteKey = `${note.originPlaybackId}:${note.pitch}:${note.pan}`
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
    const hasAudioEvents = eventsBySide.left.length > 0 || eventsBySide.right.length > 0
    if (!hasAudioEvents && callbacks.onStepStart === undefined && callbacks.onStepEnd === undefined) return
    const context = await ensureRunningContext()
    // Use the same complete position track as export/player. In particular,
    // the unmetered opening marker carries the phase of an opening pickup.
    const markers: PlaybackPositionMarker[] = buildPlaybackExportDataFromTimeline(steps).positionMarkers
    const configuredDivision = metronomeConfig?.division === undefined
      ? undefined
      : Math.max(1, metronomeConfig.division)
    const subdivision = Math.max(1, metronomeConfig?.subdivision ?? 1)
    const minLeadIn = Math.max(1, metronomeConfig?.minLeadIn ?? 4)
    const timelineStartMs = steps[0]?.playbackStartMs ?? 0
    const entryTimeMs = steps.find((step) => step.activeNotes.some((note) => note.attack))?.playbackStartMs
      ?? timelineStartMs
    const entryOffsetMs = Math.max(0, entryTimeMs - timelineStartMs)
    const countInPlan = metronomeConfig !== undefined
      && (metronomeConfig.mode === 'countIn' || metronomeConfig.mode === 'always')
      ? createPlaybackCountInPlan(markers, entryTimeMs, {
        minLeadIn,
        bandPreCount: metronomeConfig.bandPreCount,
        division: configuredDivision,
        subdivision,
      })
      : undefined
    const countInDurationMs = countInPlan?.durationMs ?? 0
    const lastStep = steps[steps.length - 1]
    const playbackDurationMs = lastStep === undefined
      ? 0
      : lastStep.playbackStartMs + lastStep.durationMs
    const playbackClicks = metronomeConfig !== undefined
      && (metronomeConfig.mode === 'playback' || metronomeConfig.mode === 'always')
      ? createPlaybackMetronomeClicks(markers, playbackDurationMs, configuredDivision, subdivision)
        .filter((click) => countInPlan === undefined || click.timeMs >= entryTimeMs)
      : []
    const countInDivision = Math.max(1, configuredDivision ?? countInPlan?.meter.numerator ?? 4)
    const visualMetronomeClicks: PlaybackMetronomeClick[] = [
      ...(countInPlan?.events.map((event) => ({
        timeMs: entryOffsetMs + event.offsetMs - countInDurationMs,
        accent: event.kind === 'BAR_START',
        kind: event.kind === 'PRE_COUNT' ? 'MAIN_BEAT' as const : event.kind,
        beat: event.beat + 1,
        division: countInDivision,
        subdivision: event.kind === 'SUBDIVISION' ? 1 : 0,
        isLastBeforeEntry: event.isLastBeforeEntry,
      })) ?? []),
      ...playbackClicks,
    ]
    function scheduleMetronomeClicks(baseStartTime: number): void {
      if (metronomeConfig === undefined || metronomeConfig.mode === 'off') return
      if (countInPlan !== undefined) {
        const countInStart = baseStartTime + (entryOffsetMs - countInDurationMs) / speedFactor / 1000
        for (const event of countInPlan.events) {
          const clickAt = countInStart + event.offsetMs / speedFactor / 1000
          const sound = resolvePlaybackMetronomeEventSound(event.kind, event.isLastBeforeEntry)
          schedulePlaybackMetronomeClick(context, clickAt, sound)
        }
      }
      if (metronomeConfig.mode === 'countIn') return
      for (const clickEvent of playbackClicks) {
        const relativeMs = clickEvent.timeMs
        const scheduleStart = baseStartTime + relativeMs / speedFactor / 1000
        if (scheduleStart >= context.currentTime) {
          schedulePlaybackMetronomeClick(context, scheduleStart, resolvePlaybackMetronomeEventSound(clickEvent.kind))
        }
      }
    }
    const preRollDurationMs = Math.max(0, countInDurationMs - entryOffsetMs)
    if (instrument.value === 'oscillator') {
      const baseStartTime = context.currentTime + SCHEDULE_LOOKAHEAD_SEC + preRollDurationMs / speedFactor / 1000
      scheduleVisualCallbacks(steps, visualMetronomeClicks, speedFactor, callbacks, context, baseStartTime)
      scheduleMetronomeClicks(baseStartTime)
      if (!hasAudioEvents) return
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
    if (!hasAudioEvents) {
      const baseStartTime = context.currentTime + SCHEDULE_LOOKAHEAD_SEC + preRollDurationMs / speedFactor / 1000
      scheduleVisualCallbacks(steps, visualMetronomeClicks, speedFactor, callbacks, context, baseStartTime)
      scheduleMetronomeClicks(baseStartTime)
      return
    }
    const players = await loadPlayer()
    const baseStartTime = context.currentTime + SCHEDULE_LOOKAHEAD_SEC + preRollDurationMs / speedFactor / 1000
    scheduleVisualCallbacks(steps, visualMetronomeClicks, speedFactor, callbacks, context, baseStartTime)
    scheduleMetronomeClicks(baseStartTime)
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
