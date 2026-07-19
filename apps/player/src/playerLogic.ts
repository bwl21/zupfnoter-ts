import type { PlaybackEvent, PlaybackPosition, PlaybackPositionMarker } from '@zupfnoter/playback'

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
