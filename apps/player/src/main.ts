import {
  decodePlaybackFragment,
  type PlaybackCompressionCodec,
  type PlaybackEvent,
} from '@zupfnoter/playback'
import { deflateSync, inflateSync } from 'fflate'
import './style.css'

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
  app.innerHTML = `<section class="card error"><h1>Zupfnoter Playback</h1><p>${message}</p></section>`
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

function wheelField(name: string, label: string, value: number, maximum: number): string {
  if (maximum <= 1) return `<input type="hidden" name="${name}" value="1" />`
  const options = Array.from({ length: maximum }, (_, index) => {
    const option = index + 1
    return `<span class="wheel-option" data-value="${option}">${option}</span>`
  }).join('')
  return `<div class="wheel-control"><span class="wheel-label">${label}</span><div class="wheel" data-wheel="${name}" tabindex="0" role="spinbutton" aria-label="${label}" aria-valuemin="1" aria-valuemax="${maximum}" aria-valuenow="${value}"><div class="wheel-options">${options}</div></div><input type="hidden" name="${name}" value="${value}" /></div>`
}

function parsePosition(value: string): { measureNumber: number; passIndex: number } | undefined {
  const match = value.trim().match(/^(\d+)\.(\d+)$/)
  if (match === null) return undefined
  const measureNumber = Number(match[1])
  const passIndex = Number(match[2])
  return measureNumber > 0 && passIndex > 0 ? { measureNumber, passIndex } : undefined
}

function resolveRange(events: readonly PlaybackEvent[], from: string, to: string): [number, number] | undefined {
  const start = parsePosition(from)
  const end = parsePosition(to)
  if (start === undefined || end === undefined) return undefined
  const startIndex = events.findIndex((event) => event.position.measureNumber === start.measureNumber && event.position.passIndex === start.passIndex)
  const endIndex = [...events].reverse().findIndex((event) => event.position.measureNumber === end.measureNumber && event.position.passIndex === end.passIndex)
  if (startIndex < 0 || endIndex < 0) return undefined
  const resolvedEnd = events.length - endIndex - 1
  return startIndex <= resolvedEnd ? [startIndex, resolvedEnd] : undefined
}

function renderPlayer(events: PlaybackEvent[], identification?: string): void {
  const first = eventLabel(events[0]) === '—' ? '1.1' : eventLabel(events[0])
  const last = eventLabel(events[events.length - 1]) === '—' ? first : eventLabel(events[events.length - 1])
  const firstPosition = eventPosition(events[0])
  const maximumMeasure = Math.max(1, ...events.map((event) => event.position.measureNumber))
  const maximumPass = Math.max(1, ...events.map((event) => event.position.passIndex))
  app.innerHTML = `
    <section class="card">
      <h1>Zupfnoter Playback</h1>
      ${identification === undefined ? '' : `<p class="identification" aria-label="Stücknummer">${escapeHtml(identification)}</p>`}
      <form id="range-form" class="range-form">
        <fieldset class="range-fieldset">
          <legend>Von</legend>
          ${wheelField('from-measure', 'Takt', firstPosition.measureNumber, maximumMeasure)}
          <span class="wheel-dot" aria-hidden="true">${maximumPass > 1 ? '.' : ''}</span>
          ${wheelField('from-pass', 'Durchlauf', firstPosition.passIndex, maximumPass)}
        </fieldset>
        <button id="reset-range" type="button">Bereich zurücksetzen</button>
      </form>
      <p id="range-error" class="error-text" aria-live="polite"></p>
      <section class="transport" aria-label="Wiedergabe">
        <p class="position-label">Position</p>
        <output id="current-position" class="position">${first}</output>
        <p id="playback-time" class="playback-time">0:00</p>
        <div class="transport-buttons">
          <button id="play-button" type="button" aria-label="Wiedergabe starten">▶</button>
          <button id="pause-button" type="button" aria-label="Wiedergabe pausieren">Ⅱ</button>
          <button id="stop-button" type="button" aria-label="Wiedergabe stoppen">■</button>
        </div>
      <button id="take-position-button" class="take-position" type="button">Position übernehmen</button>
      </section>
    </section>`

  const form = document.querySelector<HTMLFormElement>('#range-form')
  const error = document.querySelector<HTMLParagraphElement>('#range-error')
  const position = document.querySelector<HTMLOutputElement>('#current-position')
  const playbackTime = document.querySelector<HTMLParagraphElement>('#playback-time')
  const playButton = document.querySelector<HTMLButtonElement>('#play-button')
  const pauseButton = document.querySelector<HTMLButtonElement>('#pause-button')
  const stopButton = document.querySelector<HTMLButtonElement>('#stop-button')
  const takePositionButton = document.querySelector<HTMLButtonElement>('#take-position-button')
  const resetButton = document.querySelector<HTMLButtonElement>('#reset-range')
  let selectedEvents = events

  function readRange(): [number, number] | undefined {
    if (form === null) return undefined
    const data = new FormData(form)
    const from = `${String(data.get('from-measure') ?? '')}.${String(data.get('from-pass') ?? '')}`
    const to = eventLabel(events[events.length - 1])
    const range = resolveRange(events, from, to)
    if (range === undefined) {
      if (error !== null) error.textContent = 'Der Bereich wurde im Playback nicht gefunden.'
      return undefined
    }
    if (error !== null) error.textContent = ''
    selectedEvents = events.slice(range[0], range[1] + 1)
    return range
  }

  function setWheelValue(name: string, value: number): void {
    const hidden = form?.querySelector<HTMLInputElement>(`input[name="${name}"]`)
    const wheel = document.querySelector<HTMLElement>(`[data-wheel="${name}"]`)
    if (hidden !== null && hidden !== undefined) hidden.value = String(value)
    if (wheel !== null) {
      wheel.scrollTop = Math.max(0, value - 1) * 36
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
    wheel.scrollTop = Math.max(0, currentValue - 1) * 36
    let snapTimer: number | undefined
    wheel.addEventListener('scroll', () => {
      const index = Math.round(wheel.scrollTop / 36)
      const option = options[index]
      if (option === undefined || hidden === undefined) return
      hidden.value = option.dataset.value ?? '1'
      wheel.setAttribute('aria-valuenow', hidden.value)
      readRange()
      if (snapTimer !== undefined) window.clearTimeout(snapTimer)
      snapTimer = window.setTimeout(() => {
        const snappedIndex = Math.max(0, Math.min(options.length - 1, Math.round(wheel.scrollTop / 36)))
        wheel.scrollTo({ top: snappedIndex * 36, behavior: 'smooth' })
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
  let playbackOffsetMs = 0
  let playbackStartedAtMs = 0
  let currentEvent: PlaybackEvent | undefined
  let isPaused = false

  function clearPlaybackTimers(): void {
    for (const timer of playbackTimers) window.clearTimeout(timer)
    playbackTimers = []
    if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame)
    animationFrame = undefined
  }

  function updatePosition(elapsedMs: number): void {
    currentEvent = selectedEvents.filter((event) => event.startMs - (selectedEvents[0]?.startMs ?? 0) <= elapsedMs).at(-1)
    if (position !== null) position.value = eventLabel(currentEvent)
    if (takePositionButton !== null) {
      takePositionButton.textContent = `Position übernehmen · ${eventLabel(currentEvent)}`
    }
    if (playbackTime !== null) {
      const seconds = Math.floor(Math.max(0, elapsedMs) / 1000)
      playbackTime.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    }
  }

  function stopPlayback(reset = true): void {
    clearPlaybackTimers()
    if (audioContext !== undefined) void audioContext.close()
    audioContext = undefined
    isPaused = false
    if (reset) playbackOffsetMs = 0
    updatePosition(playbackOffsetMs)
  }

  function playPlayback(): void {
    if (selectedEvents.length === 0) return
    stopPlayback(false)
    const base = selectedEvents[0]?.startMs ?? 0
    const end = (selectedEvents[selectedEvents.length - 1]?.startMs ?? base) - base
      + (selectedEvents[selectedEvents.length - 1]?.durationMs ?? 0)
    if (playbackOffsetMs >= end) playbackOffsetMs = 0
    const AudioContextClass = window.AudioContext
    audioContext = new AudioContextClass()
    isPaused = false
    const startedAt = performance.now()
    playbackStartedAtMs = startedAt - playbackOffsetMs
    const elapsed = () => performance.now() - playbackStartedAtMs
    for (const event of selectedEvents) {
      const eventOffset = event.startMs - base
      const delay = Math.max(0, eventOffset - playbackOffsetMs)
      const timer = window.setTimeout(() => {
        if (audioContext === undefined) return
        const oscillator = audioContext.createOscillator()
        const gain = audioContext.createGain()
        const skippedMs = Math.max(0, playbackOffsetMs - eventOffset)
        oscillator.frequency.value = 440 * 2 ** ((event.pitch - 69) / 12)
        gain.gain.value = (event.velocity ?? 127) / 127 * 0.12
        oscillator.connect(gain).connect(audioContext.destination)
        oscillator.start()
        oscillator.stop(audioContext.currentTime + Math.max(0.02, (event.durationMs - skippedMs) / 1000))
      }, delay)
      playbackTimers.push(timer)
    }
    const finishTimer = window.setTimeout(() => stopPlayback(), Math.max(0, end - playbackOffsetMs))
    playbackTimers.push(finishTimer)
    const animate = () => {
      updatePosition(elapsed())
      if (audioContext !== undefined) animationFrame = window.requestAnimationFrame(animate)
    }
    animationFrame = window.requestAnimationFrame(animate)
  }

  function pausePlayback(): void {
    if (audioContext === undefined) return
    playbackOffsetMs = Math.max(0, performance.now() - playbackStartedAtMs)
    stopPlayback(false)
    isPaused = true
  }

  resetButton?.addEventListener('click', () => {
    stopPlayback()
    setWheelValue('from-measure', firstPosition.measureNumber)
    setWheelValue('from-pass', firstPosition.passIndex)
    readRange()
    playbackOffsetMs = 0
    updatePosition(0)
  })
  playButton?.addEventListener('click', () => {
    if (readRange() !== undefined) playPlayback()
  })
  pauseButton?.addEventListener('click', pausePlayback)
  stopButton?.addEventListener('click', () => stopPlayback())
  takePositionButton?.addEventListener('click', () => {
    const referenceEvent = currentEvent ?? selectedEvents[0] ?? events[0]
    if (referenceEvent === undefined) return
    const previousMeasure = Math.max(1, referenceEvent.position.measureNumber - 1)
    const target = events.find((event) => (
      event.position.measureNumber === previousMeasure
      && event.position.passIndex === referenceEvent.position.passIndex
    )) ?? referenceEvent
    stopPlayback()
    setWheelValue('from-measure', target.position.measureNumber)
    setWheelValue('from-pass', target.position.passIndex)
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
    renderPlayer(decoded.events, identification)
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error))
  }
}

void main()
