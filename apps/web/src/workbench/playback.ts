import type {
  PlaybackMode,
  PlaybackPlayerEvent,
  PlaybackHighlight,
  SelectionState,
  SelectionTextRange,
  SheetObjectIndex,
  PlayableEntity,
  Song,
  VoiceEntity,
  Note,
} from '@zupfnoter/types'
import { resolveSelectionZnIds } from './selectionManager'
import { textRangeKey } from './selectionIndex'

export interface PlaybackNote {
  pitch: number
  durationMs: number
  attack: boolean
}

export interface PlaybackStep {
  activeTextRanges: SelectionTextRange[]
  activeNotes: PlaybackNote[]
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
    activeTextRanges: [],
  }
}

export function createPlaybackHighlightFromEvent(event: PlaybackPlayerEvent): PlaybackHighlight {
  if (event.kind !== 'current-notes') return createEmptyPlaybackHighlight()
  return {
    activeTextRanges: event.activeTextRanges,
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
  const SHORTEST_NOTE = 64
  const wholeNoteFraction = duration / SHORTEST_NOTE
  return Math.max(120, (wholeNoteFraction / unit) * (60000 / bpm))
}

export function resolveBaseTempoFromSong(song: Song): number {
  return resolveTempoBpm(song)
}

function collectActiveNotes(entity: PlayableEntity, song: Song): PlaybackNote[] {
  switch (entity.type) {
    case 'Pause':
      return []
    case 'Note':
      return [{
        pitch: entity.pitch,
        durationMs: computeStepDurationMs(song, entity.duration),
        attack: !entity.tieEnd || entity.tieStart,
      }]
    case 'SynchPoint':
      return entity.notes.map((note: Note) => ({
        pitch: note.pitch,
        durationMs: computeStepDurationMs(song, note.duration),
        attack: !note.tieEnd || note.tieStart,
      }))
  }
}

export function buildPlaybackTimeline(song: Song): PlaybackStep[] {
  const grouped = new Map<number, { step: PlaybackStep; maxEntityTimeDuration: number }>()

  for (const voice of song.voices) {
    for (const entity of voice.entities) {
      if (!isPlayableEntity(entity)) continue

      const existing = grouped.get(entity.time)
      const startChar = entity.sourceOffsets?.[0]
      const textRange = entity.sourceOffsets
        ? { startpos: entity.sourceOffsets[0], endpos: entity.sourceOffsets[1] }
        : undefined
      const notes = collectActiveNotes(entity, song)
      if (existing === undefined) {
        grouped.set(entity.time, {
          step: {
            activeTextRanges: textRange !== undefined ? [textRange] : [],
            activeNotes: notes,
            activeStartChar: startChar,
            activeTime: `${entity.time}`,
            durationMs: 0,
          },
          maxEntityTimeDuration: entity.duration,
        })
        continue
      }

      if (textRange !== undefined) {
        existing.step.activeTextRanges.push(textRange)
      }
      if (notes.length > 0) {
        existing.step.activeNotes.push(...notes)
      }
      existing.step.activeStartChar = existing.step.activeStartChar === undefined
        ? startChar
        : startChar === undefined
          ? existing.step.activeStartChar
          : Math.min(existing.step.activeStartChar, startChar)
      existing.maxEntityTimeDuration = Math.max(existing.maxEntityTimeDuration, entity.duration)
    }
  }

  const sorted = [...grouped.entries()]
    .sort((left, right) => left[0] - right[0])

  const bpm = resolveTempoBpm(song)
  const unit = resolveTempoUnit(song)
  const ABC2SVG_DURATION_FACTOR = 1536
  const SHORTEST_NOTE = 64

  function timeToMs(duration: number): number {
    const wholeNoteFraction = duration / ABC2SVG_DURATION_FACTOR
    return Math.max(120, (wholeNoteFraction / unit) * (60000 / bpm))
  }

  return sorted.map(([time, { step, maxEntityTimeDuration }], index) => {
    const nextTime = sorted[index + 1]?.[0]
    const gapDuration = nextTime !== undefined ? nextTime - time : 0
    const stepDurationMs = gapDuration > 0
      ? timeToMs(gapDuration)
      : timeToMs(maxEntityTimeDuration * ABC2SVG_DURATION_FACTOR / SHORTEST_NOTE)

    return {
      ...step,
      durationMs: stepDurationMs,
      activeTextRanges: [...new Map(
        step.activeTextRanges.map((tr) => [textRangeKey(tr), tr]),
      ).values()],
    }
  })
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

  function stepOverlapsSelection(step: PlaybackStep): boolean {
    if (step.activeTextRanges.length === 0) return false
    const selectedEntries = index !== undefined
      ? selectedZnIds
          .flatMap((znId) => index.byZnId[znId] ?? [])
          .map((entryIndex) => index.entries[entryIndex])
          .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
      : []
    const selectedTextRanges = [...new Map(
      selectedEntries
        .filter((entry) => entry.textRange !== undefined)
        .map((entry) => {
          const tr = entry.textRange!
          return [textRangeKey(tr), tr]
        }),
    ).values()]
    if (selectedTextRanges.length === 0) return true
    return step.activeTextRanges.some((stepRange) =>
      selectedTextRanges.some((selRange) =>
        stepRange.endpos > selRange.startpos && stepRange.startpos < selRange.endpos,
      ),
    )
  }

  const selectedIndices = timeline
    .map((step, index) => ({ index, matches: stepOverlapsSelection(step) }))
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
