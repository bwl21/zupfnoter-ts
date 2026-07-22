import type { PlaybackEvent, PlaybackMeter, PlaybackPosition, PlaybackPositionMarker } from '@zupfnoter/playback'

export interface PlaybackCountIn {
  durationMs: number
  beatDurationMs: number
  meter: PlaybackMeter
  beats: readonly number[]
  leadBeatCount: number
}

export type PlaybackCountInStyle = 'none' | 'classic' | 'band' | 'last-beats' | 'pickup'

export function parsePosition(value: string): PlaybackPosition | undefined {
  const match = value.trim().match(/^(\d+)\.(\d+)$/)
  if (match === null) return undefined
  const measureNumber = Number(match[1])
  const passIndex = Number(match[2])
  return measureNumber > 0 && passIndex > 0 ? { measureNumber, passIndex } : undefined
}

export function findPositionMarker(
  markers: readonly PlaybackPositionMarker[],
  position: PlaybackPosition,
): PlaybackPositionMarker | undefined {
  return markers.find((marker) => marker.position.measureNumber === position.measureNumber
    && marker.position.passIndex === position.passIndex)
}

export function positionAtTime(
  markers: readonly PlaybackPositionMarker[],
  timeMs: number,
): PlaybackPosition {
  let current = markers[0]?.position ?? { measureNumber: 1, passIndex: 1 }
  for (const marker of markers) {
    if (marker.timeMs > timeMs) break
    current = marker.position
  }
  return current
}

/** Returns the next measure boundary, including a terminal marker of the same position. */
export function nextPositionBoundaryMarker(
  markers: readonly PlaybackPositionMarker[],
  markerIndex: number,
): PlaybackPositionMarker | undefined {
  const marker = markers[markerIndex]
  if (marker === undefined) return undefined
  return markers.slice(markerIndex + 1).find((candidate) => (
    candidate.position.measureNumber !== marker.position.measureNumber
    || candidate.position.passIndex !== marker.position.passIndex
    || candidate.meter === undefined
  ))
}

/** Resolves one complete count-in measure at an exact playback start marker. */
export function resolveCountIn(
  markers: readonly PlaybackPositionMarker[],
  startMs: number,
  style: PlaybackCountInStyle = 'classic',
): PlaybackCountIn | undefined {
  if (style === 'none') return undefined
  const markerIndex = markers.findIndex((marker) => marker.timeMs === startMs && marker.meter !== undefined)
  if (markerIndex < 0) return undefined
  const marker = markers[markerIndex]
  if (marker === undefined || marker.meter === undefined) return undefined
  const nextMarker = nextPositionBoundaryMarker(markers, markerIndex)
  if (nextMarker === undefined) return undefined
  const durationMs = nextMarker.timeMs - marker.timeMs
  if (durationMs <= 0 || marker.meter.numerator <= 0) return undefined
  const beatCount = marker.meter.numerator
  let beatDurationMs = durationMs / beatCount
  let hasPickup = false
  let pickupBeatCount = beatCount
  if (style === 'pickup' && markerIndex === 0) {
    for (let candidateIndex = markerIndex + 1; candidateIndex < markers.length; candidateIndex += 1) {
      const candidate = markers[candidateIndex]
      if (candidate?.meter === undefined) continue
      if (candidate.meter.numerator !== marker.meter.numerator
        || candidate.meter.denominator !== marker.meter.denominator) continue
      const candidateEnd = nextPositionBoundaryMarker(markers, candidateIndex)
      if (candidateEnd === undefined) continue
      const fullMeasureDurationMs = candidateEnd.timeMs - candidate.timeMs
      hasPickup = durationMs < fullMeasureDurationMs
      if (hasPickup) {
        beatDurationMs = fullMeasureDurationMs / beatCount
        pickupBeatCount = Math.max(1, Math.min(beatCount, Math.round(durationMs / (fullMeasureDurationMs / beatCount))))
      }
      break
    }
  }
  const beats = style === 'band'
    ? [...Array.from({ length: Math.min(2, beatCount) }, (_value, index) => index), ...Array.from({ length: beatCount }, (_value, index) => index)]
    : style === 'last-beats'
      ? Array.from({ length: Math.min(2, beatCount) }, (_value, index) => beatCount - Math.min(2, beatCount) + index)
      : style === 'pickup' && hasPickup
        ? Array.from({ length: pickupBeatCount }, (_value, index) => index)
        : Array.from({ length: beatCount }, (_value, index) => index)
  return {
    durationMs: beats.length * beatDurationMs,
    beatDurationMs,
    meter: marker.meter,
    beats,
    leadBeatCount: style === 'band' ? Math.min(2, beatCount) : 0,
  }
}

/** Resolves the quarter-note tempo from the time-based meter track. */
export function tempoBpmAtTime(
  markers: readonly PlaybackPositionMarker[],
  timeMs: number,
): number | undefined {
  let markerIndex = -1
  for (const [index, marker] of markers.entries()) {
    if (marker.timeMs <= timeMs && marker.meter !== undefined) markerIndex = index
  }
  if (markerIndex < 0) return undefined
  const marker = markers[markerIndex]
  if (marker === undefined || marker.meter === undefined) return undefined
  const nextMarker = nextPositionBoundaryMarker(markers, markerIndex)
  if (nextMarker === undefined) return undefined
  const measureDurationMs = nextMarker.timeMs - marker.timeMs
  const beatDurationMs = measureDurationMs / marker.meter.numerator
  const quarterDurationMs = beatDurationMs * marker.meter.denominator / 4
  if (quarterDurationMs <= 0) return undefined
  return 60000 / quarterDurationMs
}

export function resolveRange(
  events: readonly PlaybackEvent[],
  markers: readonly PlaybackPositionMarker[],
  from: string,
): { range: [number, number]; startMs: number } | undefined {
  const start = parsePosition(from)
  if (start === undefined) return undefined
  const marker = findPositionMarker(markers, start)
  if (marker === undefined) return undefined
  const startIndex = events.findIndex((event) => event.startMs + event.durationMs > marker.timeMs)
  if (startIndex < 0) return undefined
  return { range: [startIndex, events.length - 1], startMs: marker.timeMs }
}
