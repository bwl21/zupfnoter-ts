import type { PlaybackEvent, PlaybackMeter, PlaybackPosition, PlaybackPositionMarker } from '@zupfnoter/playback'

export interface PlaybackCountIn {
  durationMs: number
  beatDurationMs: number
  beatOffsetsMs: readonly number[]
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
    || candidate.meter !== marker.meter
  ))
}

/** Resolves one complete count-in measure at an exact playback start marker. */
export function resolveCountIn(
  markers: readonly PlaybackPositionMarker[],
  startMs: number,
  style: PlaybackCountInStyle = 'classic',
  tempoBpm?: number,
  tempoUnit = 0.25,
): PlaybackCountIn | undefined {
  if (style === 'none') return undefined
  const openingMarker = markers[0]
  const openingMeteredMarker = markers.find((marker, index) => index > 0
    && marker.meter !== undefined
    && openingMarker !== undefined
    && marker.position.measureNumber === openingMarker.position.measureNumber
    && marker.position.passIndex === openingMarker.position.passIndex)
  if (openingMarker !== undefined && openingMarker.meter === undefined
    && openingMeteredMarker?.meter !== undefined && openingMarker.timeMs === startMs) {
    const meter = openingMeteredMarker.meter
    const beatDurationMs = tempoBpm !== undefined && tempoBpm > 0
      ? 60000 / tempoBpm * tempoUnit * meter.denominator
      : (() => {
        const next = markers.find((candidate) => candidate.timeMs > openingMeteredMarker.timeMs
          && (candidate.position.measureNumber !== openingMeteredMarker.position.measureNumber
            || candidate.position.passIndex !== openingMeteredMarker.position.passIndex))
        return next === undefined ? 0 : (next.timeMs - openingMeteredMarker.timeMs) / meter.numerator
      })()
    if (beatDurationMs <= 0) return undefined
    const pickupBeatCount = Math.max(1, Math.min(meter.numerator,
      Math.round((openingMeteredMarker.timeMs - openingMarker.timeMs) / beatDurationMs)))
    const countInBeatCount = Math.max(0, meter.numerator - pickupBeatCount)
    const leadBeatCount = style === 'band' ? Math.min(2, meter.numerator) : 0
    const beats = style === 'band'
      ? [
        ...Array.from({ length: leadBeatCount }, (_value, index) => index),
        ...Array.from({ length: countInBeatCount }, (_value, index) => index),
      ]
      : Array.from({ length: countInBeatCount }, (_value, index) => index)
    const beatOffsetsMs = beats.map((_beat, index) => (
      leadBeatCount > 0 && index < leadBeatCount
        ? index * beatDurationMs * 2
        : (leadBeatCount * 2 + index - leadBeatCount) * beatDurationMs
    ))
    return {
      durationMs: (beatOffsetsMs[beatOffsetsMs.length - 1] ?? -beatDurationMs) + beatDurationMs,
      beatDurationMs,
      beatOffsetsMs,
      meter,
      beats,
      leadBeatCount,
    }
  }
  const markerIndex = markers.findIndex((marker) => marker.timeMs === startMs && marker.meter !== undefined)
  if (markerIndex < 0) return undefined
  const marker = markers[markerIndex]
  if (marker === undefined || marker.meter === undefined) return undefined
  const nextMarker = nextPositionBoundaryMarker(markers, markerIndex)
  if (nextMarker === undefined) return undefined
  const durationMs = nextMarker.timeMs - marker.timeMs
  if (durationMs <= 0 || marker.meter.numerator <= 0) return undefined
  const beatCount = marker.meter.numerator
  let beatDurationMs = tempoBpm !== undefined && tempoBpm > 0
    ? 60000 / tempoBpm * tempoUnit * marker.meter.denominator
    : durationMs / beatCount
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
  const leadBeatCount = style === 'band' ? Math.min(2, beatCount) : 0
  const beatOffsetsMs = beats.map((_beat, index) => {
    if (leadBeatCount > 0 && index < leadBeatCount) return index * beatDurationMs * 2
    return (leadBeatCount * 2 + index - leadBeatCount) * beatDurationMs
  })
  const lastBeatOffsetMs = beatOffsetsMs[beatOffsetsMs.length - 1] ?? 0
  return {
    durationMs: lastBeatOffsetMs + beatDurationMs,
    beatDurationMs,
    beatOffsetsMs,
    meter: marker.meter,
    beats,
    leadBeatCount,
  }
}

export function countInBeatIndexAtTime(countIn: PlaybackCountIn, elapsedMs: number): number {
  let index = 0
  for (const [candidateIndex, offsetMs] of countIn.beatOffsetsMs.entries()) {
    if (offsetMs > elapsedMs) break
    index = candidateIndex
  }
  return Math.min(index, countIn.beats.length - 1)
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
    ? 60000 / tempoBpm * tempoUnit * metered.meter.denominator
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
