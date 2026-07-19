import {
  decodePlaybackFragment,
  type PlaybackCompressionCodec,
  type PlaybackEvent,
  type PlaybackPosition,
  type PlaybackPositionMarker,
} from '@zupfnoter/playback'
import { mountPlayerUi, type PlayerUiController } from '@zupfnoter/player-ui'
import { deflateSync, inflateSync } from 'fflate'
import '@zupfnoter/player-ui/style.css'
import {
  findPositionMarker,
  nextPositionBoundaryMarker,
  parsePosition,
  positionAtTime,
  resolveRange,
} from './playerLogic'

const PLAYER_VERSION = '0.1.5'
const AUDIO_SCHEDULE_WINDOW_MS = 2000
const AUDIO_SCHEDULE_REFILL_MS = 500
const AUDIO_START_LEAD_MS = 200

const appElement = document.querySelector<HTMLDivElement>('#app')
if (appElement === null) throw new Error('Player root is missing')
const app = appElement

const browserPlaybackCodec: PlaybackCompressionCodec = {
  async compress(value) {
    return new Uint8Array(deflateSync(new Uint8Array(value)))
  },
  async decompress(value) {
    return new Uint8Array(inflateSync(new Uint8Array(value)))
  },
}

function renderError(message: string): void {
  app.innerHTML = `<section class="card error"><h1>Zupfnoter Player</h1><p>${message}</p></section>`
}

function eventLabel(event: PlaybackEvent | undefined): string {
  return event === undefined ? '—' : `${event.position.measureNumber}.${event.position.passIndex}`
}

function eventPosition(event: PlaybackEvent | undefined): { measureNumber: number; passIndex: number } {
  return event?.position ?? { measureNumber: 1, passIndex: 1 }
}

interface SoundfontPitch {
  note: number
  cents: number
}

interface WebkitAudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext
}

interface AudioSessionNavigator extends Navigator {
  audioSession?: {
    type: string
  }
}

function configurePlaybackAudioSession(): void {
  const audioSession = (navigator as AudioSessionNavigator).audioSession
  if (audioSession !== undefined) audioSession.type = 'playback'
}

function resolveSoundfontPitch(midi: number): SoundfontPitch {
  const naturalPitches = [0, 2, 4, 5, 7, 9, 11]
  const octave = Math.floor(midi / 12)
  const candidates = naturalPitches.map((pitchClass) => octave * 12 + pitchClass)
  const note = candidates.reduce((closest, candidate) => (
    Math.abs(candidate - midi) < Math.abs(closest - midi) ? candidate : closest
  ), candidates[0] ?? midi)
  return { note, cents: (midi - note) * 100 }
}

function midiToSoundfontNote(midi: number): string {
  const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  const pitch = resolveSoundfontPitch(midi)
  return `${names[[0, 2, 4, 5, 7, 9, 11].indexOf(pitch.note % 12)] ?? 'C'}${Math.floor(pitch.note / 12) - 1}`
}

function renderPlayer(events: PlaybackEvent[], positionMarkers: PlaybackPositionMarker[], identification?: string): void {
  const firstPosition = positionMarkers[0]?.position ?? eventPosition(events[0])
  const maximumMeasure = Math.max(1, ...positionMarkers.map((marker) => marker.position.measureNumber))
  const maximumPass = Math.max(1, ...positionMarkers.map((marker) => marker.position.passIndex))
  let selectedEvents = events
  let selectedStartMs = positionMarkers[0]?.timeMs ?? events[0]?.startMs ?? 0
  let selectedRangePosition = firstPosition

  function readRange(fromPosition: PlaybackPosition = firstPosition): [number, number] | undefined {
    const from = `${fromPosition.measureNumber}.${fromPosition.passIndex}`
    const range = resolveRange(events, positionMarkers, from)
    if (range === undefined) {
      ui.setRangeError('Der Bereich wurde im Playback nicht gefunden.')
      return undefined
    }
    ui.setRangeError('')
    selectedEvents = events.slice(range.range[0], range.range[1] + 1)
    selectedStartMs = range.startMs
    selectedRangePosition = fromPosition
    return range.range
  }
  let ui: PlayerUiController
  ui = mountPlayerUi({
    container: app,
    playerVersion: PLAYER_VERSION,
    identification,
    firstPosition,
    maximumMeasure,
    maximumPass,
    hasMetronomeData: positionMarkers.some((marker) => marker.meter !== undefined),
    callbacks: {
      onRangeChange: (position) => { readRange(position) },
      onReset: () => {
        stopPlayback()
        ui.setRangePosition(firstPosition)
        readRange(firstPosition)
        playbackOffsetMs = 0
        updatePosition(0)
      },
      onSpeedChange: (speed) => { setSpeed(speed) },
      onMetronomeChange: (enabled) => { handleMetronomeChange(enabled) },
      onPlay: () => { if (readRange(selectedRangePosition) !== undefined) void playPlayback() },
      onPause: pausePlayback,
      onStop: () => { stopPlayback() },
      onTakePosition: takePosition,
    },
  })
  let audioContext: AudioContext | undefined
  let playbackTimers: number[] = []
  let animationFrame: number | undefined
  let positionTimer: number | undefined
  let playbackOffsetMs = 0
  let playbackStartedAtContextTime = 0
  let isPaused = false
  let speedFactor = 1
  let metronomeEnabled = false
  let harpPlayerPromise: Promise<SoundfontPlayer> | undefined
  let metronomeOscillators: OscillatorNode[] = []
  let scheduledMetronomeTimes = new Set<number>()

  interface SoundfontPlayer {
    schedule(startTime: number, notes: readonly SoundfontNote[]): void
  }

  interface SoundfontNote {
    time: number
    note: number
    duration: number
    gain?: number
    cents?: number
  }

  function clearPlaybackTimers(): void {
    for (const timer of playbackTimers) window.clearTimeout(timer)
    playbackTimers = []
    if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame)
    animationFrame = undefined
    if (positionTimer !== undefined) window.clearTimeout(positionTimer)
    positionTimer = undefined
    for (const oscillator of metronomeOscillators) {
      try {
        oscillator.stop()
      } catch {
        // Already stopped oscillators need no further cleanup.
      }
    }
    metronomeOscillators = []
    scheduledMetronomeTimes = new Set<number>()
  }

  function updatePosition(elapsedMs: number): void {
    const absoluteTimeMs = selectedStartMs + elapsedMs
    const currentPosition = positionAtTime(positionMarkers, absoluteTimeMs)
    ui.setPosition(currentPosition)
    let markerIndex = -1
    for (const [index, marker] of positionMarkers.entries()) {
      if (marker.timeMs <= absoluteTimeMs && marker.meter !== undefined) markerIndex = index
    }
    const marker = markerIndex >= 0 ? positionMarkers[markerIndex] : undefined
    const nextMarker = markerIndex >= 0 ? nextPositionBoundaryMarker(positionMarkers, markerIndex) : undefined
    if (marker?.meter !== undefined) {
      const measureDuration = (nextMarker?.timeMs ?? selectedStartMs + 1000) - marker.timeMs
      const beatDuration = measureDuration / marker.meter.numerator
      const beat = beatDuration > 0 ? Math.min(marker.meter.numerator, Math.floor((absoluteTimeMs - marker.timeMs) / beatDuration) + 1) : 1
      ui.setMetronome(marker.meter, beat, metronomeEnabled)
    }
    ui.setPlaybackTime(elapsedMs)
  }

  function setLoading(loading: boolean): void {
    ui.setLoading(loading)
  }

  function setSpeed(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return
    speedFactor = value
  }

  function playMetronomeClick(context: AudioContext, accent: boolean, startTime: number): void {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = accent ? 1200 : 850
    gain.gain.setValueAtTime(accent ? 0.18 : 0.1, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.055)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(startTime)
    oscillator.stop(startTime + 0.06)
    metronomeOscillators.push(oscillator)
  }

  function scheduleMetronome(
    context: AudioContext,
    durationMs: number,
    audioStartAt: number,
    playbackOffsetMsForSchedule: number,
    windowStartMs = 0,
    windowEndMs = durationMs,
  ): void {
    if (!metronomeEnabled) return
    for (let markerIndex = 0; markerIndex < positionMarkers.length; markerIndex += 1) {
      const marker = positionMarkers[markerIndex]
      if (marker === undefined || marker.meter === undefined) continue
      const nextMarker = nextPositionBoundaryMarker(positionMarkers, markerIndex)
      const measureEnd = nextMarker?.timeMs ?? selectedStartMs + durationMs
      const measureDuration = measureEnd - marker.timeMs
      if (measureDuration <= 0 || marker.timeMs + measureDuration < selectedStartMs) continue
      const beatCount = marker.meter.numerator
      const beatDuration = measureDuration / beatCount
      const grouping = marker.meter.grouping ?? []
      const accentBeats = new Set<number>()
      let groupingOffset = 0
      for (const group of grouping) {
        accentBeats.add(groupingOffset)
        groupingOffset += group
      }
      for (let beat = 0; beat < beatCount; beat += 1) {
        const clickTime = marker.timeMs + beat * beatDuration
        if (clickTime < selectedStartMs || clickTime > selectedStartMs + durationMs) continue
        const relativeClickTime = clickTime - selectedStartMs
        if (relativeClickTime < windowStartMs || relativeClickTime >= windowEndMs) continue
        if (scheduledMetronomeTimes.has(clickTime)) continue
        const accent = beat === 0 || accentBeats.has(beat)
        const delaySec = (clickTime - selectedStartMs - playbackOffsetMsForSchedule) / 1000 / speedFactor
        if (delaySec < 0) continue
        playMetronomeClick(context, accent, audioStartAt + delaySec)
        scheduledMetronomeTimes.add(clickTime)
      }
    }
  }

  async function loadHarpPlayer(context: AudioContext, noteValues: readonly number[], destination: AudioNode): Promise<SoundfontPlayer> {
    if (harpPlayerPromise !== undefined) return harpPlayerPromise
    const loadPromise = import('soundfont-player').then((soundfont) => soundfont.instrument(
      context,
      'orchestral_harp',
      {
        soundfont: 'FluidR3_GM',
        format: 'mp3',
        gain: 1,
        destination,
        notes: [...new Set(noteValues.map(midiToSoundfontNote))],
      },
    ))
    const timeoutPromise = new Promise<SoundfontPlayer>((_, reject) => {
      window.setTimeout(() => reject(new Error('Harfenklang-Ladevorgang überschritten')), 15000)
    })
    harpPlayerPromise = Promise.race([loadPromise, timeoutPromise])
    try {
      return await harpPlayerPromise
    } catch (loadError) {
      harpPlayerPromise = undefined
      throw loadError
    }
  }

  function stopPlayback(reset = true): void {
    clearPlaybackTimers()
    if (audioContext !== undefined) void audioContext.close()
    audioContext = undefined
    harpPlayerPromise = undefined
    setLoading(false)
    isPaused = false
    if (reset) playbackOffsetMs = 0
    updatePosition(playbackOffsetMs)
  }

  async function playPlayback(): Promise<void> {
    if (selectedEvents.length === 0) return
    stopPlayback(false)
    configurePlaybackAudioSession()
    const base = selectedStartMs
    const durationMs = (selectedEvents[selectedEvents.length - 1]?.startMs ?? base) - base
      + (selectedEvents[selectedEvents.length - 1]?.durationMs ?? 0)
    if (playbackOffsetMs >= durationMs) playbackOffsetMs = 0
    const AudioContextClass = window.AudioContext
      ?? (window as WebkitAudioWindow).webkitAudioContext
    if (AudioContextClass === undefined) {
      ui.setRangeError('Dieser Browser unterstützt keine Audiowiedergabe.')
      return
    }
    audioContext = new AudioContextClass({ latencyHint: 'playback' })
    // iOS requires resume to start while the play button's gesture is active.
    void audioContext.resume().catch(() => undefined)
    const outputGain = audioContext.createGain()
    outputGain.gain.value = 2
    outputGain.connect(audioContext.destination)
    isPaused = false
    setLoading(true)
    const playerContext = audioContext
    let harpPlayer: SoundfontPlayer
    try {
      harpPlayer = await loadHarpPlayer(playerContext, selectedEvents.map((event) => event.pitch), outputGain)
      if (playerContext.state !== 'running') {
        await playerContext.resume()
      }
      if (playerContext.state !== 'running') {
        throw new Error(`AudioContext bleibt ${playerContext.state}`)
      }
    } catch {
      setLoading(false)
      ui.setRangeError('Der Harfenklang konnte nicht geladen werden.')
      stopPlayback()
      return
    }
    if (audioContext !== playerContext) return
    setLoading(false)
    const audioStartAt = playerContext.currentTime + AUDIO_START_LEAD_MS / 1000
    playbackStartedAtContextTime = audioStartAt - playbackOffsetMs / 1000 / speedFactor
    const elapsed = () => Math.max(0, (playerContext.currentTime - playbackStartedAtContextTime) * 1000 * speedFactor)
    const chordSizes = new Map<number, number>()
    for (const event of selectedEvents) {
      chordSizes.set(event.startMs, (chordSizes.get(event.startMs) ?? 0) + 1)
    }
    const scheduledNotes = selectedEvents.map((event) => {
      const eventOffset = event.startMs - base
      const skippedMs = Math.max(0, playbackOffsetMs - eventOffset)
      const chordGain = Math.min(0.9, 0.9 / Math.sqrt(chordSizes.get(event.startMs) ?? 1))
      return {
        eventOffset,
        eventDuration: event.durationMs,
        ...resolveSoundfontPitch(event.pitch),
        skippedMs,
        duration: Math.max(0.02, (event.durationMs - skippedMs) / 1000 / speedFactor),
        gain: (event.velocity ?? 127) / 127 * chordGain,
      }
    })
    let nextWindowStartMs = playbackOffsetMs
    const scheduleWindow = () => {
      if (audioContext !== playerContext || nextWindowStartMs >= durationMs) return
      const windowEndMs = Math.min(durationMs, nextWindowStartMs + AUDIO_SCHEDULE_WINDOW_MS)
      const windowAudioStart = audioStartAt
        + (nextWindowStartMs - playbackOffsetMs) / 1000 / speedFactor
      const windowNotes = scheduledNotes
        .filter((event) => event.eventOffset >= nextWindowStartMs && event.eventOffset < windowEndMs)
        .map((event) => ({
          note: event.note,
          cents: event.cents,
          time: (event.eventOffset - nextWindowStartMs) / 1000 / speedFactor,
          duration: Math.max(0.02, (event.eventDuration - (event.eventOffset < playbackOffsetMs ? event.skippedMs : 0)) / 1000 / speedFactor),
          gain: event.gain,
        }))
      if (windowNotes.length > 0) harpPlayer.schedule(windowAudioStart, windowNotes)
      scheduleMetronome(
        playerContext,
        durationMs,
        audioStartAt,
        playbackOffsetMs,
        nextWindowStartMs,
        windowEndMs,
      )
      nextWindowStartMs = windowEndMs
      if (nextWindowStartMs < durationMs) {
        const timer = window.setTimeout(scheduleWindow, AUDIO_SCHEDULE_REFILL_MS)
        playbackTimers.push(timer)
      }
    }
    scheduleWindow()
    const update = () => {
      if (audioContext !== playerContext) return
      const elapsedMs = elapsed()
      if (elapsedMs >= durationMs) {
        updatePosition(durationMs)
        stopPlayback()
        return
      }
      updatePosition(elapsedMs)
      positionTimer = window.setTimeout(update, 25)
    }
    update()
  }

  function pausePlayback(): void {
    if (audioContext === undefined) return
    if (audioContext !== undefined) {
      playbackOffsetMs = Math.max(0, (audioContext.currentTime - playbackStartedAtContextTime) * 1000 * speedFactor)
    }
    stopPlayback(false)
    isPaused = true
  }

  function handleMetronomeChange(enabled: boolean): void {
    metronomeEnabled = enabled
    updatePosition(playbackOffsetMs)
    if (!enabled || audioContext === undefined) return
    const elapsedMs = Math.max(0, (audioContext.currentTime - playbackStartedAtContextTime) * 1000 * speedFactor)
    const durationMs = (selectedEvents[selectedEvents.length - 1]?.startMs ?? selectedStartMs) - selectedStartMs
      + (selectedEvents[selectedEvents.length - 1]?.durationMs ?? 0)
    scheduleMetronome(
      audioContext,
      durationMs,
      audioContext.currentTime + 0.05,
      elapsedMs,
      elapsedMs,
      Math.min(durationMs, elapsedMs + AUDIO_SCHEDULE_WINDOW_MS),
    )
  }

  function takePosition(): void {
    const currentPosition = positionAtTime(positionMarkers, selectedStartMs + playbackOffsetMs)
    const previousMeasure = Math.max(1, currentPosition.measureNumber - 1)
    const targetMarker = findPositionMarker(positionMarkers, {
      measureNumber: previousMeasure,
      passIndex: currentPosition.passIndex,
    }) ?? positionMarkers[0]
    if (targetMarker === undefined) return
    stopPlayback()
    ui.setRangePosition(targetMarker.position)
    readRange(targetMarker.position)
    updatePosition(0)
  }
}

async function main(): Promise<void> {
  const pageUrl = new URL(window.location.href)
  const value = pageUrl.hash.match(/^#p=(.+)$/)?.[1]
  const identification = pageUrl.searchParams.get('id') ?? undefined
  if (value === undefined) {
    renderError('Kein Playback-Link gefunden.')
    return
  }
  try {
    const decoded = await decodePlaybackFragment(value, browserPlaybackCodec)
    renderPlayer(decoded.events, decoded.positionMarkers, identification)
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error))
  }
}

void main()
