import type { PlaybackMeter, PlaybackMetronomeMode, PlaybackPosition } from '@zupfnoter/playback'
import { renderPlayerIcon } from './icons.js'

export { renderPlayerIcon, type PlayerIconName } from './icons.js'

export type PlayerMetronomeMode = Exclude<PlaybackMetronomeMode, 'off'>

export interface PlayerUiCallbacks {
  onScan: () => void
  onRangeChange: (position: PlaybackPosition) => void
  onReset: () => void
  onSpeedChange: (speed: number) => void
  onMetronomeChange: (enabled: boolean) => void
  onMetronomeModeChange: (mode: PlayerMetronomeMode) => void
  onMinLeadInChange: (value: number) => void
  onBandPreCountChange: (enabled: boolean) => void
  onDivisionChange: (value: number) => void
  onSubdivisionChange: (value: number) => void
  onMetronomeVolumeChange: (value: number) => void
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
  firstPartName?: string
  hasParts?: boolean
  maximumMeasure: number
  maximumPass: number
  hasMetronomeData: boolean
  minLeadIn?: number
  bandPreCount?: boolean
  division?: number
  subdivision?: number
  metronomeVolume?: number
  baseTempoBpm?: number
  metronomeEnabled?: boolean
  metronomeMode?: PlaybackMetronomeMode
  callbacks: PlayerUiCallbacks
}

export interface PlayerUiController {
  setLoading(loading: boolean): void
  setRangeEnabled(enabled: boolean): void
  setSpeedEnabled(enabled: boolean): void
  setPlaying(playing: boolean): void
  setRangeError(message: string): void
  setRangePosition(position: PlaybackPosition): void
  setPosition(position: PlaybackPosition, partName?: string): void
  setPlaybackTime(elapsedMs: number): void
  setMetronome(meter: PlaybackMeter | undefined, beat: number, enabled: boolean): void
  setDivision(division: number): void
  setTempoBpm(bpm: number | undefined): void
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

function formatPosition(position: PlaybackPosition, partName?: string): { label: string; html: string } {
  const part = partName?.trim() || undefined
  const label = `${part === undefined ? '' : `Abschnitt ${part} · `}Takt ${position.measureNumber} · Durchlauf ${position.passIndex}`
  const partCharacters = part === undefined ? [] : Array.from(part)
  const partContent = part === undefined
    ? ''
    : partCharacters.length <= 18
      ? escapeHtml(part)
      : `<span class="position__part-start">${escapeHtml(partCharacters.slice(0, 9).join(''))}</span><span class="position__part-ellipsis" aria-hidden="true">…</span><span class="position__part-end">${escapeHtml(partCharacters.slice(-9).join(''))}</span>`
  const partField = part === undefined
    ? ''
    : `<span class="position__field position__field--part" title="${escapeHtml(part)}">${partContent}</span><span class="position__separator" aria-hidden="true">·</span>`
  return {
    label,
    html: `${partField}<span class="position__field position__field--measure"><span aria-hidden="true">|&nbsp;</span><span class="position__number">${position.measureNumber}</span><span aria-hidden="true">&nbsp;|</span></span><span class="position__separator" aria-hidden="true">·</span><span class="position__field position__field--pass"><span aria-hidden="true">#</span><span class="position__number">${position.passIndex}</span></span>`,
  }
}

function renderPosition(output: HTMLOutputElement, position: PlaybackPosition, partName?: string): void {
  const formatted = formatPosition(position, partName)
  output.innerHTML = formatted.html
  output.setAttribute('aria-label', formatted.label)
}

function numberField(name: string, label: string, value: number, maximum: number): string {
  return `<label class="range-control"><span class="wheel-label">${label}</span><input type="number" name="${name}" value="${value}" min="1" max="${maximum}" step="1" inputmode="numeric" aria-label="${label} eingeben" /></label>`
}

function setNumberValue(form: HTMLFormElement, name: string, value: number): void {
  const hidden = form.querySelector<HTMLInputElement>(`input[name="${name}"]`)
  if (hidden !== null) hidden.value = String(value)
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
  const first = formatPosition(options.firstPosition, options.firstPartName)
  const initialMetronomeMode: PlayerMetronomeMode = options.metronomeMode === 'countIn'
    || options.metronomeMode === 'playback'
    || options.metronomeMode === 'always'
    ? options.metronomeMode
    : 'always'
  container.innerHTML = `
    <section class="card">
      <div class="player-title-row">
        <h1>Zupfnoter Übung</h1>
        <button id="scan-button" class="scan-button" type="button" aria-label="Player-QR-Code scannen">
          ${renderPlayerIcon('scan', 'player-icon scan-button__icon')}
          <span>Scan</span>
        </button>
      </div>
      <p class="player-version">Player v${escapeHtml(options.playerVersion)}</p>
      ${options.identification === undefined ? '' : `<p class="identification" aria-label="Stücknummer">${escapeHtml(options.identification)}</p>`}
      <form id="range-form" class="range-form">
        <fieldset class="range-fieldset">
          <legend>Von</legend>
          ${numberField('from-measure', 'Takt', options.firstPosition.measureNumber, options.maximumMeasure)}
          <span class="wheel-dot" aria-hidden="true">·</span>
          ${numberField('from-pass', 'Durchlauf', options.firstPosition.passIndex, options.maximumPass)}
          <div class="range-actions"><button id="reset-range" type="button">Reset</button></div>
        </fieldset>
      </form>
      <p id="range-error" class="error-text" aria-live="polite"></p>
      <p id="loading-indicator" class="loading-indicator" role="status" aria-live="polite" hidden><span class="spinner" aria-hidden="true"></span> Harfenklang wird geladen …</p>
      <div class="speed-control" aria-label="Wiedergabegeschwindigkeit">
        <button id="speed-decrease" type="button" aria-label="5 BPM langsamer">${renderPlayerIcon('decrease')}</button>
        <input id="speed-input" type="number" min="1" max="999" step="1" value="${Math.round(options.baseTempoBpm ?? 120)}" inputmode="numeric" aria-label="Geschwindigkeit in BPM">
        <span>BPM</span>
        <button id="speed-increase" type="button" aria-label="5 BPM schneller">${renderPlayerIcon('increase')}</button>
      </div>
      <div class="metronome-row" aria-label="Metronom">
        <label class="metronome-control" for="metronome-toggle">
          <span class="metronome-control__label">Metronom</span>
          <span class="metronome-control__switch"><input id="metronome-toggle" type="checkbox" ${options.metronomeEnabled === true ? 'checked ' : ''}${options.hasMetronomeData ? '' : 'disabled'}><span class="metronome-switch" aria-hidden="true"></span></span>
        </label>
        <output id="metronome-status" class="metronome-status" aria-live="polite">${options.hasMetronomeData ? '<span class="metronome-beat" aria-hidden="true"></span><span>—</span><span>—</span>' : 'Metronomdaten fehlen in diesem Link'}</output>
        <button id="metronome-settings-toggle" class="metronome-settings-toggle" type="button" aria-label="Metronom-Einstellungen" aria-controls="metronome-settings" aria-expanded="false" ${options.hasMetronomeData ? '' : 'disabled'}>${renderPlayerIcon('settings')}</button>
      </div>
      <div id="metronome-settings-overlay" class="metronome-settings-overlay" hidden>
        <section id="metronome-settings" class="metronome-settings" role="dialog" aria-modal="true" aria-labelledby="metronome-settings-title">
          <header class="metronome-settings__header">
            <h2 id="metronome-settings-title">Metronom-Einstellungen</h2>
            <button id="metronome-settings-close" class="metronome-settings__close" type="button" aria-label="Metronom-Einstellungen schließen">${renderPlayerIcon('close')}</button>
          </header>
          <label class="metronome-mode">
            <span>Modus</span>
            <select id="metronome-mode" aria-label="Metronom-Modus" ${options.metronomeEnabled === true && options.hasMetronomeData ? '' : 'disabled'}>
              <option value="countIn" ${initialMetronomeMode === 'countIn' ? 'selected' : ''}>Einzählen</option>
              <option value="playback" ${initialMetronomeMode === 'playback' ? 'selected' : ''}>Wiedergabe</option>
              <option value="always" ${initialMetronomeMode === 'always' ? 'selected' : ''}>Immer</option>
            </select>
          </label>
          <div class="count-in-control">
            <label>Schläge/Takt <input id="count-division" type="number" min="1" step="1" value="${options.division ?? 4}" inputmode="numeric"></label>
            <label>Klicks/Schlag <input id="count-subdivision" type="number" min="1" step="1" value="${options.subdivision ?? 1}" inputmode="numeric"></label>
            <label>Einzählen: Mindestschläge <input id="min-lead-in" type="number" min="1" step="1" value="${options.minLeadIn ?? 4}" inputmode="numeric"></label>
            <label class="count-in-switch" for="band-pre-count">
              <span>Vorzählen</span>
              <span class="metronome-control__switch"><input id="band-pre-count" type="checkbox" ${options.bandPreCount === true ? 'checked' : ''}><span class="metronome-switch" aria-hidden="true"></span></span>
            </label>
            <label class="metronome-volume">Klicklautstärke <span><input id="metronome-volume" type="range" min="0" max="150" step="5" value="${options.metronomeVolume ?? 100}"><output id="metronome-volume-value">${options.metronomeVolume ?? 100}%</output></span></label>
          </div>
        </section>
      </div>
      <section class="transport" aria-label="Wiedergabe">
        <p class="position-label">${options.hasParts === true ? 'Abschnitt · Takt · Durchlauf' : 'Takt · Durchlauf'}</p>
        <div class="position-row">
          <output id="current-position" class="position" aria-label="${escapeHtml(first.label)}">${first.html}</output>
          <button id="take-position-button" class="take-position" type="button" title="Position übernehmen" aria-label="Position übernehmen">${renderPlayerIcon('takePosition', 'player-icon take-position__icon')}</button>
        </div>
        <p id="playback-time" class="playback-time">0:00</p>
        <div class="transport-buttons">
          <button id="play-pause-button" type="button" aria-label="Wiedergabe starten">${renderPlayerIcon('play')}</button>
          <button id="stop-button" type="button" aria-label="Wiedergabe stoppen">${renderPlayerIcon('stop')}</button>
        </div>
      </section>
    </section>`

  const form = container.querySelector<HTMLFormElement>('#range-form')
  const rangeFieldset = container.querySelector<HTMLFieldSetElement>('.range-fieldset')
  const error = container.querySelector<HTMLParagraphElement>('#range-error')
  const loadingIndicator = container.querySelector<HTMLParagraphElement>('#loading-indicator')
  const speedInput = container.querySelector<HTMLInputElement>('#speed-input')
  const speedDecrease = container.querySelector<HTMLButtonElement>('#speed-decrease')
  const speedIncrease = container.querySelector<HTMLButtonElement>('#speed-increase')
  const metronomeToggle = container.querySelector<HTMLInputElement>('#metronome-toggle')
  const metronomeSettingsToggle = container.querySelector<HTMLButtonElement>('#metronome-settings-toggle')
  const metronomeSettingsOverlay = container.querySelector<HTMLElement>('#metronome-settings-overlay')
  const metronomeSettings = container.querySelector<HTMLElement>('#metronome-settings')
  const metronomeSettingsClose = container.querySelector<HTMLButtonElement>('#metronome-settings-close')
  const metronomeMode = container.querySelector<HTMLSelectElement>('#metronome-mode')
  const minLeadIn = container.querySelector<HTMLInputElement>('#min-lead-in')
  const bandPreCount = container.querySelector<HTMLInputElement>('#band-pre-count')
  const countDivision = container.querySelector<HTMLInputElement>('#count-division')
  const countSubdivision = container.querySelector<HTMLInputElement>('#count-subdivision')
  const metronomeVolume = container.querySelector<HTMLInputElement>('#metronome-volume')
  const metronomeVolumeValue = container.querySelector<HTMLOutputElement>('#metronome-volume-value')
  const metronomeStatus = container.querySelector<HTMLOutputElement>('#metronome-status')
  const position = container.querySelector<HTMLOutputElement>('#current-position')
  const playbackTime = container.querySelector<HTMLParagraphElement>('#playback-time')
  const playPauseButton = container.querySelector<HTMLButtonElement>('#play-pause-button')
  const resetButton = container.querySelector<HTMLButtonElement>('#reset-range')
  const takePositionButton = container.querySelector<HTMLButtonElement>('#take-position-button')
  const scanButton = container.querySelector<HTMLButtonElement>('#scan-button')
  const listeners: Array<() => void> = []
  let playing = false
  let tempoBpm = options.baseTempoBpm

  const formatTempo = (speed: number): string => String(Math.max(1, Math.round((tempoBpm ?? 120) * speed)))

  const emitRange = (): void => {
    if (form === null) return
    const measure = Number(form.elements.namedItem('from-measure') instanceof HTMLInputElement ? (form.elements.namedItem('from-measure') as HTMLInputElement).value : 1)
    const pass = Number(form.elements.namedItem('from-pass') instanceof HTMLInputElement ? (form.elements.namedItem('from-pass') as HTMLInputElement).value : 1)
    if (Number.isInteger(measure) && Number.isInteger(pass) && measure > 0 && pass > 0) callbacks.onRangeChange({ measureNumber: measure, passIndex: pass })
  }

  for (const input of container.querySelectorAll<HTMLInputElement>('.range-control input')) {
    input.addEventListener('change', emitRange)
    listeners.push(() => input.removeEventListener('change', emitRange))
  }

  const onSpeed = (): void => {
    const bpm = Number(speedInput?.value ?? tempoBpm ?? 120)
    if (!Number.isFinite(bpm) || bpm <= 0) return
    if (speedInput !== null) speedInput.value = String(Math.round(bpm))
    callbacks.onSpeedChange(bpm / (tempoBpm ?? 120))
  }
  speedInput?.addEventListener('change', onSpeed)
  if (speedInput !== null) listeners.push(() => speedInput.removeEventListener('change', onSpeed))
  const adjustSpeed = (delta: number): void => {
    if (speedInput === null) return
    speedInput.value = String(Math.max(1, Number(speedInput.value || Math.round(tempoBpm ?? 120)) + delta))
    onSpeed()
  }
  speedDecrease?.addEventListener('click', () => adjustSpeed(-5))
  speedIncrease?.addEventListener('click', () => adjustSpeed(5))
  const onMetronome = (): void => {
    const enabled = metronomeToggle?.checked === true
    if (metronomeMode !== null) metronomeMode.disabled = !enabled || !options.hasMetronomeData
    callbacks.onMetronomeChange(enabled)
  }
  metronomeToggle?.addEventListener('change', onMetronome)
  if (metronomeToggle !== null) listeners.push(() => metronomeToggle.removeEventListener('change', onMetronome))
  const onMetronomeMode = (): void => {
    const mode = metronomeMode?.value
    if (mode === 'countIn' || mode === 'playback' || mode === 'always') callbacks.onMetronomeModeChange(mode)
  }
  metronomeMode?.addEventListener('change', onMetronomeMode)
  if (metronomeMode !== null) listeners.push(() => metronomeMode.removeEventListener('change', onMetronomeMode))
  const setMetronomeSettingsOpen = (open: boolean): void => {
    if (metronomeSettingsOverlay === null || metronomeSettingsToggle === null) return
    metronomeSettingsOverlay.hidden = !open
    metronomeSettingsToggle.setAttribute('aria-expanded', String(open))
    if (open) metronomeSettingsClose?.focus()
    else metronomeSettingsToggle.focus()
  }
  const onMetronomeSettings = (): void => setMetronomeSettingsOpen(metronomeSettingsOverlay?.hidden === true)
  metronomeSettingsToggle?.addEventListener('click', onMetronomeSettings)
  if (metronomeSettingsToggle !== null) listeners.push(() => metronomeSettingsToggle.removeEventListener('click', onMetronomeSettings))
  const onMetronomeSettingsClose = (): void => setMetronomeSettingsOpen(false)
  metronomeSettingsClose?.addEventListener('click', onMetronomeSettingsClose)
  if (metronomeSettingsClose !== null) listeners.push(() => metronomeSettingsClose.removeEventListener('click', onMetronomeSettingsClose))
  const onMetronomeSettingsOverlay = (event: MouseEvent): void => {
    if (event.target === metronomeSettingsOverlay) setMetronomeSettingsOpen(false)
  }
  metronomeSettingsOverlay?.addEventListener('click', onMetronomeSettingsOverlay)
  if (metronomeSettingsOverlay !== null) listeners.push(() => metronomeSettingsOverlay.removeEventListener('click', onMetronomeSettingsOverlay))
  const onMetronomeSettingsKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') setMetronomeSettingsOpen(false)
  }
  metronomeSettings?.addEventListener('keydown', onMetronomeSettingsKeydown)
  if (metronomeSettings !== null) listeners.push(() => metronomeSettings.removeEventListener('keydown', onMetronomeSettingsKeydown))
  const bindPositiveInteger = (element: HTMLInputElement | null, callback: (value: number) => void): void => {
    if (element === null) return
    const onChange = (): void => {
      const value = Math.floor(Number(element.value))
      if (!Number.isSafeInteger(value) || value < 1) return
      element.value = String(value)
      callback(value)
    }
    element.addEventListener('change', onChange)
    listeners.push(() => element.removeEventListener('change', onChange))
  }
  bindPositiveInteger(minLeadIn, callbacks.onMinLeadInChange)
  bindPositiveInteger(countDivision, callbacks.onDivisionChange)
  bindPositiveInteger(countSubdivision, callbacks.onSubdivisionChange)
  const onMetronomeVolume = (): void => {
    const value = Number(metronomeVolume?.value ?? 100)
    if (!Number.isFinite(value) || value < 0 || value > 150) return
    if (metronomeVolumeValue !== null) metronomeVolumeValue.textContent = `${value}%`
    callbacks.onMetronomeVolumeChange(value / 100)
  }
  metronomeVolume?.addEventListener('input', onMetronomeVolume)
  if (metronomeVolume !== null) listeners.push(() => metronomeVolume.removeEventListener('input', onMetronomeVolume))
  const onBandPreCount = (): void => callbacks.onBandPreCountChange(bandPreCount?.checked === true)
  bandPreCount?.addEventListener('change', onBandPreCount)
  if (bandPreCount !== null) listeners.push(() => bandPreCount.removeEventListener('change', onBandPreCount))
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
    },
    setSpeedEnabled(enabled) {
      if (speedInput !== null) speedInput.disabled = !enabled
      if (speedDecrease !== null) speedDecrease.disabled = !enabled
      if (speedIncrease !== null) speedIncrease.disabled = !enabled
      if (metronomeSettingsToggle !== null) metronomeSettingsToggle.disabled = !enabled || !options.hasMetronomeData
      if (metronomeMode !== null) metronomeMode.disabled = !enabled || !options.hasMetronomeData || metronomeToggle?.checked !== true
      for (const input of [minLeadIn, bandPreCount, countDivision, countSubdivision, metronomeVolume]) {
        if (input !== null) input.disabled = !enabled || !options.hasMetronomeData
      }
    },
    setPlaying(nextPlaying) {
      playing = nextPlaying
      if (playPauseButton !== null) {
        playPauseButton.innerHTML = renderPlayerIcon(nextPlaying ? 'pause' : 'play')
        playPauseButton.setAttribute('aria-label', nextPlaying ? 'Wiedergabe pausieren' : 'Wiedergabe starten')
      }
    },
    setRangeError(message) {
      if (error !== null) error.textContent = message
    },
    setRangePosition(nextPosition) {
      if (form === null) return
      setNumberValue(form, 'from-measure', nextPosition.measureNumber)
      setNumberValue(form, 'from-pass', nextPosition.passIndex)
    },
    setPosition(nextPosition, partName) {
      if (position !== null) renderPosition(position, nextPosition, partName)
    },
    setPlaybackTime(elapsedMs) {
      if (playbackTime === null) return
      const seconds = Math.floor(Math.max(0, elapsedMs) / 1000)
      playbackTime.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    },
    setMetronome(meter, beat, enabled) {
      if (metronomeStatus !== null) renderBeatStatus(metronomeStatus, meter, beat, enabled)
    },
    setDivision(division) {
      if (countDivision !== null) countDivision.value = String(division)
    },
    setTempoBpm(bpm) {
      tempoBpm = bpm
      const speed = Number(speedInput?.value ?? tempoBpm ?? 120) / (tempoBpm ?? 120)
      if (speedInput !== null) speedInput.value = formatTempo(speed)
    },
    destroy() {
      for (const removeListener of listeners) removeListener()
      container.replaceChildren()
    },
  }
}
