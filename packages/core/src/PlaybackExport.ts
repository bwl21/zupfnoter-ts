import type { Note, PlayableEntity, Song, SynchPoint, VoiceEntity } from '@zupfnoter/types'
import { expandPlaybackFlow } from './PlaybackFlow.js'

export interface PlaybackExportEvent {
  startMs: number
  durationMs: number
  pitch: number
  velocity: number
  position: { measureNumber: number; passIndex: number }
}

export interface PlaybackExportMarker {
  timeMs: number
  position: { measureNumber: number; passIndex: number }
  meter?: { numerator: number; denominator: number; grouping?: readonly number[] }
}

export interface PlaybackExportData {
  events: PlaybackExportEvent[]
  positionMarkers: PlaybackExportMarker[]
}

interface PendingNote {
  pitch: number
  durationMs: number
}

interface SourceGroup {
  notes: PendingNote[]
  durationUnits: number
}

const ABC2SVG_DURATION_FACTOR = 1536

function isPlayableEntity(entity: VoiceEntity): entity is PlayableEntity {
  return entity.type === 'Note' || entity.type === 'Pause' || entity.type === 'SynchPoint'
}

function resolveTempo(song: Song): { bpm: number; unit: number } {
  const tempo = song.metaData.tempo
  if (typeof tempo === 'number') return { bpm: tempo, unit: 0.25 }
  if (tempo === undefined) return { bpm: 120, unit: 0.25 }
  const bpm = typeof tempo.bpm === 'number' ? tempo.bpm : 120
  const duration = tempo.duration[0]
  return { bpm, unit: typeof duration === 'number' && duration > 0 ? duration : 0.25 }
}

function durationMs(song: Song, duration: number): number {
  const tempo = resolveTempo(song)
  return Math.max(120, (duration / ABC2SVG_DURATION_FACTOR / tempo.unit) * (60000 / tempo.bpm))
}

function appendNote(
  target: PendingNote[],
  pending: Map<string, PendingNote>,
  pitch: number,
  duration: number,
  tieStart: boolean,
  tieEnd: boolean,
): void {
  const key = String(pitch)
  const previous = pending.get(key)
  if (tieEnd && previous !== undefined) {
    previous.durationMs += duration
    if (!tieStart) pending.delete(key)
    return
  }

  const note: PendingNote = { pitch, durationMs: duration }
  target.push(note)
  if (tieStart) pending.set(key, note)
  else pending.delete(key)
}

function appendEntityNotes(
  entity: Note | SynchPoint,
  song: Song,
  pending: Map<string, PendingNote>,
): PendingNote[] {
  const notes: PendingNote[] = []
  if (entity.type === 'Note') {
    appendNote(notes, pending, entity.pitch, durationMs(song, entity.duration), entity.tieStart, entity.tieEnd)
    return notes
  }
  for (const note of entity.notes) {
    appendNote(notes, pending, note.pitch, durationMs(song, note.duration), entity.tieStart, entity.tieEnd)
  }
  return notes
}

/** Erzeugt die exportierbare Audio-/Positionsspur direkt aus Song und Auszug. */
export function buildPlaybackExportData(song: Song, activeVoiceNumbers?: readonly number[]): PlaybackExportData {
  const allowed = activeVoiceNumbers === undefined ? undefined : new Set(activeVoiceNumbers)
  const groups = new Map<number, SourceGroup>()

  for (const voice of song.voices) {
    if (voice.index <= 0 || (allowed !== undefined && !allowed.has(voice.index))) continue
    const pending = new Map<string, PendingNote>()
    for (const entity of voice.entities) {
      if (!isPlayableEntity(entity)) continue
      const existing = groups.get(entity.time) ?? { notes: [], durationUnits: 0 }
      if (entity.type !== 'Pause') existing.notes.push(...appendEntityNotes(entity, song, pending))
      existing.durationUnits = Math.max(existing.durationUnits, entity.duration)
      groups.set(entity.time, existing)
    }
  }

  const flow = expandPlaybackFlow(song)
  const sourceTimes = [...groups.keys()].sort((left, right) => left - right)
  const nextSourceTime = new Map<number, number>()
  for (let index = 0; index + 1 < sourceTimes.length; index += 1) {
    const current = sourceTimes[index]
    const next = sourceTimes[index + 1]
    if (current !== undefined && next !== undefined) nextSourceTime.set(current, next)
  }

  const tempo = resolveTempo(song)
  const events: PlaybackExportEvent[] = []
  const positionMarkers: PlaybackExportMarker[] = []
  let cursorMs = 0
  let previousMarker: PlaybackExportMarker | undefined

  for (let index = 0; index < flow.length; index += 1) {
    const flowStep = flow[index]
    if (flowStep === undefined) continue
    const group = groups.get(flowStep.sourceTime)
    const nextFlowStep = flow[index + 1]
    const nextSource = nextSourceTime.get(flowStep.sourceTime)
    const followsSource = nextFlowStep?.sourceTime === nextSource && nextSource !== undefined
    const durationUnits = group?.durationUnits ?? 64
    const traversalUnits = followsSource ? nextSource - flowStep.sourceTime : durationUnits
    const stepDurationMs = Math.max(120, (traversalUnits / ABC2SVG_DURATION_FACTOR / tempo.unit) * (60000 / tempo.bpm))
    const position = { measureNumber: flowStep.measureNumber, passIndex: flowStep.passIndex }
    const markerChanged = previousMarker === undefined
      || previousMarker.position.measureNumber !== position.measureNumber
      || previousMarker.position.passIndex !== position.passIndex
    if (markerChanged) {
      const marker: PlaybackExportMarker = { timeMs: cursorMs, position, meter: flowStep.meter }
      positionMarkers.push(marker)
      previousMarker = marker
    } else if (previousMarker !== undefined && previousMarker.meter === undefined && flowStep.meter !== undefined) {
      previousMarker.meter = flowStep.meter
    }

    for (const note of group?.notes ?? []) {
      events.push({ startMs: cursorMs, durationMs: note.durationMs, pitch: note.pitch, velocity: 127, position })
    }
    cursorMs += stepDurationMs
  }

  const lastMarker = positionMarkers[positionMarkers.length - 1]
  if (lastMarker !== undefined && cursorMs > lastMarker.timeMs) {
    positionMarkers.push({ timeMs: cursorMs, position: { ...lastMarker.position } })
  }
  return { events, positionMarkers }
}
