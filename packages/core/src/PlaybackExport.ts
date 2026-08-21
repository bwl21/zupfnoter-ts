import type { PlaybackStep, PlaybackPosition, Song } from '@zupfnoter/types'
import { buildPlaybackTimeline } from './PlaybackTimeline.js'

export interface PlaybackExportEvent {
  startMs: number
  durationMs: number
  pitch: number
  velocity: number
  position: PlaybackPosition
}

export interface PlaybackExportMarker {
  timeMs: number
  position: PlaybackPosition
  meter?: { numerator: number; denominator: number; grouping?: readonly number[] }
  partName?: string
}

export interface PlaybackExportData {
  events: PlaybackExportEvent[]
  positionMarkers: PlaybackExportMarker[]
}

function hasDelayedMeterAtSamePosition(
  timeline: readonly PlaybackStep[],
  stepIndex: number,
  position: PlaybackPosition,
): boolean {
  for (let index = stepIndex + 1; index < timeline.length; index += 1) {
    const candidate = timeline[index]
    if (candidate?.position === undefined) continue
    if (candidate.position.measureNumber !== position.measureNumber
      || candidate.position.passIndex !== position.passIndex) return false
    if (candidate.meter !== undefined) return true
  }
  return false
}

function buildPositionMarkers(timeline: readonly PlaybackStep[]): PlaybackExportMarker[] {
  const markers: PlaybackExportMarker[] = []
  let effectiveMeter: PlaybackExportMarker['meter']
  let effectivePartName: string | undefined
  for (const [stepIndex, step] of timeline.entries()) {
    if (step.position === undefined) continue
    if (step.meter !== undefined) effectiveMeter = step.meter
    const nextPartName = step.partName?.trim()
    if (nextPartName !== undefined && nextPartName !== '') effectivePartName = nextPartName
    const previous = markers[markers.length - 1]
    const positionChanged = previous === undefined
      || previous.position.measureNumber !== step.position.measureNumber
      || previous.position.passIndex !== step.position.passIndex
    const changed = positionChanged || previous.partName !== effectivePartName
    const hasDelayedMeter = step.meter === undefined
      && hasDelayedMeterAtSamePosition(timeline, stepIndex, step.position)
    if (changed) {
      markers.push({
        timeMs: step.playbackStartMs,
        position: step.position,
        meter: positionChanged && !hasDelayedMeter ? effectiveMeter : step.meter,
        partName: effectivePartName,
      })
    } else if (previous !== undefined && step.meter !== undefined
      && previous.meter === undefined && step.playbackStartMs > previous.timeMs) {
      markers.push({
        timeMs: step.playbackStartMs,
        position: { ...step.position },
        meter: step.meter,
        partName: effectivePartName,
      })
    } else if (previous !== undefined && previous.meter === undefined && step.meter !== undefined) {
      previous.meter = step.meter
    }
  }

  const playbackEndMs = timeline.reduce(
    (endMs, step) => Math.max(endMs, step.playbackStartMs + step.durationMs),
    0,
  )
  const lastMarker = markers[markers.length - 1]
  if (lastMarker !== undefined && playbackEndMs > lastMarker.timeMs) {
    markers.push({ timeMs: playbackEndMs, position: { ...lastMarker.position }, partName: lastMarker.partName })
  }
  return markers
}

/** Projects the shared timeline into the compact Practice export model. */
export function buildPlaybackExportDataFromTimeline(
  timeline: readonly PlaybackStep[],
  activeVoiceIds?: ReadonlySet<string>,
): PlaybackExportData {
  const events: PlaybackExportEvent[] = timeline.flatMap((step) => {
    const position = step.position ?? { measureNumber: 1, passIndex: step.passIndex }
    return step.activeNotes
      .filter((note) => note.attack)
      .filter((note) => activeVoiceIds === undefined || activeVoiceIds.has(note.originVoiceId))
      .map((note) => ({
        startMs: step.playbackStartMs,
        durationMs: note.durationMs,
        pitch: note.pitch,
        velocity: 127,
        position,
      }))
  })
  return { events, positionMarkers: buildPositionMarkers(timeline) }
}

/** Erzeugt die exportierbare Audio-/Positionsspur aus der gemeinsamen Timeline. */
export function buildPlaybackExportData(song: Song, activeVoiceNumbers?: readonly number[]): PlaybackExportData {
  // Keep timing based on the complete flow. Filter voices only after the
  // timeline has been expanded, otherwise silent flow steps become longer.
  const timeline = buildPlaybackTimeline(song)
  const activeVoiceIds = activeVoiceNumbers === undefined
    ? undefined
    : new Set(activeVoiceNumbers.map((voiceNumber) => String(voiceNumber)))
  return buildPlaybackExportDataFromTimeline(timeline, activeVoiceIds)
}
