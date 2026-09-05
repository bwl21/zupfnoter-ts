import {
  decodePlaybackFragment,
  type PlaybackCompressionCodec,
  type PlaybackEvent,
  type PlaybackPosition,
  type PlaybackPositionMarker,
  type PlaybackMetronomeConfig,
  type PlaybackMetronomeClick,
  createPlaybackCountInPlan,
  createPlaybackMetronomeClicks,
  resolvePlaybackMetronomeEventSound,
  schedulePlaybackMetronomeClick,
  type PlaybackMetronomeSoundKind,
} from '@zupfnoter/playback'
import { mountPracticeUi, renderPracticeIcon, type PracticeUiController } from '@zupfnoter/practice-ui'
import { type IScannerControls } from '@zxing/browser'
import { DecodeHintType, type ResultPointCallback } from '@zxing/library'
import { deflateSync, inflateSync } from 'fflate'
import '@zupfnoter/practice-ui/style.css'
import {
  findPositionMarker,
  partNameAtTime,
  parsePosition,
  positionAtTime,
  resolveRange,
  tempoBpmAtTime,
} from './practiceLogic'
import {
  decodeQrWithWasm,
  enableContinuousFocus,
  isQrPatternRecent,
  ViewfinderQRCodeReader,
} from './qrScanner'

const PRACTICE_VERSION = '0.3.16'
const AUDIO_SCHEDULE_WINDOW_MS = 750
const AUDIO_SCHEDULE_LOOKAHEAD_MS = 2500
const AUDIO_SCHEDULE_REFILL_MS = 150
const AUDIO_START_LEAD_MS = 200
const QR_PATTERN_RETENTION_MS = 2500
const INVALID_PLAYBACK_MESSAGE = 'Die Daten sind fehlerhaft, bitte wende dich an den Herausgeber.'

const appElement = document.querySelector<HTMLDivElement>('#app')
if (appElement === null) throw new Error('Practice root is missing')
const app = appElement
let destroyCurrentPractice: () => void = () => undefined
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
  destroyCurrentPractice()
  app.innerHTML = `<section class="card error"><h1>Zupfnoter Practice</h1><p>${message}</p></section>`
}

function renderPlaybackDataError(error: unknown): void {
  console.error('Playback-Daten konnten nicht geladen werden.', error)
  renderError(describePlaybackDataError(error))
}

function describePlaybackDataError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const unsupportedVersion = /^Unsupported playback format version: (\d+)$/.exec(message)?.[1]
  if (unsupportedVersion !== undefined) {
    return `Zupfnoter Practice unterstützt das Playback-Datenformat ${unsupportedVersion} nicht. Bitte aktualisiere oder deploye die Practice-App erneut.`
  }
  if (message.startsWith('Unsupported playback compression flags:')) {
    return 'Zupfnoter Practice unterstützt die im Link verwendete Kompression nicht. Bitte aktualisiere oder deploye die Practice-App erneut.'
  }
  if (message === 'Invalid playback Base64URL' || message === 'Invalid playback payload magic') {
    return 'Der Übungslink ist beschädigt oder unvollständig. Bitte erzeuge den Link beziehungsweise den QR-Code erneut.'
  }
  if (message.includes('payload ends') || message.includes('Invalid compressed playback data')) {
    return 'Die Playback-Daten sind unvollständig oder konnten nicht dekomprimiert werden. Bitte erzeuge den Link beziehungsweise den QR-Code erneut.'
  }
  return INVALID_PLAYBACK_MESSAGE
}

function renderWelcome(): void {
  destroyCurrentPractice()
  app.innerHTML = `<section class="card welcome-card">
    <div class="practice-title-row"><h1>Zupfnoter Practice</h1><button id="welcome-scan" class="scan-button" type="button">${renderPracticeIcon('scan', 'practice-icon scan-button__icon')}<span>Scan</span></button></div>
    <p class="summary">Öffne einen Übungslink oder scanne einen Zupfnoter-Übungs-QR-Code.</p>
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
        <h2 id="qr-scanner-title">Übungs-QR-Code scannen</h2>
        <button class="qr-scanner-close" type="button" aria-label="Scanner schließen">${renderPracticeIcon('close')}</button>
      </div>
      <div class="qr-scanner-viewfinder">
        <video class="qr-scanner-video" autoplay muted playsinline></video>
        <div class="qr-scanner-frame" aria-hidden="true"></div>
      </div>
      <div class="qr-scanner-detection" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="qr-scanner-status" role="status">Kamera wird geöffnet …</p>
      <p class="qr-scanner-help">Einen QR-Code vollständig in den Rahmen bringen. Sobald die Anzeige reagiert, das Telefon ruhig halten.</p>
      <button class="qr-scanner-retry" type="button" hidden>Kamerazugriff erneut versuchen</button>
      <button class="qr-scanner-snapshot" type="button">Scharfes Bild festhalten und auswerten</button>
    </div>`
  app.appendChild(overlay)

  const video = overlay.querySelector<HTMLVideoElement>('.qr-scanner-video')
  const status = overlay.querySelector<HTMLParagraphElement>('.qr-scanner-status')
  const closeButton = overlay.querySelector<HTMLButtonElement>('.qr-scanner-close')
  const frame = overlay.querySelector<HTMLDivElement>('.qr-scanner-frame')
  const viewfinder = overlay.querySelector<HTMLDivElement>('.qr-scanner-viewfinder')
  const help = overlay.querySelector<HTMLParagraphElement>('.qr-scanner-help')
  const retryButton = overlay.querySelector<HTMLButtonElement>('.qr-scanner-retry')
  const snapshotButton = overlay.querySelector<HTMLButtonElement>('.qr-scanner-snapshot')
  if (video === null || status === null || closeButton === null || frame === null || viewfinder === null
    || help === null || retryButton === null || snapshotButton === null) {
    overlay.remove()
    return
  }

  let controls: IScannerControls | undefined
  let reader: ViewfinderQRCodeReader | undefined
  let closed = false
  let possiblePoints = 0
  let detectionResetTimer: number | undefined
  let robustDecodeInFlight = false
  let lastRobustDecodeAt = 0
  let lastPatternDetectedAt = Number.NEGATIVE_INFINITY
  let robustDecodeAttempt = 0
  let snapshotDecodeInFlight = false
  let cameraStartInFlight = false
  const showDetection = (state: 'searching' | 'partial' | 'detected'): void => {
    viewfinder.dataset.detection = state
    status.textContent = state === 'detected'
      ? 'QR-Muster erkannt – Dekodierung läuft, bitte ruhig halten …'
      : state === 'partial'
        ? 'QR-Muster teilweise erkannt – Abstand langsam verändern …'
        : 'QR-Code im Rahmen suchen …'
  }
  const resultPointCallback: ResultPointCallback = {
    foundPossibleResultPoint() {
      possiblePoints += 1
      lastPatternDetectedAt = performance.now()
      showDetection(possiblePoints >= 3 ? 'detected' : 'partial')
      if (detectionResetTimer !== undefined) window.clearTimeout(detectionResetTimer)
      detectionResetTimer = window.setTimeout(() => {
        possiblePoints = 0
        lastPatternDetectedAt = Number.NEGATIVE_INFINITY
        robustDecodeAttempt = 0
        showDetection('searching')
      }, QR_PATTERN_RETENTION_MS)
    },
  }
  const stopCamera = (): void => {
    controls?.stop()
    controls = undefined
    const stream = video.srcObject
    if (stream instanceof MediaStream) {
      for (const track of stream.getTracks()) track.stop()
    }
    video.srcObject = null
  }
  const close = (): void => {
    if (closed) return
    closed = true
    stopCamera()
    if (detectionResetTimer !== undefined) window.clearTimeout(detectionResetTimer)
    overlay.remove()
    closeQrScanner = undefined
  }
  closeQrScanner = close
  closeButton.addEventListener('click', close, { once: true })

  const openDecodedUrl = (url: string): void => {
    if (closed) return
    close()
    void loadPlaybackUrl(url).catch((error: unknown) => {
      renderPlaybackDataError(error)
    })
  }
  snapshotButton.addEventListener('click', () => {
    if (snapshotDecodeInFlight) return
    const imageData = reader?.captureImageData(0.15)
    if (imageData === undefined) {
      viewfinder.dataset.detection = 'partial'
      status.textContent = 'Das Kamerabild ist noch nicht bereit. Bitte kurz warten.'
      return
    }
    snapshotDecodeInFlight = true
    snapshotButton.disabled = true
    viewfinder.dataset.detection = 'detected'
    status.textContent = `Bild festgehalten (${imageData.width} × ${imageData.height}) – lokale Auswertung läuft …`
    void decodeQrWithWasm(imageData).then((result) => {
      if (result !== undefined) {
        openDecodedUrl(result)
        return
      }
      viewfinder.dataset.detection = 'partial'
      status.textContent = 'Das festgehaltene Bild war nicht lesbar. Neu fokussieren und nochmals festhalten.'
    }).catch((error: unknown) => {
      console.warn('Festgehaltenes QR-Bild konnte nicht ausgewertet werden.', error)
      viewfinder.dataset.detection = 'partial'
      status.textContent = 'Das festgehaltene Bild konnte nicht ausgewertet werden. Bitte erneut versuchen.'
    }).finally(() => {
      snapshotDecodeInFlight = false
      snapshotButton.disabled = false
    })
  })
  const tryRobustDecode = async (): Promise<void> => {
    const now = performance.now()
    if (closed || snapshotDecodeInFlight || robustDecodeInFlight || now - lastRobustDecodeAt < 300) return
    const imageData = reader?.captureImageData(0.15)
    if (imageData === undefined) return
    robustDecodeInFlight = true
    lastRobustDecodeAt = now
    robustDecodeAttempt += 1
    viewfinder.dataset.detection = 'detected'
    status.textContent = `QR-Muster erkannt – Auswertung ${robustDecodeAttempt}, bitte ruhig halten …`
    try {
      const result = await decodeQrWithWasm(imageData)
      if (result !== undefined) openDecodedUrl(result)
    } catch (error: unknown) {
      console.warn('Robuster QR-Decoder konnte nicht ausgeführt werden.', error)
    } finally {
      robustDecodeInFlight = false
    }
  }

  reader = new ViewfinderQRCodeReader(
    frame,
    new Map<DecodeHintType, unknown>([
      [DecodeHintType.TRY_HARDER, true],
      [DecodeHintType.NEED_RESULT_POINT_CALLBACK, resultPointCallback],
    ]),
    { delayBetweenScanAttempts: 100, delayBetweenScanSuccess: 1000 },
    () => {
      possiblePoints = 0
    },
  )
  const startCamera = async (): Promise<void> => {
    if (closed || cameraStartInFlight) return
    cameraStartInFlight = true
    retryButton.hidden = true
    snapshotButton.disabled = true
    status.textContent = 'Kamerazugriff wird angefragt …'
    help.textContent = 'Bitte eine Abfrage von Chrome beziehungsweise Android mit „Zulassen“ bestätigen.'
    try {
      const nextControls = await reader?.decodeFromConstraints(
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
            openDecodedUrl(result.getText())
            return
          }
          if (error !== undefined && isQrPatternRecent(
            lastPatternDetectedAt,
            performance.now(),
            QR_PATTERN_RETENTION_MS,
          )) void tryRobustDecode()
        },
      )
      if (nextControls === undefined) throw new Error('QR-Leser ist nicht verfügbar.')
      if (closed) {
        nextControls.stop()
        return
      }
      controls = nextControls
      snapshotButton.disabled = false
      help.textContent = 'Einen QR-Code vollständig in den Rahmen bringen. Sobald die Anzeige reagiert, das Telefon ruhig halten.'
      showDetection('searching')
      void enableContinuousFocus(video).catch(() => undefined)
    } catch (error: unknown) {
      if (closed) return
      const permissionDenied = error instanceof Error && error.name === 'NotAllowedError'
      status.textContent = permissionDenied
        ? 'Chrome oder Android blockiert den Kamerazugriff.'
        : 'Die Kamera konnte nicht geöffnet werden.'
      help.textContent = permissionDenied
        ? 'In Chrome bei practice.zupfnoter.de die Website-Einstellung „Kamera: Zulassen“ setzen. Falls sie dort erlaubt ist: Android-Einstellungen → Apps → Chrome → Berechtigungen → Kamera zulassen. Danach hier erneut versuchen.'
        : 'Bitte prüfen, ob eine andere App die Kamera verwendet, und danach erneut versuchen.'
      retryButton.hidden = false
    } finally {
      cameraStartInFlight = false
    }
  }
  retryButton.addEventListener('click', () => {
    void startCamera()
  })
  void startCamera()
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

function renderPractice(
  events: PlaybackEvent[],
  positionMarkers: PlaybackPositionMarker[],
  identification?: string,
  tempoBpm?: number,
  tempoUnit = 0.25,
  metronomeConfig?: PlaybackMetronomeConfig,
): void {
  destroyCurrentPractice()
  const firstPosition = positionMarkers[0]?.position ?? eventPosition(events[0])
  const maximumMeasure = Math.max(1, ...positionMarkers.map((marker) => marker.position.measureNumber))
  const maximumPass = Math.max(1, ...positionMarkers.map((marker) => marker.position.passIndex))
  let selectedEvents = events
  let selectedStartMs = positionMarkers[0]?.timeMs ?? events[0]?.startMs ?? 0
  let selectedRangePosition = firstPosition
  const defaultMinLeadIn = positionMarkers.find((marker) => marker.meter !== undefined)?.meter?.numerator ?? 4
  let minLeadIn = metronomeConfig?.minLeadIn ?? defaultMinLeadIn
  let bandPreCount = metronomeConfig?.bandPreCount ?? false
  let metronomeDivision = metronomeConfig?.division
  let metronomeSubdivision = metronomeConfig?.subdivision ?? 1
  let metronomeVolume = 1
  let selectedMetronomeMode: Exclude<PlaybackMetronomeConfig['mode'], 'off'> = metronomeConfig?.mode === 'countIn'
    || metronomeConfig?.mode === 'playback'
    || metronomeConfig?.mode === 'always'
    ? metronomeConfig.mode
    : 'always'
  let metronomeEnabled = metronomeConfig?.mode !== undefined && metronomeConfig.mode !== 'off'
  let metronomeMode: PlaybackMetronomeConfig['mode'] = metronomeEnabled ? selectedMetronomeMode : 'off'

  function divisionForMeter(meter?: { numerator: number }): number {
    return Math.max(1, metronomeDivision ?? meter?.numerator ?? 4)
  }

  function meterAtTime(timeMs: number): PlaybackPositionMarker['meter'] {
    let meter = positionMarkers.find((marker) => marker.meter !== undefined)?.meter
    for (const marker of positionMarkers) {
      if (marker.timeMs > timeMs) break
      if (marker.meter !== undefined) meter = marker.meter
    }
    return meter
  }

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
    if (metronomeDivision === undefined) ui.setDivision(divisionForMeter(meterAtTime(selectedStartMs)))
    return range.range
  }
  let ui: PracticeUiController
  ui = mountPracticeUi({
    container: app,
    practiceVersion: PRACTICE_VERSION,
    identification,
    firstPosition,
    firstPartName: partNameAtTime(positionMarkers, selectedStartMs),
    hasParts: positionMarkers.some((marker) => (marker.partName?.trim().length ?? 0) > 0),
    maximumMeasure,
    maximumPass,
    hasMetronomeData: positionMarkers.some((marker) => marker.meter !== undefined),
    minLeadIn,
    bandPreCount,
    division: divisionForMeter(meterAtTime(selectedStartMs)),
    subdivision: metronomeSubdivision,
    baseTempoBpm: tempoBpmAtTime(positionMarkers, selectedStartMs, tempoBpm),
    metronomeEnabled,
    metronomeMode: selectedMetronomeMode,
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
      onMetronomeModeChange: (mode) => { handleMetronomeModeChange(mode) },
      onMinLeadInChange: (value) => { minLeadIn = value },
      onBandPreCountChange: (enabled) => { bandPreCount = enabled },
      onDivisionChange: (value) => { metronomeDivision = value },
      onSubdivisionChange: (value) => {
        metronomeSubdivision = value
        if (metronomeEnabled) { handleMetronomeChange(false); handleMetronomeChange(true) }
      },
      onMetronomeVolumeChange: (value) => {
        metronomeVolume = value
        if (metronomeGain !== undefined) metronomeGain.gain.value = value
      },
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
  let metronomePlaybackStartMs = selectedStartMs
  let isPaused = false
  let speedFactor = 1
  let harpPlayerPromise: Promise<SoundfontPlayer> | undefined
  let metronomeOscillators: OscillatorNode[] = []
  let metronomeGain: GainNode | undefined
  let scheduledMetronomeTimes = new Set<number>()
  let visualMetronomeCache: { key: string, clicks: PlaybackMetronomeClick[] } | undefined

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
    clearMetronomeSchedule()
  }

  function clearMetronomeSchedule(): void {
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
    ui.setPosition(currentPosition, partNameAtTime(positionMarkers, absoluteTimeMs))
    ui.setTempoBpm(tempoBpmAtTime(positionMarkers, absoluteTimeMs, tempoBpm))
    const selectedDurationMs = playbackDurationForSelection(selectedEvents, positionMarkers, selectedStartMs)
    const visualCacheKey = `${selectedStartMs}:${selectedDurationMs}:${metronomeDivision ?? 'meter'}:${metronomeSubdivision}`
    if (visualMetronomeCache?.key !== visualCacheKey) {
      visualMetronomeCache = {
        key: visualCacheKey,
        clicks: createPlaybackMetronomeClicks(
          positionMarkers,
          selectedStartMs + selectedDurationMs,
          metronomeDivision,
          metronomeSubdivision,
          tempoBpm,
          tempoUnit,
        ),
      }
    }
    let currentClick: PlaybackMetronomeClick | undefined
    for (const click of visualMetronomeCache.clicks) {
      if (click.timeMs > absoluteTimeMs) break
      currentClick = click
    }
    const currentMeter = meterAtTime(absoluteTimeMs)
    if (currentClick !== undefined && currentMeter !== undefined) {
      ui.setMetronome(
        { ...currentMeter, numerator: currentClick.division },
        currentClick.beat,
        metronomeEnabled && (metronomeMode === 'playback' || metronomeMode === 'always'),
      )
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

  function playMetronomeClick(context: AudioContext, soundKind: PlaybackMetronomeSoundKind, startTime: number): void {
    if (metronomeGain === undefined) {
      metronomeGain = context.createGain()
      metronomeGain.gain.value = metronomeVolume
      metronomeGain.connect(context.destination)
    }
    const oscillator = schedulePlaybackMetronomeClick(context, startTime, soundKind, metronomeGain)
    metronomeOscillators.push(oscillator)
  }

  function scheduleCountIn(
    context: AudioContext,
    timelineStartAt: number,
    entryOffsetMs: number,
    countIn: ReturnType<typeof createPlaybackCountInPlan>,
  ): number {
    if (countIn === undefined) return timelineStartAt
    const countInStartAt = timelineStartAt + (entryOffsetMs - countIn.durationMs) / 1000 / speedFactor
    for (const event of countIn.events) {
      const clickAt = countInStartAt + event.offsetMs / 1000 / speedFactor
      const sound = resolvePlaybackMetronomeEventSound(event.kind, event.isLastBeforeEntry)
      playMetronomeClick(context, sound, clickAt)
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
    if (!metronomeEnabled || metronomeMode === 'countIn') return
    for (const click of createPlaybackMetronomeClicks(positionMarkers, selectedStartMs + durationMs,
      metronomeDivision, metronomeSubdivision, tempoBpm, tempoUnit)) {
        const clickTime = click.timeMs
        if (clickTime < metronomePlaybackStartMs || clickTime > selectedStartMs + durationMs) continue
        const relativeClickTime = clickTime - selectedStartMs
        if (relativeClickTime < windowStartMs || relativeClickTime >= windowEndMs) continue
        if (scheduledMetronomeTimes.has(clickTime)) continue
        const delaySec = (clickTime - selectedStartMs - playbackOffsetMsForSchedule) / 1000 / speedFactor
        if (delaySec < 0) continue
        const sound = resolvePlaybackMetronomeEventSound(click.kind)
        playMetronomeClick(context, sound, audioStartAt + delaySec)
        scheduledMetronomeTimes.add(clickTime)
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
    metronomeGain = undefined
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
    outputGain.gain.value = 2.6
    const masterCompressor = audioContext.createDynamicsCompressor()
    // Keep the increased sample level loud without letting the compressor
    // continuously turn down dense passages.
    masterCompressor.threshold.value = -6
    masterCompressor.knee.value = 6
    masterCompressor.ratio.value = 6
    masterCompressor.attack.value = 0.003
    masterCompressor.release.value = 0.15
    outputGain.connect(masterCompressor)
    masterCompressor.connect(audioContext.destination)
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
    const entryTimeMs = selectedStartMs
    const entryOffsetMs = Math.max(0, entryTimeMs - selectedStartMs)
    const countIn = metronomeEnabled && (metronomeMode === 'countIn' || metronomeMode === 'always') && playbackOffsetMs === 0
      ? createPlaybackCountInPlan(positionMarkers, entryTimeMs, {
        minLeadIn,
        bandPreCount,
        division: metronomeDivision,
        subdivision: metronomeSubdivision,
      }, tempoBpm, tempoUnit)
      : undefined
    const preRollDurationMs = Math.max(0, (countIn?.durationMs ?? 0) - entryOffsetMs)
    const audioStartAt = playerContext.currentTime
      + AUDIO_START_LEAD_MS / 1000
      + preRollDurationMs / 1000 / speedFactor
    playbackStartedAtContextTime = audioStartAt - playbackOffsetMs / 1000 / speedFactor
    const elapsed = () => Math.max(0, (playerContext.currentTime - playbackStartedAtContextTime) * 1000 * speedFactor)
    const countInStartAt = countIn === undefined
      ? audioStartAt
      : scheduleCountIn(playerContext, audioStartAt, entryOffsetMs, countIn)
    const countInEndAt = audioStartAt + entryOffsetMs / 1000 / speedFactor
    metronomePlaybackStartMs = countIn === undefined ? selectedStartMs : entryTimeMs
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
      if (playerContext.currentTime < countInEndAt) {
        if (countIn !== undefined) {
          const countInElapsedMs = Math.max(0, (playerContext.currentTime - countInStartAt) * 1000 * speedFactor)
          let visibleEvent = countIn.events[0]
          for (const event of countIn.events) {
            if (event.offsetMs > countInElapsedMs) break
            visibleEvent = event
          }
          const beat = (visibleEvent?.beat ?? 0) + 1
          ui.setPosition(selectedRangePosition, partNameAtTime(positionMarkers, selectedStartMs))
          ui.setMetronome({ ...countIn.meter, numerator: divisionForMeter(countIn.meter) }, beat, true)
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

  function currentPlaybackElapsedMs(): number {
    if (audioContext === undefined || playbackStartedAtContextTime <= 0) return playbackOffsetMs
    return Math.max(0, (audioContext.currentTime - playbackStartedAtContextTime) * 1000 * speedFactor)
  }

  function handleMetronomeChange(enabled: boolean): void {
    metronomeEnabled = enabled
    metronomeMode = enabled ? selectedMetronomeMode : 'off'
    clearMetronomeSchedule()
    updatePosition(currentPlaybackElapsedMs())
    scheduleMetronomeFromCurrentPosition()
  }

  function handleMetronomeModeChange(mode: Exclude<PlaybackMetronomeConfig['mode'], 'off'>): void {
    selectedMetronomeMode = mode
    if (!metronomeEnabled) return
    metronomeMode = mode
    clearMetronomeSchedule()
    updatePosition(currentPlaybackElapsedMs())
    scheduleMetronomeFromCurrentPosition()
  }

  function scheduleMetronomeFromCurrentPosition(): void {
    if (!metronomeEnabled || metronomeMode === 'countIn' || audioContext === undefined) return
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
    if (destroyCurrentPractice === destroy) destroyCurrentPractice = () => undefined
  }
  destroyCurrentPractice = destroy
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
  renderPractice(decoded.events, decoded.positionMarkers, identification,
    decoded.tempoBpm ?? legacyTempoBpm, decoded.tempoUnit ?? legacyTempoUnit, decoded.metronome)
}

async function main(): Promise<void> {
  try {
    await loadPlaybackUrl(window.location.href)
  } catch (error) {
    renderPlaybackDataError(error)
  }
}

void main()

window.addEventListener('hashchange', () => {
  void main()
})
