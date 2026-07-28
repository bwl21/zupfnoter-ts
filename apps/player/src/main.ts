import {
  decodePlaybackFragment,
  type PlaybackCompressionCodec,
  type PlaybackEvent,
  type PlaybackPosition,
  type PlaybackPositionMarker,
} from '@zupfnoter/playback'
import { mountPlayerUi, type PlayerUiController } from '@zupfnoter/player-ui'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { DecodeHintType } from '@zxing/library'
import { deflateSync, inflateSync } from 'fflate'
import '@zupfnoter/player-ui/style.css'
import {
  countInBeatIndexAtTime,
  findPositionMarker,
  nextPositionBoundaryMarker,
  parsePosition,
  positionAtTime,
  pickupMetronomeStateAtTime,
  type PlaybackCountInStyle,
  resolveCountIn,
  resolveRange,
  tempoBpmAtTime,
} from './playerLogic'

const PLAYER_VERSION = '0.2.1'
const AUDIO_SCHEDULE_WINDOW_MS = 750
const AUDIO_SCHEDULE_LOOKAHEAD_MS = 2500
const AUDIO_SCHEDULE_REFILL_MS = 150
const AUDIO_START_LEAD_MS = 200
const INVALID_PLAYBACK_MESSAGE = 'Die Daten sind fehlerhaft, bitte wende dich an den Herausgeber.'

const appElement = document.querySelector<HTMLDivElement>('#app')
if (appElement === null) throw new Error('Player root is missing')
const app = appElement
let destroyCurrentPlayer: () => void = () => undefined
let closeQrScanner: (() => void) | undefined

const browserPlaybackCodec: PlaybackCompressionCodec = {
  async compress(value) {
    return new Uint8Array(deflateSync(new Uint8Array(value)))
  },
  async decompress(value) {
    return new Uint8Array(inflateSync(new Uint8Array(value)))
  },
}

function renderError(message: string): void {
  destroyCurrentPlayer()
  app.innerHTML = `<section class="card error"><h1>Zupfnoter Übung</h1><p>${message}</p></section>`
}

function renderPlaybackDataError(error: unknown): void {
  console.error('Playback-Daten konnten nicht geladen werden.', error)
  renderError(INVALID_PLAYBACK_MESSAGE)
}

function renderWelcome(): void {
  destroyCurrentPlayer()
  app.innerHTML = `<section class="card welcome-card">
    <div class="player-title-row"><h1>Zupfnoter Player</h1><button id="welcome-scan" class="scan-button" type="button">Scan</button></div>
    <p class="summary">Öffne einen Player-Link oder scanne einen Zupfnoter-QR-Code.</p>
  </section>`
  app.querySelector<HTMLButtonElement>('#welcome-scan')?.addEventListener('click', openQrScanner)
}

function openQrScanner(): void {
  closeQrScanner?.()

  if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    renderError('Der QR-Scanner benötigt eine sichere HTTPS-Verbindung.')
    return
  }

  const overlay = document.createElement('section')
  overlay.className = 'qr-scanner-overlay'
  overlay.innerHTML = `
    <div class="qr-scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title">
      <div class="qr-scanner-header">
        <h2 id="qr-scanner-title">Player-QR-Code scannen</h2>
        <button class="qr-scanner-close" type="button" aria-label="Scanner schließen">×</button>
      </div>
      <div class="qr-scanner-viewfinder">
        <video class="qr-scanner-video" autoplay muted playsinline></video>
        <div class="qr-scanner-frame" aria-hidden="true"></div>
      </div>
      <p class="qr-scanner-status" role="status">Kamera wird geöffnet …</p>
      <p class="qr-scanner-help">QR-Code vollständig in den Rahmen bringen und das Telefon ruhig halten.</p>
    </div>`
  app.appendChild(overlay)

  const video = overlay.querySelector<HTMLVideoElement>('.qr-scanner-video')
  const status = overlay.querySelector<HTMLParagraphElement>('.qr-scanner-status')
  const closeButton = overlay.querySelector<HTMLButtonElement>('.qr-scanner-close')
  if (video === null || status === null || closeButton === null) {
    overlay.remove()
    return
  }

  let controls: IScannerControls | undefined
  let closed = false
  const close = (): void => {
    if (closed) return
    closed = true
    controls?.stop()
    const stream = video.srcObject
    if (stream instanceof MediaStream) {
      for (const track of stream.getTracks()) track.stop()
    }
    video.srcObject = null
    overlay.remove()
    closeQrScanner = undefined
  }
  closeQrScanner = close
  closeButton.addEventListener('click', close, { once: true })

  const reader = new BrowserQRCodeReader(
    new Map<DecodeHintType, unknown>([[DecodeHintType.TRY_HARDER, true]]),
    { delayBetweenScanAttempts: 100, delayBetweenScanSuccess: 1000 },
  )
  void reader.decodeFromConstraints(
    {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    },
    video,
    (result, error) => {
      if (closed) return
      if (result !== undefined) {
        close()
        void loadPlaybackUrl(result.getText()).catch((error: unknown) => {
          renderPlaybackDataError(error)
        })
        return
      }
      if (error !== undefined && status.textContent === 'Kamera wird geöffnet …') {
        status.textContent = 'QR-Code vor die Kamera halten …'
      }
    },
  ).then((nextControls) => {
    if (closed) {
      nextControls.stop()
      return
    }
    controls = nextControls
    status.textContent = 'QR-Code vor die Kamera halten …'
  }).catch((error: unknown) => {
    if (closed) return
    status.textContent = error instanceof Error && error.name === 'NotAllowedError'
      ? 'Kamerazugriff wurde nicht erlaubt.'
      : 'Die Kamera konnte nicht geöffnet werden.'
  })
}

function eventLabel(event: PlaybackEvent | undefined): string {
  return event === undefined ? '—' : `${event.position.measureNumber}.${event.position.passIndex}`
}

function eventPosition(event: PlaybackEvent | undefined): { measureNumber: number; passIndex: number } {
  return event?.position ?? { measureNumber: 1, passIndex: 1 }
}

function playbackDurationForSelection(
  events: readonly PlaybackEvent[],
  positionMarkers: readonly PlaybackPositionMarker[],
  selectedStartMs: number,
): number {
  const lastEvent = events[events.length - 1]
  if (lastEvent === undefined) return 0

  let durationMs = lastEvent.startMs - selectedStartMs + lastEvent.durationMs
  const lastPosition = lastEvent.position
  const endMarker = positionMarkers.find((marker) => marker.timeMs > lastEvent.startMs
    && marker.position.measureNumber === lastPosition.measureNumber
    && marker.position.passIndex === lastPosition.passIndex)
  if (endMarker !== undefined) {
    durationMs = Math.max(durationMs, endMarker.timeMs - selectedStartMs)
  }
  return Math.max(0, durationMs)
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

function renderPlayer(
  events: PlaybackEvent[],
  positionMarkers: PlaybackPositionMarker[],
  identification?: string,
  tempoBpm?: number,
  tempoUnit = 0.25,
): void {
  destroyCurrentPlayer()
  const firstPosition = positionMarkers[0]?.position ?? eventPosition(events[0])
  const maximumMeasure = Math.max(1, ...positionMarkers.map((marker) => marker.position.measureNumber))
  const maximumPass = Math.max(1, ...positionMarkers.map((marker) => marker.position.passIndex))
  let selectedEvents = events
  let selectedStartMs = positionMarkers[0]?.timeMs ?? events[0]?.startMs ?? 0
  let selectedRangePosition = firstPosition
  let countInStyle: PlaybackCountInStyle = 'classic'
  let metronomeSubdivision: 1 | 2 = 1

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
    baseTempoBpm: tempoBpmAtTime(positionMarkers, selectedStartMs, tempoBpm),
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
      onMetronomeSubdivisionChange: (subdivision) => {
        metronomeSubdivision = subdivision
        if (metronomeEnabled) { handleMetronomeChange(false); handleMetronomeChange(true) }
      },
      onCountInStyleChange: (style) => { countInStyle = style },
      onPlay: () => { if (readRange(selectedRangePosition) !== undefined) void playPlayback() },
      onPause: pausePlayback,
      onStop: () => { stopPlayback() },
      onTakePosition: takePosition,
      onScan: openQrScanner,
    },
  })
  let audioContext: AudioContext | undefined
  let playbackTimers: number[] = []
  let animationFrame: number | undefined
  let playbackOffsetMs = 0
  let playbackStartedAtContextTime = 0
  let isPaused = false
  let speedFactor = 1
  let metronomeEnabled = false
  let harpPlayerPromise: Promise<SoundfontPlayer> | undefined
  let metronomeOscillators: OscillatorNode[] = []
  let scheduledMetronomeTimes = new Set<number>()
  let metronomeDestination: AudioNode | undefined

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
    ui.setTempoBpm(tempoBpmAtTime(positionMarkers, absoluteTimeMs, tempoBpm))
    let markerIndex = -1
    for (const [index, marker] of positionMarkers.entries()) {
      if (marker.timeMs <= absoluteTimeMs && marker.meter !== undefined) markerIndex = index
    }
    const marker = markerIndex >= 0 ? positionMarkers[markerIndex] : undefined
    const nextMarker = markerIndex >= 0 ? nextPositionBoundaryMarker(positionMarkers, markerIndex) : undefined
    if (marker?.meter !== undefined) {
      const selectedDurationMs = playbackDurationForSelection(selectedEvents, positionMarkers, selectedStartMs)
      const playbackEndMs = selectedStartMs + selectedDurationMs
      const measureDuration = (nextMarker?.timeMs ?? playbackEndMs) - marker.timeMs
      const beatDuration = tempoBpm !== undefined && tempoBpm > 0
        ? 60000 / tempoBpm / (tempoUnit * marker.meter.denominator)
        : measureDuration / marker.meter.numerator
      const beat = beatDuration > 0 ? Math.min(marker.meter.numerator, Math.floor((absoluteTimeMs - marker.timeMs) / beatDuration) + 1) : 1
      ui.setMetronome(marker.meter, beat, metronomeEnabled)
    } else {
      const pickup = pickupMetronomeStateAtTime(positionMarkers, absoluteTimeMs, tempoBpm, tempoUnit)
      if (pickup !== undefined) ui.setMetronome(pickup.meter, pickup.beat, metronomeEnabled)
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

  function playMetronomeClick(context: AudioContext, accent: boolean, startTime: number, lead = false): void {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = lead ? 620 : accent ? 1200 : 850
    gain.gain.setValueAtTime(lead ? 0.07 : accent ? 0.18 : 0.1, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.055)
    oscillator.connect(gain)
    gain.connect(metronomeDestination ?? context.destination)
    oscillator.start(startTime)
    oscillator.stop(startTime + 0.06)
    metronomeOscillators.push(oscillator)
  }

  function scheduleCountIn(
    context: AudioContext,
    audioStartAt: number,
    countIn: ReturnType<typeof resolveCountIn>,
  ): number {
    if (countIn === undefined) return audioStartAt
    const countInStartAt = audioStartAt - countIn.durationMs / 1000 / speedFactor
    const groupingStarts = new Set<number>()
    let groupingOffset = 0
    for (const group of countIn.meter.grouping ?? []) {
      groupingStarts.add(groupingOffset)
      groupingOffset += group
    }
    for (const [index, beat] of countIn.beats.entries()) {
      const accent = index === 0 || groupingStarts.has(beat)
      const clickAt = countInStartAt + (countIn.beatOffsetsMs[index] ?? 0) / 1000 / speedFactor
      playMetronomeClick(context, accent, clickAt, index < countIn.leadBeatCount)
    }
    return countInStartAt
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
    const pickup = pickupMetronomeStateAtTime(positionMarkers, selectedStartMs, tempoBpm, tempoUnit)
    if (pickup !== undefined && selectedStartMs === (positionMarkers[0]?.timeMs ?? selectedStartMs)) {
      playMetronomeClick(context, false, audioStartAt)
      scheduledMetronomeTimes.add(selectedStartMs)
    }
    for (let markerIndex = 0; markerIndex < positionMarkers.length; markerIndex += 1) {
      const marker = positionMarkers[markerIndex]
      if (marker === undefined || marker.meter === undefined) continue
      const nextMarker = nextPositionBoundaryMarker(positionMarkers, markerIndex)
      const measureEnd = nextMarker?.timeMs ?? selectedStartMs + durationMs
      const measureDuration = measureEnd - marker.timeMs
      if (measureDuration <= 0 || marker.timeMs + measureDuration < selectedStartMs) continue
      const beatCount = marker.meter.numerator
      const beatDuration = tempoBpm !== undefined && tempoBpm > 0
        ? 60000 / tempoBpm / (tempoUnit * marker.meter.denominator)
        : measureDuration / beatCount
      const clickDuration = beatDuration / metronomeSubdivision
      const clickCount = beatCount * metronomeSubdivision
      const grouping = marker.meter.grouping ?? []
      const accentBeats = new Set<number>()
      let groupingOffset = 0
      for (const group of grouping) {
        accentBeats.add(groupingOffset)
        groupingOffset += group
      }
      for (let beat = 0; beat < clickCount; beat += 1) {
        const clickTime = marker.timeMs + beat * clickDuration
        if (clickTime < selectedStartMs || clickTime > selectedStartMs + durationMs) continue
        const relativeClickTime = clickTime - selectedStartMs
        if (relativeClickTime < windowStartMs || relativeClickTime >= windowEndMs) continue
        if (scheduledMetronomeTimes.has(clickTime)) continue
        const accent = beat % metronomeSubdivision === 0
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
    metronomeDestination = undefined
    harpPlayerPromise = undefined
    setLoading(false)
    ui.setRangeEnabled(true)
    ui.setSpeedEnabled(true)
    ui.setPlaying(false)
    isPaused = false
    if (reset) playbackOffsetMs = 0
    updatePosition(playbackOffsetMs)
  }

  async function playPlayback(): Promise<void> {
    if (selectedEvents.length === 0) {
      ui.setRangeEnabled(true)
      return
    }
    stopPlayback(false)
    ui.setRangeEnabled(false)
    ui.setSpeedEnabled(false)
    ui.setPlaying(true)
    configurePlaybackAudioSession()
    const base = selectedStartMs
    const durationMs = playbackDurationForSelection(selectedEvents, positionMarkers, base)
    if (playbackOffsetMs >= durationMs) playbackOffsetMs = 0
    const AudioContextClass = window.AudioContext
      ?? (window as WebkitAudioWindow).webkitAudioContext
    if (AudioContextClass === undefined) {
      ui.setRangeError('Dieser Browser unterstützt keine Audiowiedergabe.')
      ui.setRangeEnabled(true)
      ui.setSpeedEnabled(true)
      ui.setPlaying(false)
      return
    }
    audioContext = new AudioContextClass({ latencyHint: 'playback' })
    // iOS requires resume to start while the play button's gesture is active.
    void audioContext.resume().catch(() => undefined)
    const outputGain = audioContext.createGain()
    outputGain.gain.value = 3.2
    const masterCompressor = audioContext.createDynamicsCompressor()
    masterCompressor.threshold.value = -18
    masterCompressor.knee.value = 18
    masterCompressor.ratio.value = 6
    masterCompressor.attack.value = 0.003
    masterCompressor.release.value = 0.2
    outputGain.connect(masterCompressor)
    masterCompressor.connect(audioContext.destination)
    metronomeDestination = outputGain
    isPaused = false
    const playerContext = audioContext
    const loadingTimer = window.setTimeout(() => {
      if (audioContext === playerContext) setLoading(true)
    }, 150)
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
      window.clearTimeout(loadingTimer)
      setLoading(false)
      ui.setRangeError('Der Harfenklang konnte nicht geladen werden.')
      stopPlayback()
      return
    }
    window.clearTimeout(loadingTimer)
    if (audioContext !== playerContext) return
    setLoading(false)
    const countIn = metronomeEnabled && playbackOffsetMs === 0
      ? resolveCountIn(positionMarkers, selectedStartMs, countInStyle, tempoBpm, tempoUnit)
      : undefined
    const audioStartAt = playerContext.currentTime
      + AUDIO_START_LEAD_MS / 1000
      + (countIn?.durationMs ?? 0) / 1000 / speedFactor
    playbackStartedAtContextTime = audioStartAt - playbackOffsetMs / 1000 / speedFactor
    const elapsed = () => Math.max(0, (playerContext.currentTime - playbackStartedAtContextTime) * 1000 * speedFactor)
    const countInStartAt = countIn === undefined
      ? audioStartAt
      : scheduleCountIn(playerContext, audioStartAt, countIn)
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
      // Keep a rolling audio-context lookahead. Android can delay timers while
      // rendering, so the target is based on the audio clock, not wall time.
      const currentElapsedMs = Math.max(playbackOffsetMs, elapsed())
      const targetEndMs = Math.min(durationMs, currentElapsedMs + AUDIO_SCHEDULE_LOOKAHEAD_MS)
      if (nextWindowStartMs < currentElapsedMs) nextWindowStartMs = currentElapsedMs
      if (nextWindowStartMs >= targetEndMs) {
        const timer = window.setTimeout(scheduleWindow, AUDIO_SCHEDULE_REFILL_MS)
        playbackTimers.push(timer)
        return
      }
      const windowEndMs = Math.min(targetEndMs, nextWindowStartMs + AUDIO_SCHEDULE_WINDOW_MS)
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
      if (playerContext.currentTime < audioStartAt) {
        if (countIn !== undefined) {
          const countInElapsedMs = Math.max(0, (playerContext.currentTime - countInStartAt) * 1000 * speedFactor)
          const countInBeatIndex = countInBeatIndexAtTime(countIn, countInElapsedMs)
          const beat = (countIn.beats[countInBeatIndex] ?? 0) + 1
          ui.setPosition(selectedRangePosition)
          ui.setMetronome(countIn.meter, beat, true)
          ui.setPlaybackTime(0)
        }
        animationFrame = window.requestAnimationFrame(update)
        return
      }
      const elapsedMs = elapsed()
      if (elapsedMs >= durationMs) {
        // Keep the final visual beat/measure visible after the scheduled audio
        // has reached the end. Manual Stop still resets to the range start.
        playbackOffsetMs = durationMs
        stopPlayback(false)
        return
      }
      updatePosition(elapsedMs)
      // Der AudioContext bleibt die Zeitquelle. requestAnimationFrame sorgt
      // dafür, dass der sichtbare Schlag im Renderzyklus aktualisiert wird,
      // statt von einem ungenauen JavaScript-Timer abzuhängen.
      animationFrame = window.requestAnimationFrame(update)
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
    const durationMs = playbackDurationForSelection(selectedEvents, positionMarkers, selectedStartMs)
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
    const elapsedMs = audioContext !== undefined && playbackStartedAtContextTime > 0
      ? Math.max(0, (audioContext.currentTime - playbackStartedAtContextTime) * 1000 * speedFactor)
      : playbackOffsetMs
    const currentPosition = positionAtTime(positionMarkers, selectedStartMs + elapsedMs)
    const previousMeasure = Math.max(1, currentPosition.measureNumber - 1)
    const targetMarker = findPositionMarker(positionMarkers, {
      measureNumber: previousMeasure,
      passIndex: currentPosition.passIndex,
    }) ?? positionMarkers[0]
    if (targetMarker === undefined) return
    // A paused player has already released its AudioContext. Do not run the
    // full stop path again, because it briefly restores the old start state.
    if (audioContext !== undefined) stopPlayback(false)
    ui.setRangePosition(targetMarker.position)
    readRange(targetMarker.position)
    playbackOffsetMs = 0
    updatePosition(0)
  }

  const destroy = (): void => {
    stopPlayback()
    ui.destroy()
    if (destroyCurrentPlayer === destroy) destroyCurrentPlayer = () => undefined
  }
  destroyCurrentPlayer = destroy
}

async function loadPlaybackUrl(rawUrl: string): Promise<void> {
  const pageUrl = new URL(rawUrl, window.location.href)
  const value = pageUrl.hash.match(/^#p=(.+)$/)?.[1]
  if (value === undefined) {
    renderWelcome()
    return
  }
  const identification = pageUrl.searchParams.get('id') ?? undefined
  // Backward compatibility for QR codes generated before tempo metadata was
  // moved into the versioned playback payload.
  const legacyTempoValue = Number(pageUrl.searchParams.get('tempo'))
  const legacyTempoBpm = Number.isFinite(legacyTempoValue) && legacyTempoValue > 0 ? legacyTempoValue : undefined
  const legacyTempoUnitValue = Number(pageUrl.searchParams.get('tempoUnit'))
  const legacyTempoUnit = Number.isFinite(legacyTempoUnitValue) && legacyTempoUnitValue > 0
    ? legacyTempoUnitValue
    : undefined
  const decoded = await decodePlaybackFragment(value, browserPlaybackCodec)
  history.replaceState(null, '', `${window.location.pathname}${pageUrl.search}${pageUrl.hash}`)
  renderPlayer(decoded.events, decoded.positionMarkers, identification,
    decoded.tempoBpm ?? legacyTempoBpm, decoded.tempoUnit ?? legacyTempoUnit)
}

async function main(): Promise<void> {
  try {
    await loadPlaybackUrl(window.location.href)
  } catch (error) {
    renderPlaybackDataError(error)
  }
}

void main()
