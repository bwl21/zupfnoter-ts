import type {
  PlaybackMode,
  PlaybackPlayerEvent,
  PlaybackHighlight,
  PlaybackFlowStep,
  PlaybackNote,
  SelectionState,
  SelectionTextRange,
  SheetObjectIndex,
  Song,
} from '@zupfnoter/types'
import { expandPlaybackFlow } from '@zupfnoter/core'
import { resolveSelectionZnIds } from './selectionManager'
import { textRangeKey } from './selectionIndex'

export interface PlaybackStep {
  originZnIds: string[]
  activeTextRanges: SelectionTextRange[]
  activeNotes: PlaybackNote[]
  activeStartChar?: number
  activeTime: string
  playbackStartMs: number
  durationMs: number
  sourceTime: number
  flowIndex: number
  passIndex: number
  voltaNumber?: number
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
    passIndex: event.passIndex,
    voltaNumber: event.voltaNumber,
  }
}

export function resolveBaseTempoFromSong(song: Song): number {
  const tempo = song.metaData.tempo
  if (typeof tempo === 'number') return tempo
  if (tempo !== undefined && typeof tempo.bpm === 'number') return tempo.bpm
  return 120
}

export function buildPlaybackTimeline(song: Song): PlaybackStep[] {
  const flow = expandPlaybackFlow(song)
  return flow.map((flowStep: PlaybackFlowStep) => ({
    originZnIds: [...flowStep.originZnIds],
    activeTextRanges: flowStep.activeTextRanges.map((range) => ({ ...range })),
    activeNotes: [...flowStep.activeNotes],
    activeStartChar: flowStep.activeStartChar,
    activeTime: `${flowStep.sourceTime}`,
    playbackStartMs: flowStep.playbackStartMs,
    durationMs: flowStep.activeNotes.reduce((maxDuration: number, note) => Math.max(maxDuration, note.durationMs), 120),
    sourceTime: flowStep.sourceTime,
    flowIndex: flowStep.flowIndex,
    passIndex: flowStep.passIndex,
    voltaNumber: flowStep.voltaNumber,
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
        const range = entry.textRange
        return range === undefined ? undefined : [textRangeKey(range), range] as const
      })
      .filter((entry): entry is readonly [string, SelectionTextRange] => entry !== undefined),
  ).values()]

  function stepOverlapsSelection(step: PlaybackStep): boolean {
    if (step.originZnIds.some((znId) => selectedZnIds.includes(znId))) return true
    if (step.activeTextRanges.length === 0) return false
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

  const selectedStepIndexes = new Set(selectedIndices)
  return timeline.filter((_, timelineIndex) => selectedStepIndexes.has(timelineIndex))
}
