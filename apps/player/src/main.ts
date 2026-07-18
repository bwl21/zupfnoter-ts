import {
  decodePlaybackFragment,
  type PlaybackCompressionCodec,
  type PlaybackEvent,
  type PlaybackPosition,
  type PlaybackPositionMarker,
} from '@zupfnoter/playback'
import { deflateSync, inflateSync } from 'fflate'
import './style.css'

const PLAYER_VERSION = '0.1.5'

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

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character)
}

function eventPosition(event: PlaybackEvent | undefined): { measureNumber: number; passIndex: number } {
  return event?.position ?? { measureNumber: 1, passIndex: 1 }
}

interface SoundfontPitch {
  note: number
  cents: number
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

function wheelField(name: string, label: string, value: number, maximum: number): string {
  if (maximum <= 1) return `<input type="hidden" name="${name}" value="1" />`
  const options = Array.from({ length: maximum }, (_, index) => {
    const option = index + 1
    return `<span class="wheel-option" data-value="${option}">${option}</span>`
  }).join('')
  return `<div class="wheel-control"><span class="wheel-label">${label}</span><div class="wheel" data-wheel="${name}" tabindex="0" role="spinbutton" aria-label="${label}" aria-valuemin="1" aria-valuemax="${maximum}" aria-valuenow="${value}"><div class="wheel-options">${options}</div><input class="wheel-entry" type="number" name="${name}" value="${value}" min="1" max="${maximum}" inputmode="numeric" aria-label="${label} eingeben" /></div></div>`
}

function parsePosition(value: string): { measureNumber: number; passIndex: number } | undefined {
  const match = value.trim().match(/^(\d+)\.(\d+)$/)
  if (match === null) return undefined
  const measureNumber = Number(match[1])
  const passIndex = Number(match[2])
  return measureNumber > 0 && passIndex > 0 ? { measureNumber, passIndex } : undefined
}

function findPositionMarker(markers: readonly PlaybackPositionMarker[], position: PlaybackPosition): PlaybackPositionMarker | undefined {
  return markers.find((marker) => marker.position.measureNumber === position.measureNumber
    && marker.position.passIndex === position.passIndex)
}

function positionAtTime(markers: readonly PlaybackPositionMarker[], timeMs: number): PlaybackPosition {
  let current = markers[0]?.position ?? { measureNumber: 1, passIndex: 1 }
  for (const marker of markers) {
    if (marker.timeMs > timeMs) break
    current = marker.position
  }
  return current
}

function nextDistinctPositionMarker(
  markers: readonly PlaybackPositionMarker[],
  markerIndex: number,
): PlaybackPositionMarker | undefined {
  const marker = markers[markerIndex]
  if (marker === undefined) return undefined
  return markers.slice(markerIndex + 1).find((candidate) => (
    candidate.position.measureNumber !== marker.position.measureNumber
    || candidate.position.passIndex !== marker.position.passIndex
  ))
}

function resolveRange(events: readonly PlaybackEvent[], markers: readonly PlaybackPositionMarker[], from: string): { range: [number, number]; startMs: number } | undefined {
  const start = parsePosition(from)
  if (start === undefined) return undefined
  const marker = findPositionMarker(markers, start)
  if (marker === undefined) return undefined
  const startIndex = events.findIndex((event) => event.startMs + event.durationMs > marker.timeMs)
  if (startIndex < 0) return undefined
  return { range: [startIndex, events.length - 1], startMs: marker.timeMs }
}

function renderPlayer(events: PlaybackEvent[], positionMarkers: PlaybackPositionMarker[], identification?: string): void {
  const first = eventLabel(events[0]) === '—' ? '1.1' : eventLabel(events[0])
  const firstPosition = positionMarkers[0]?.position ?? eventPosition(events[0])
  const maximumMeasure = Math.max(1, ...positionMarkers.map((marker) => marker.position.measureNumber))
  const maximumPass = Math.max(1, ...positionMarkers.map((marker) => marker.position.passIndex))
  app.innerHTML = `
    <section class="card">
      <h1>Zupfnoter Player</h1>
      <p class="player-version">Player v${PLAYER_VERSION}</p>
      ${identification === undefined ? '' : `<p class="identification" aria-label="Stücknummer">${escapeHtml(identification)}</p>`}
      <form id="range-form" class="range-form">
        <fieldset class="range-fieldset">
          <legend>Von</legend>
          ${wheelField('from-measure', 'Takt', firstPosition.measureNumber, maximumMeasure)}
          <span class="wheel-dot" aria-hidden="true">${maximumPass > 1 ? '.' : ''}</span>
          ${wheelField('from-pass', 'Durchlauf', firstPosition.passIndex, maximumPass)}
          <div class="range-actions">
            <button id="reset-range" type="button">Reset</button>
          </div>
        </fieldset>
      </form>
        <p id="range-error" class="error-text" aria-live="polite"></p>
      <p id="loading-indicator" class="loading-indicator" role="status" aria-live="polite" hidden>
        <span class="spinner" aria-hidden="true"></span> Harfenklang wird geladen …
      </p>
      <label class="speed-control" for="speed-range">
        <input id="speed-range" type="range" min="0.5" max="1.5" step="0.05" value="1" aria-label="Wiedergabegeschwindigkeit" aria-valuemin="0.5" aria-valuemax="1.5" aria-valuenow="1">
        <output id="speed-value" for="speed-range">1,00×</output>
      </label>
      <div class="metronome-row" aria-label="Metronom">
        <label class="metronome-control" for="metronome-toggle">
          <input id="metronome-toggle" type="checkbox" ${positionMarkers.some((marker) => marker.meter !== undefined) ? '' : 'disabled'}>
          <span class="metronome-switch" aria-hidden="true"></span>
          <span class="sr-only">Metronom</span>
        </label>
        <output id="metronome-status" class="metronome-status" aria-live="polite">${positionMarkers.some((marker) => marker.meter !== undefined) ? '<span class="metronome-beat" aria-hidden="true"></span><span>—</span><span>—</span>' : 'Metronomdaten fehlen in diesem Link'}</output>
      </div>
      <section class="transport" aria-label="Wiedergabe">
        <div class="position-row">
          <output id="current-position" class="position">${first}</output>
          <button id="take-position-button" class="take-position" type="button" title="Position übernehmen" aria-label="Position übernehmen">
            <span class="take-position__icon" aria-hidden="true">◎</span>
          </button>
        </div>
        <p id="playback-time" class="playback-time">0:00</p>
        <div class="transport-buttons">
          <button id="play-button" type="button" aria-label="Wiedergabe starten">▶</button>
          <button id="pause-button" type="button" aria-label="Wiedergabe pausieren">Ⅱ</button>
          <button id="stop-button" type="button" aria-label="Wiedergabe stoppen">■</button>
        </div>
      </section>
    </section>`

  const form = document.querySelector<HTMLFormElement>('#range-form')
  const error = document.querySelector<HTMLParagraphElement>('#range-error')
  const loadingIndicator = document.querySelector<HTMLParagraphElement>('#loading-indicator')
  const speedRange = document.querySelector<HTMLInputElement>('#speed-range')
  const speedValue = document.querySelector<HTMLOutputElement>('#speed-value')
  const metronomeToggle = document.querySelector<HTMLInputElement>('#metronome-toggle')
  const metronomeStatus = document.querySelector<HTMLOutputElement>('#metronome-status')
  const position = document.querySelector<HTMLOutputElement>('#current-position')
  const playbackTime = document.querySelector<HTMLParagraphElement>('#playback-time')
  const playButton = document.querySelector<HTMLButtonElement>('#play-button')
  const pauseButton = document.querySelector<HTMLButtonElement>('#pause-button')
  const stopButton = document.querySelector<HTMLButtonElement>('#stop-button')
  const takePositionButton = document.querySelector<HTMLButtonElement>('#take-position-button')
  const resetButton = document.querySelector<HTMLButtonElement>('#reset-range')
  let selectedEvents = events
  let selectedStartMs = positionMarkers[0]?.timeMs ?? events[0]?.startMs ?? 0

  function readRange(): [number, number] | undefined {
    if (form === null) return undefined
    const data = new FormData(form)
    const from = `${String(data.get('from-measure') ?? '')}.${String(data.get('from-pass') ?? '')}`
    const range = resolveRange(events, positionMarkers, from)
    if (range === undefined) {
      if (error !== null) error.textContent = 'Der Bereich wurde im Playback nicht gefunden.'
      return undefined
    }
    if (error !== null) error.textContent = ''
    selectedEvents = events.slice(range.range[0], range.range[1] + 1)
    selectedStartMs = range.startMs
    return range.range
  }

  function setWheelValue(name: string, value: number): void {
    const hidden = form?.querySelector<HTMLInputElement>(`input[name="${name}"]`)
    const wheel = document.querySelector<HTMLElement>(`[data-wheel="${name}"]`)
    if (hidden !== null && hidden !== undefined) hidden.value = String(value)
    if (wheel !== null) {
      const option = [...wheel.querySelectorAll<HTMLElement>('.wheel-option')][value - 1]
      wheel.scrollTop = option?.offsetTop ?? 0
      wheel.setAttribute('aria-valuenow', String(value))
    }
  }

  for (const wheel of document.querySelectorAll<HTMLElement>('[data-wheel]')) {
    const name = wheel.dataset.wheel
    const hidden = name === undefined
      ? undefined
      : form?.querySelector<HTMLInputElement>(`input[name="${name}"]`) ?? undefined
    const options = [...wheel.querySelectorAll<HTMLElement>('.wheel-option')]
    const currentValue = Number(hidden?.value ?? 1)
    hidden?.addEventListener('input', () => {
      const value = Number(hidden.value)
      if (!Number.isInteger(value) || value < 1 || value > options.length) return
      const option = options[value - 1]
      wheel.scrollTo({ top: option?.offsetTop ?? 0, behavior: 'smooth' })
      wheel.setAttribute('aria-valuenow', String(value))
      readRange()
    })
    const initialOption = options[currentValue - 1]
    wheel.scrollTop = initialOption?.offsetTop ?? 0
    const nearestOptionIndex = (): number => {
      let nearestIndex = 0
      let nearestDistance = Number.POSITIVE_INFINITY
      for (const [index, option] of options.entries()) {
        const distance = Math.abs(wheel.scrollTop - option.offsetTop)
        if (distance < nearestDistance) {
          nearestIndex = index
          nearestDistance = distance
        }
      }
      return nearestIndex
    }
    let snapTimer: number | undefined
    wheel.addEventListener('scroll', () => {
      const index = nearestOptionIndex()
      const option = options[index]
      if (option === undefined || hidden === undefined) return
      hidden.value = option.dataset.value ?? '1'
      wheel.setAttribute('aria-valuenow', hidden.value)
      readRange()
      if (snapTimer !== undefined) window.clearTimeout(snapTimer)
      snapTimer = window.setTimeout(() => {
        const snappedIndex = Math.max(0, Math.min(options.length - 1, nearestOptionIndex()))
        wheel.scrollTo({ top: options[snappedIndex]?.offsetTop ?? 0, behavior: 'smooth' })
        const snappedOption = options[snappedIndex]
        if (snappedOption !== undefined && hidden !== undefined) {
          hidden.value = snappedOption.dataset.value ?? '1'
          wheel.setAttribute('aria-valuenow', hidden.value)
          readRange()
        }
      }, 90)
    }, { passive: true })
  }
  let audioContext: AudioContext | undefined
  let playbackTimers: number[] = []
  let animationFrame: number | undefined
  let positionTimer: number | undefined
  let playbackOffsetMs = 0
  let playbackStartedAtContextTime = 0
  let currentEvent: PlaybackEvent | undefined
  let isPaused = false
  let speedFactor = 1
  let harpPlayerPromise: Promise<SoundfontPlayer> | undefined
  let metronomeOscillators: OscillatorNode[] = []

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
  }

  function updatePosition(elapsedMs: number): void {
    const absoluteTimeMs = selectedStartMs + elapsedMs
    currentEvent = selectedEvents.filter((event) => event.startMs <= absoluteTimeMs).at(-1)
    if (position !== null) {
      const currentPosition = positionAtTime(positionMarkers, absoluteTimeMs)
      position.value = `${currentPosition.measureNumber}.${currentPosition.passIndex}`
    }
    if (metronomeStatus !== null) {
      let markerIndex = -1
      for (const [index, marker] of positionMarkers.entries()) {
        if (marker.timeMs <= absoluteTimeMs && marker.meter !== undefined) markerIndex = index
      }
      const marker = markerIndex >= 0 ? positionMarkers[markerIndex] : undefined
      const nextMarker = markerIndex >= 0 ? nextDistinctPositionMarker(positionMarkers, markerIndex) : undefined
      if (marker?.meter !== undefined) {
        const measureDuration = (nextMarker?.timeMs ?? selectedStartMs + 1000) - marker.timeMs
        const beatDuration = measureDuration / marker.meter.numerator
        const beat = beatDuration > 0 ? Math.min(marker.meter.numerator, Math.floor((absoluteTimeMs - marker.timeMs) / beatDuration) + 1) : 1
        const groupingStarts = new Set<number>()
        let groupingOffset = 0
        for (const group of marker.meter.grouping ?? []) {
          groupingStarts.add(groupingOffset)
          groupingOffset += group
        }
        const activeClass = metronomeToggle?.checked === true ? ' metronome-beat--active' : ''
        const beatDots = Array.from({ length: marker.meter.numerator }, (_value, index) => {
          const isActive = index + 1 === beat ? activeClass : ''
          const isAccent = index === 0 || groupingStarts.has(index) ? ' metronome-beat--accent' : ''
          return `<span class="metronome-beat${isAccent}${isActive}" aria-hidden="true"></span>`
        }).join('')
        metronomeStatus.innerHTML = `<span class="metronome-beats" aria-hidden="true">${beatDots}</span><span class="metronome-count">${beat}</span><span>${marker.meter.numerator}/${marker.meter.denominator}</span>`
      }
    }
    if (playbackTime !== null) {
      const seconds = Math.floor(Math.max(0, elapsedMs) / 1000)
      playbackTime.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    }
  }

  function setLoading(loading: boolean): void {
    if (loadingIndicator !== null) loadingIndicator.hidden = !loading
    if (playButton !== null) {
      playButton.disabled = loading
      playButton.setAttribute('aria-busy', String(loading))
    }
  }

  function setSpeed(value: string): void {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    speedFactor = parsed
    if (speedValue !== null) speedValue.value = `${parsed.toFixed(2).replace('.', ',')}×`
    speedRange?.setAttribute('aria-valuenow', String(parsed))
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
  ): void {
    if (metronomeToggle?.checked !== true) return
    for (let markerIndex = 0; markerIndex < positionMarkers.length; markerIndex += 1) {
      const marker = positionMarkers[markerIndex]
      if (marker === undefined || marker.meter === undefined) continue
      const nextMarker = nextDistinctPositionMarker(positionMarkers, markerIndex)
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
        const accent = beat === 0 || accentBeats.has(beat)
        const delaySec = (clickTime - selectedStartMs - playbackOffsetMsForSchedule) / 1000 / speedFactor
        if (delaySec < 0) continue
        playMetronomeClick(context, accent, audioStartAt + delaySec)
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
    const base = selectedStartMs
    const durationMs = (selectedEvents[selectedEvents.length - 1]?.startMs ?? base) - base
      + (selectedEvents[selectedEvents.length - 1]?.durationMs ?? 0)
    if (playbackOffsetMs >= durationMs) playbackOffsetMs = 0
    const AudioContextClass = window.AudioContext
    audioContext = new AudioContextClass({ latencyHint: 'playback' })
    const outputGain = audioContext.createGain()
    outputGain.gain.value = 2
    outputGain.connect(audioContext.destination)
    isPaused = false
    setLoading(true)
    const playerContext = audioContext
    let harpPlayer: SoundfontPlayer
    try {
      harpPlayer = await loadHarpPlayer(playerContext, selectedEvents.map((event) => event.pitch), outputGain)
    } catch {
      setLoading(false)
      if (error !== null) error.textContent = 'Der Harfenklang konnte nicht geladen werden.'
      stopPlayback()
      return
    }
    if (audioContext !== playerContext) return
    setLoading(false)
    const audioStartAt = playerContext.currentTime + 0.2
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
        ...resolveSoundfontPitch(event.pitch),
        time: Math.max(0, eventOffset - playbackOffsetMs) / 1000 / speedFactor,
        duration: Math.max(0.02, (event.durationMs - skippedMs) / 1000 / speedFactor),
        gain: (event.velocity ?? 127) / 127 * chordGain,
      }
    })
    harpPlayer.schedule(audioStartAt, scheduledNotes)
    scheduleMetronome(playerContext, durationMs, audioStartAt, playbackOffsetMs)
    const finishTimer = window.setTimeout(() => stopPlayback(), Math.max(0, (durationMs - playbackOffsetMs) / speedFactor))
    playbackTimers.push(finishTimer)
    const update = () => {
      updatePosition(elapsed())
      if (audioContext === playerContext) positionTimer = window.setTimeout(update, 25)
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

  speedRange?.addEventListener('input', () => setSpeed(speedRange.value))
  metronomeToggle?.addEventListener('change', () => {
    updatePosition(playbackOffsetMs)
    if (metronomeToggle.checked !== true || audioContext === undefined) return
    const elapsedMs = Math.max(0, (audioContext.currentTime - playbackStartedAtContextTime) * 1000 * speedFactor)
    const durationMs = (selectedEvents[selectedEvents.length - 1]?.startMs ?? selectedStartMs) - selectedStartMs
      + (selectedEvents[selectedEvents.length - 1]?.durationMs ?? 0)
    scheduleMetronome(audioContext, durationMs, audioContext.currentTime + 0.05, elapsedMs)
  })
  resetButton?.addEventListener('click', () => {
    stopPlayback()
    setWheelValue('from-measure', firstPosition.measureNumber)
    setWheelValue('from-pass', firstPosition.passIndex)
    readRange()
    playbackOffsetMs = 0
    updatePosition(0)
  })
  playButton?.addEventListener('click', () => {
    if (readRange() !== undefined) void playPlayback()
  })
  pauseButton?.addEventListener('click', pausePlayback)
  stopButton?.addEventListener('click', () => stopPlayback())
  takePositionButton?.addEventListener('click', () => {
    const currentPosition = positionAtTime(positionMarkers, selectedStartMs + playbackOffsetMs)
    const previousMeasure = Math.max(1, currentPosition.measureNumber - 1)
    const targetMarker = findPositionMarker(positionMarkers, {
      measureNumber: previousMeasure,
      passIndex: currentPosition.passIndex,
    }) ?? positionMarkers[0]
    if (targetMarker === undefined) return
    stopPlayback()
    setWheelValue('from-measure', targetMarker.position.measureNumber)
    setWheelValue('from-pass', targetMarker.position.passIndex)
    readRange()
    updatePosition(0)
  })
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
