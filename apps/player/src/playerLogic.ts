import type { PlaybackEvent, PlaybackMeter, PlaybackPosition, PlaybackPositionMarker } from '@zupfnoter/playback'

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
    || candidate.meter !== marker.meter
  ))
}

/** Resolves the quarter-note tempo from the time-based meter track. */
export function tempoBpmAtTime(
  markers: readonly PlaybackPositionMarker[],
  timeMs: number,
  explicitTempoBpm?: number,
): number | undefined {
  if (explicitTempoBpm !== undefined && Number.isFinite(explicitTempoBpm) && explicitTempoBpm > 0) {
    return explicitTempoBpm
  }
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

export interface PickupMetronomeState {
  meter: PlaybackMeter
  beat: number
  beatDurationMs: number
}

/** Resolves the metrical phase of an unmetered opening pickup. */
export function pickupMetronomeStateAtTime(
  markers: readonly PlaybackPositionMarker[],
  timeMs: number,
  tempoBpm?: number,
  tempoUnit = 0.25,
): PickupMetronomeState | undefined {
  const opening = markers[0]
  const firstMeterIndex = markers.findIndex((marker, index) => index > 0
    && marker.meter !== undefined
    && opening !== undefined
    && marker.position.measureNumber === opening.position.measureNumber
    && marker.position.passIndex === opening.position.passIndex)
  const metered = firstMeterIndex >= 0 ? markers[firstMeterIndex] : undefined
  if (opening === undefined || opening.meter !== undefined || metered?.meter === undefined
    || timeMs < opening.timeMs || timeMs >= metered.timeMs) return undefined
  const beatDurationMs = tempoBpm !== undefined && tempoBpm > 0
    ? 60000 / tempoBpm / (tempoUnit * metered.meter.denominator)
    : metered.timeMs - opening.timeMs
  if (beatDurationMs <= 0) return undefined
  const pickupBeatCount = Math.max(1, Math.min(metered.meter.numerator,
    Math.round((metered.timeMs - opening.timeMs) / beatDurationMs)))
  return {
    meter: metered.meter,
    beat: Math.max(1, metered.meter.numerator - pickupBeatCount + 1),
    beatDurationMs,
  }
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
