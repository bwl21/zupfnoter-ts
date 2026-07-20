import type { PlaybackMeter, PlaybackPosition } from '@zupfnoter/playback'

export interface PlayerUiCallbacks {
  onScan: () => void
  onRangeChange: (position: PlaybackPosition) => void
  onReset: () => void
  onSpeedChange: (speed: number) => void
  onMetronomeChange: (enabled: boolean) => void
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onTakePosition: () => void
}

export interface PlayerUiOptions {
  container: HTMLElement
  playerVersion: string
  identification?: string
  firstPosition: PlaybackPosition
  maximumMeasure: number
  maximumPass: number
  hasMetronomeData: boolean
  callbacks: PlayerUiCallbacks
}

export interface PlayerUiController {
  setLoading(loading: boolean): void
  setRangeEnabled(enabled: boolean): void
  setSpeedEnabled(enabled: boolean): void
  setPlaying(playing: boolean): void
  setRangeError(message: string): void
  setRangePosition(position: PlaybackPosition): void
  setPosition(position: PlaybackPosition): void
  setPlaybackTime(elapsedMs: number): void
  setMetronome(meter: PlaybackMeter | undefined, beat: number, enabled: boolean): void
  destroy(): void
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

function formatPosition(position: PlaybackPosition): string {
  return `${position.measureNumber} [${position.passIndex}]`
}

function wheelField(name: string, label: string, value: number, maximum: number): string {
  if (maximum <= 1) return `<input type="hidden" name="${name}" value="1" />`
  const options = Array.from({ length: maximum }, (_value, index) => {
    const option = index + 1
    return `<span class="wheel-option" data-value="${option}">${option}</span>`
  }).join('')
  return `<div class="wheel-control"><span class="wheel-label">${label}</span><div class="wheel" data-wheel="${name}" tabindex="0" role="spinbutton" aria-label="${label}" aria-valuemin="1" aria-valuemax="${maximum}" aria-valuenow="${value}"><div class="wheel-options">${options}</div><input class="wheel-entry" type="number" name="${name}" value="${value}" min="1" max="${maximum}" inputmode="numeric" aria-label="${label} eingeben" /></div></div>`
}

function setWheelValue(form: HTMLFormElement, name: string, value: number): void {
  const hidden = form.querySelector<HTMLInputElement>(`input[name="${name}"]`)
  const wheel = form.querySelector<HTMLElement>(`[data-wheel="${name}"]`)
  if (hidden !== null) hidden.value = String(value)
  if (wheel !== null) {
    const option = [...wheel.querySelectorAll<HTMLElement>('.wheel-option')][value - 1]
    wheel.scrollTop = option?.offsetTop ?? 0
    wheel.setAttribute('aria-valuenow', String(value))
  }
}

function renderBeatStatus(status: HTMLOutputElement, meter: PlaybackMeter | undefined, beat: number, enabled: boolean): void {
  if (meter === undefined) {
    status.textContent = 'Metronomdaten fehlen in diesem Link'
    return
  }
  const groupingStarts = new Set<number>()
  let groupingOffset = 0
  for (const group of meter.grouping ?? []) {
    groupingStarts.add(groupingOffset)
    groupingOffset += group
  }
  const beatDots = Array.from({ length: meter.numerator }, (_value, index) => {
    const active = enabled && index + 1 === beat
    const activeClass = active ? ' metronome-beat--active' : ''
    const accentClass = active && (index === 0 || groupingStarts.has(index)) ? ' metronome-beat--accent' : ''
    return `<span class="metronome-beat${accentClass}${activeClass}" aria-hidden="true"></span>`
  }).join('')
  status.innerHTML = `<span class="metronome-beats" aria-hidden="true">${beatDots}</span><span class="metronome-count">${beat}</span><span>${meter.numerator}/${meter.denominator}</span>`
}

export function mountPlayerUi(options: PlayerUiOptions): PlayerUiController {
  const { container, callbacks } = options
  const first = formatPosition(options.firstPosition)
  container.innerHTML = `
    <section class="card">
      <div class="player-title-row">
        <h1>Zupfnoter Übung</h1>
        <button id="scan-button" class="scan-button" type="button" aria-label="Player-QR-Code scannen">
          <svg class="scan-button__icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4ZM8 8h3v3H8V8Zm5 0h3v3h-3V8Zm-5 5h3v3H8v-3Zm5 0h3v3h-3v-3Z"/></svg>
          <span>Scan</span>
        </button>
      </div>
      <p class="player-version">Player v${escapeHtml(options.playerVersion)}</p>
      ${options.identification === undefined ? '' : `<p class="identification" aria-label="Stücknummer">${escapeHtml(options.identification)}</p>`}
      <form id="range-form" class="range-form">
        <fieldset class="range-fieldset">
          <legend>Von</legend>
          ${wheelField('from-measure', 'Takt', options.firstPosition.measureNumber, options.maximumMeasure)}
          <span class="wheel-dot" aria-hidden="true">${options.maximumPass > 1 ? '.' : ''}</span>
          ${wheelField('from-pass', 'Durchlauf', options.firstPosition.passIndex, options.maximumPass)}
          <div class="range-actions"><button id="reset-range" type="button">Reset</button></div>
        </fieldset>
      </form>
      <p id="range-error" class="error-text" aria-live="polite"></p>
      <p id="loading-indicator" class="loading-indicator" role="status" aria-live="polite" hidden><span class="spinner" aria-hidden="true"></span> Harfenklang wird geladen …</p>
      <label class="speed-control" for="speed-range">
        <input id="speed-range" type="range" min="0.5" max="1.5" step="0.05" value="1" aria-label="Wiedergabegeschwindigkeit" aria-valuemin="0.5" aria-valuemax="1.5" aria-valuenow="1">
        <output id="speed-value" for="speed-range">1,00×</output>
      </label>
      <div class="metronome-row" aria-label="Metronom">
        <label class="metronome-control" for="metronome-toggle">
          <input id="metronome-toggle" type="checkbox" ${options.hasMetronomeData ? '' : 'disabled'}>
          <span class="metronome-switch" aria-hidden="true"></span>
          <span class="sr-only">Metronom</span>
        </label>
        <output id="metronome-status" class="metronome-status" aria-live="polite">${options.hasMetronomeData ? '<span class="metronome-beat" aria-hidden="true"></span><span>—</span><span>—</span>' : 'Metronomdaten fehlen in diesem Link'}</output>
      </div>
      <section class="transport" aria-label="Wiedergabe">
        <div class="position-row">
          <output id="current-position" class="position">${first}</output>
          <button id="take-position-button" class="take-position" type="button" title="Position übernehmen" aria-label="Position übernehmen"><span class="take-position__icon" aria-hidden="true">◎</span></button>
        </div>
        <p id="playback-time" class="playback-time">0:00</p>
        <div class="transport-buttons">
          <button id="play-pause-button" type="button" aria-label="Wiedergabe starten">▶</button>
          <button id="stop-button" type="button" aria-label="Wiedergabe stoppen">■</button>
        </div>
      </section>
    </section>`

  const form = container.querySelector<HTMLFormElement>('#range-form')
  const rangeFieldset = container.querySelector<HTMLFieldSetElement>('.range-fieldset')
  const error = container.querySelector<HTMLParagraphElement>('#range-error')
  const loadingIndicator = container.querySelector<HTMLParagraphElement>('#loading-indicator')
  const speedRange = container.querySelector<HTMLInputElement>('#speed-range')
  const speedValue = container.querySelector<HTMLOutputElement>('#speed-value')
  const metronomeToggle = container.querySelector<HTMLInputElement>('#metronome-toggle')
  const metronomeStatus = container.querySelector<HTMLOutputElement>('#metronome-status')
  const position = container.querySelector<HTMLOutputElement>('#current-position')
  const playbackTime = container.querySelector<HTMLParagraphElement>('#playback-time')
  const playPauseButton = container.querySelector<HTMLButtonElement>('#play-pause-button')
  const resetButton = container.querySelector<HTMLButtonElement>('#reset-range')
  const takePositionButton = container.querySelector<HTMLButtonElement>('#take-position-button')
  const scanButton = container.querySelector<HTMLButtonElement>('#scan-button')
  const listeners: Array<() => void> = []
  let playing = false

  const emitRange = (): void => {
    if (form === null) return
    const measure = Number(form.elements.namedItem('from-measure') instanceof HTMLInputElement ? (form.elements.namedItem('from-measure') as HTMLInputElement).value : 1)
    const pass = Number(form.elements.namedItem('from-pass') instanceof HTMLInputElement ? (form.elements.namedItem('from-pass') as HTMLInputElement).value : 1)
    if (Number.isInteger(measure) && Number.isInteger(pass) && measure > 0 && pass > 0) callbacks.onRangeChange({ measureNumber: measure, passIndex: pass })
  }

  for (const wheel of container.querySelectorAll<HTMLElement>('[data-wheel]')) {
    const name = wheel.dataset.wheel
    const hidden = name === undefined ? undefined : form?.querySelector<HTMLInputElement>(`input[name="${name}"]`)
    const options = [...wheel.querySelectorAll<HTMLElement>('.wheel-option')]
    const currentValue = Number(hidden?.value ?? 1)
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
    const onInput = (): void => {
      const value = Number(hidden?.value ?? 0)
      if (!Number.isInteger(value) || value < 1 || value > options.length) return
      const option = options[value - 1]
      wheel.scrollTo({ top: option?.offsetTop ?? 0, behavior: 'smooth' })
      wheel.setAttribute('aria-valuenow', String(value))
      emitRange()
    }
    hidden?.addEventListener('input', onInput)
    if (hidden !== undefined && hidden !== null) listeners.push(() => hidden.removeEventListener('input', onInput))
    const onScroll = (): void => {
      const option = options[nearestOptionIndex()]
      if (option === undefined || hidden === undefined || hidden === null) return
      hidden.value = option.dataset.value ?? '1'
      wheel.setAttribute('aria-valuenow', hidden.value)
      emitRange()
      if (snapTimer !== undefined) window.clearTimeout(snapTimer)
      snapTimer = window.setTimeout(() => {
        const snappedOption = options[Math.max(0, Math.min(options.length - 1, nearestOptionIndex()))]
        wheel.scrollTo({ top: snappedOption?.offsetTop ?? 0, behavior: 'smooth' })
        if (snappedOption !== undefined && hidden !== null) {
          hidden.value = snappedOption.dataset.value ?? '1'
          wheel.setAttribute('aria-valuenow', hidden.value)
          emitRange()
        }
      }, 90)
    }
    wheel.addEventListener('scroll', onScroll, { passive: true })
    listeners.push(() => wheel.removeEventListener('scroll', onScroll))
  }

  const onSpeed = (): void => {
    const speed = Number(speedRange?.value ?? 1)
    if (speedValue !== null) speedValue.value = `${speed.toFixed(2).replace('.', ',')}×`
    speedRange?.setAttribute('aria-valuenow', String(speed))
    callbacks.onSpeedChange(speed)
  }
  speedRange?.addEventListener('input', onSpeed)
  if (speedRange !== null) listeners.push(() => speedRange.removeEventListener('input', onSpeed))
  const onMetronome = (): void => callbacks.onMetronomeChange(metronomeToggle?.checked === true)
  metronomeToggle?.addEventListener('change', onMetronome)
  if (metronomeToggle !== null) listeners.push(() => metronomeToggle.removeEventListener('change', onMetronome))
  const bindClick = (element: HTMLButtonElement | null, callback: () => void): void => {
    if (element === null) return
    element.addEventListener('click', callback)
    listeners.push(() => element.removeEventListener('click', callback))
  }
  bindClick(resetButton, callbacks.onReset)
  bindClick(playPauseButton, () => {
    if (playing) callbacks.onPause()
    else callbacks.onPlay()
  })
  bindClick(container.querySelector<HTMLButtonElement>('#stop-button'), callbacks.onStop)
  bindClick(takePositionButton, callbacks.onTakePosition)
  bindClick(scanButton, callbacks.onScan)

  return {
    setLoading(loading) {
      if (loadingIndicator !== null) loadingIndicator.hidden = !loading
      if (playPauseButton !== null) {
        playPauseButton.disabled = loading
        playPauseButton.setAttribute('aria-busy', String(loading))
      }
    },
    setRangeEnabled(enabled) {
      if (rangeFieldset !== null) rangeFieldset.disabled = !enabled
      if (form !== null) form.classList.toggle('range-form--disabled', !enabled)
      for (const wheel of container.querySelectorAll<HTMLElement>('[data-wheel]')) {
        wheel.tabIndex = enabled ? 0 : -1
        wheel.setAttribute('aria-disabled', String(!enabled))
      }
    },
    setSpeedEnabled(enabled) {
      if (speedRange !== null) speedRange.disabled = !enabled
    },
    setPlaying(nextPlaying) {
      playing = nextPlaying
      if (playPauseButton !== null) {
        playPauseButton.textContent = nextPlaying ? 'Ⅱ' : '▶'
        playPauseButton.setAttribute('aria-label', nextPlaying ? 'Wiedergabe pausieren' : 'Wiedergabe starten')
      }
    },
    setRangeError(message) {
      if (error !== null) error.textContent = message
    },
    setRangePosition(nextPosition) {
      if (form === null) return
      setWheelValue(form, 'from-measure', nextPosition.measureNumber)
      setWheelValue(form, 'from-pass', nextPosition.passIndex)
    },
    setPosition(nextPosition) {
      if (position !== null) position.value = formatPosition(nextPosition)
    },
    setPlaybackTime(elapsedMs) {
      if (playbackTime === null) return
      const seconds = Math.floor(Math.max(0, elapsedMs) / 1000)
      playbackTime.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    },
    setMetronome(meter, beat, enabled) {
      if (metronomeStatus !== null) renderBeatStatus(metronomeStatus, meter, beat, enabled)
    },
    destroy() {
      for (const removeListener of listeners) removeListener()
      container.replaceChildren()
    },
  }
}
