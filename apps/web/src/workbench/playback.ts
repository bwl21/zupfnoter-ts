import type {
  PlaybackMode,
  PlaybackPlayerEvent,
  PlaybackHighlight,
  SelectionState,
  SheetObjectIndex,
  PlayableEntity,
  Song,
  VoiceEntity,
} from '@zupfnoter/types'
import { resolveSelectionZnIds } from './selectionManager'

export interface PlaybackStep {
  activeZnIds: string[]
  activeStartChar?: number
  activeTime: string
  durationMs: number
}

/**
 * Resolve the playback mode from the shared selection state.
 *
 * This keeps the decision logic outside of the view layer so the player,
 * future worker bridge and any command handlers use the same rule set.
 */
export function resolvePlaybackMode(selection: SelectionState, index: SheetObjectIndex | undefined, activeExtract: number): PlaybackMode {
  void activeExtract
  const selectedZnIds = resolveSelectionZnIds(index, selection)
  if (selection.source !== 'harp-preview' || selectedZnIds.length === 0) return 'all-score'
  if (selectedZnIds.length <= 1) return 'from-note-harp'
  return 'range-harp'
}

export function createEmptyPlaybackHighlight(): PlaybackHighlight {
  return {
    activeZnIds: [],
  }
}

export function createPlaybackHighlightFromEvent(event: PlaybackPlayerEvent): PlaybackHighlight {
  if (event.kind !== 'current-notes') return createEmptyPlaybackHighlight()
  return {
    activeZnIds: event.activeZnIds,
    activeStartChar: event.activeStartChar,
    activeTime: event.activeTime,
  }
}

function isPlayableEntity(entity: VoiceEntity): entity is PlayableEntity {
  return entity.type === 'Note' || entity.type === 'Pause' || entity.type === 'SynchPoint'
}

function resolveTempoBpm(song: Song): number {
  const tempo = song.metaData.tempo
  if (typeof tempo === 'number') return tempo
  if (tempo !== undefined && typeof tempo.bpm === 'number') return tempo.bpm
  return 120
}

function resolveTempoUnit(song: Song): number {
  const tempo = song.metaData.tempo
  if (tempo !== undefined && typeof tempo !== 'number' && tempo.duration.length > 0) {
    const firstDuration = tempo.duration[0]
    if (typeof firstDuration === 'number' && firstDuration > 0) {
      return firstDuration
    }
  }
  return 0.25
}

function computeStepDurationMs(song: Song, duration: number): number {
  const bpm = resolveTempoBpm(song)
  const unit = resolveTempoUnit(song)
  const wholeNoteFraction = duration / 1536
  return Math.max(120, (wholeNoteFraction / unit) * (60000 / bpm))
}

export function resolveBaseTempoFromSong(song: Song): number {
  return resolveTempoBpm(song)
}

export function buildPlaybackTimeline(song: Song): PlaybackStep[] {
  const grouped = new Map<number, PlaybackStep>()

  for (const voice of song.voices) {
    for (const entity of voice.entities) {
      if (!isPlayableEntity(entity)) continue

      const existing = grouped.get(entity.time)
      const startChar = entity.sourceOffsets?.[0]
      const durationMs = computeStepDurationMs(song, entity.duration)
      if (existing === undefined) {
        grouped.set(entity.time, {
          activeZnIds: [entity.znId],
          activeStartChar: startChar,
          activeTime: `${entity.time}`,
          durationMs,
        })
        continue
      }

      existing.activeZnIds.push(entity.znId)
      existing.activeStartChar = existing.activeStartChar === undefined
        ? startChar
        : startChar === undefined
          ? existing.activeStartChar
          : Math.min(existing.activeStartChar, startChar)
      existing.durationMs = Math.max(existing.durationMs, durationMs)
    }
  }

  return [...grouped.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, step]) => ({
      ...step,
      activeZnIds: [...new Set(step.activeZnIds)],
    }))
}

export function resolvePlaybackSteps(
  selection: SelectionState,
  index: SheetObjectIndex | undefined,
  timeline: PlaybackStep[],
  mode: PlaybackMode,
): PlaybackStep[] {
  const selectedZnIds = resolveSelectionZnIds(index, selection)
  if (mode === 'all-score' || selectedZnIds.length === 0) {
    return timeline
  }

  const selectedIndices = timeline
    .map((step, index) => ({ index, matches: step.activeZnIds.some((znId) => selectedZnIds.includes(znId)) }))
    .filter((entry) => entry.matches)
    .map((entry) => entry.index)

  if (selectedIndices.length === 0) return timeline

  if (mode === 'from-note-harp') {
    const startIndex = selectedIndices[0] ?? 0
    return timeline.slice(startIndex)
  }

  const startIndex = selectedIndices[0] ?? 0
  const endIndex = selectedIndices[selectedIndices.length - 1] ?? startIndex
  return timeline.slice(startIndex, endIndex + 1)
}
