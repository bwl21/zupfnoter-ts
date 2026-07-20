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
}

export interface PlaybackExportData {
  events: PlaybackExportEvent[]
  positionMarkers: PlaybackExportMarker[]
}

function buildPositionMarkers(timeline: readonly PlaybackStep[]): PlaybackExportMarker[] {
  const markers: PlaybackExportMarker[] = []
  for (const step of timeline) {
    if (step.position === undefined) continue
    const previous = markers[markers.length - 1]
    const changed = previous === undefined
      || previous.position.measureNumber !== step.position.measureNumber
      || previous.position.passIndex !== step.position.passIndex
    if (changed) {
      markers.push({ timeMs: step.playbackStartMs, position: step.position, meter: step.meter })
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
    markers.push({ timeMs: playbackEndMs, position: { ...lastMarker.position } })
  }
  return markers
}

/** Projects the shared timeline into the compact player export model. */
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
  const timeline = buildPlaybackTimeline(song, activeVoiceNumbers)
  const activeVoiceIds = activeVoiceNumbers === undefined
    ? undefined
    : new Set(activeVoiceNumbers.map((voiceNumber) => String(voiceNumber)))
  return buildPlaybackExportDataFromTimeline(timeline, activeVoiceIds)
}
