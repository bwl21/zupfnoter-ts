export type PlaybackMetronomeSoundKind = 'regular' | 'accent' | 'subdivision' | 'pre-count' | 'entry'
export type PlaybackMetronomeEventKind = 'PRE_COUNT' | 'BAR_START' | 'MAIN_BEAT' | 'SUBDIVISION'

export interface PlaybackMetronomeSound {
  /** Oscillator frequency in hertz. */
  frequencyHz: number
  /** Initial linear gain before the shared exponential decay. */
  gain: number
}

const CLICK_DECAY_SECONDS = 0.055
const CLICK_DURATION_SECONDS = 0.06
const CLICK_END_GAIN = 0.001

const METRONOME_SOUNDS: Record<PlaybackMetronomeSoundKind, PlaybackMetronomeSound> = {
  regular: { frequencyHz: 850, gain: 0.22 },
  accent: { frequencyHz: 1200, gain: 0.34 },
  subdivision: { frequencyHz: 650, gain: 0.11 },
  entry: { frequencyHz: 1500, gain: 0.3 },
  'pre-count': { frequencyHz: 1800, gain: 0.22 },
}

/** Returns the shared oscillator profile used by Practice and Workbench. */
export function resolvePlaybackMetronomeSound(kind: PlaybackMetronomeSoundKind): PlaybackMetronomeSound {
  return METRONOME_SOUNDS[kind]
}

/** Schedules one click with the shared sound profile and envelope. */
export function schedulePlaybackMetronomeClick(
  context: BaseAudioContext,
  startTime: number,
  kind: PlaybackMetronomeSoundKind,
  destination: AudioNode = context.destination,
): OscillatorNode {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const sound = resolvePlaybackMetronomeSound(kind)
  oscillator.frequency.value = sound.frequencyHz
  gain.gain.setValueAtTime(sound.gain, startTime)
  gain.gain.exponentialRampToValueAtTime(CLICK_END_GAIN, startTime + CLICK_DECAY_SECONDS)
  oscillator.connect(gain)
  gain.connect(destination)
  oscillator.start(startTime)
  oscillator.stop(startTime + CLICK_DURATION_SECONDS)
  return oscillator
}

/** Maps a semantic metronome event to its audible role; the entry signal has priority. */
export function resolvePlaybackMetronomeEventSound(
  kind: PlaybackMetronomeEventKind,
  isLastBeforeEntry = false,
): PlaybackMetronomeSoundKind {
  if (isLastBeforeEntry) return 'entry'
  if (kind === 'PRE_COUNT') return 'pre-count'
  if (kind === 'BAR_START') return 'accent'
  if (kind === 'SUBDIVISION') return 'subdivision'
  return 'regular'
}
