import type {
  PlaybackMode,
  PlaybackPlayerEvent,
  PlaybackHighlight,
  SelectionState,
  SelectionTextRange,
  SheetObjectIndex,
} from '@zupfnoter/types'
import type { PlaybackStep } from '@zupfnoter/types'
import { textRangeKey, projectIndexesToEntries, resolveSelectedPlaybackIds } from './selectionIndex'

export type { PlaybackNote, PlaybackStep } from '@zupfnoter/types'

interface ActivePlaybackRangeState {
  textRange: SelectionTextRange
  endTimeMs: number
}

/**
 * Carries note highlights across shared timeline steps when voices overlap.
 * A timeline step ends at the next global event, not necessarily when every
 * note from the step has ended.
 */
export function updateActivePlaybackRanges(
  activeRanges: ReadonlyMap<string, ActivePlaybackRangeState>,
  step: PlaybackStep,
): Map<string, ActivePlaybackRangeState> {
  const nextRanges = new Map(activeRanges)
  for (const [key, range] of nextRanges) {
    if (range.endTimeMs <= step.playbackStartMs) nextRanges.delete(key)
  }
  for (const playbackId of step.endedPlaybackIds ?? []) {
    for (const key of nextRanges.keys()) {
      if (key.startsWith(`${playbackId}:`)) nextRanges.delete(key)
    }
  }

  const durationByPlaybackId = new Map<string, number>()
  for (const note of step.activeNotes) {
    const currentDuration = durationByPlaybackId.get(note.originPlaybackId) ?? 0
    durationByPlaybackId.set(note.originPlaybackId, Math.max(currentDuration, note.durationMs))
  }

  const playbackRanges = step.activePlaybackTextRanges ?? []
  if (playbackRanges.length > 0) {
    for (const entry of playbackRanges) {
      const key = `${entry.playbackId}:${textRangeKey(entry.textRange)}`
      const durationMs = durationByPlaybackId.get(entry.playbackId) ?? step.durationMs
      nextRanges.set(key, {
        textRange: { ...entry.textRange },
        endTimeMs: step.playbackStartMs + durationMs,
      })
    }
  } else {
    for (const textRange of step.activeTextRanges) {
      const key = `range:${textRangeKey(textRange)}`
      nextRanges.set(key, {
        textRange: { ...textRange },
        endTimeMs: step.playbackStartMs + step.durationMs,
      })
    }
  }

  return nextRanges
}

export interface PlaybackResolutionOptions {
  activeVoiceIds?: string[]
}

/**
 * Resolve the playback mode from the shared selection state.
 *
 * This keeps the decision logic outside of the view layer so the player,
 * future worker bridge and any command handlers use the same rule set.
 */
export function resolvePlaybackMode(selection: SelectionState, index: SheetObjectIndex | undefined, activeExtract: number): PlaybackMode {
  void activeExtract
  const selectedPlaybackIds = resolveSelectedPlaybackIds(index, selection)
  if (selectedPlaybackIds.length === 0) return 'all-score'
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
    measureNumber: event.measureNumber,
    partName: event.partName,
    passIndex: event.passIndex,
    voltaNumber: event.voltaNumber,
  }
}

/** Keeps each playback step associated with the latest non-empty, trimmed ABC part name. */
export function resolveEffectivePlaybackPartNames(
  timeline: readonly PlaybackStep[],
): ReadonlyMap<number, string | undefined> {
  const partNames = new Map<number, string | undefined>()
  let currentPartName: string | undefined
  for (const step of timeline) {
    const nextPartName = step.partName?.trim()
    if (nextPartName !== undefined && nextPartName !== '') currentPartName = nextPartName
    partNames.set(step.flowIndex, currentPartName)
  }
  return partNames
}

export { buildPlaybackTimeline, resolveBaseTempoFromSong, resolveTempoUnitFromSong } from '@zupfnoter/core'

export function resolvePlaybackSteps(
  selection: SelectionState,
  index: SheetObjectIndex | undefined,
  timeline: PlaybackStep[],
  mode: PlaybackMode,
  options?: PlaybackResolutionOptions,
): PlaybackStep[] {
  const activeVoiceIds = options?.activeVoiceIds ?? []
  const activeVoiceIdSet = new Set(activeVoiceIds)
  const selectedPlaybackIds = resolveSelectedPlaybackIds(index, selection)
  const selectedEntries = projectIndexesToEntries(index, selection.selectedIndexes)
  const selectedVoiceIds = [...new Set(
    selectedEntries
      .map((entry) => entry.voiceId)
      .filter((voiceId): voiceId is string => voiceId !== undefined),
  )]
  const selectedVoiceIdSet = new Set(selectedVoiceIds)
  const selectedTextRanges = [...new Map(
    selectedEntries
      .filter((entry) => entry.textRange !== undefined)
      .map((entry) => {
        const range = entry.textRange as SelectionTextRange
        return [textRangeKey(range), range] as const
      }),
  ).values()]
  const selectedPlaybackIdSet = new Set(selectedPlaybackIds)
  const isEditorSingleVoiceSelection = selection.source === 'abc-editor'
    && selection.voiceScope === 'single-voice'
    && selectedVoiceIds.length > 0
  const shouldRestrictToExtractVoices = selection.voiceScope === 'extract-voices' && activeVoiceIdSet.size > 0

  function overlapsSelectedTextRange(step: PlaybackStep): boolean {
    if (selectedTextRanges.length === 0) return true
    return step.activeTextRanges.some((stepRange) => selectedTextRanges.some((selectedRange) => (
      stepRange.endpos > selectedRange.startpos && stepRange.startpos < selectedRange.endpos
    )))
  }

  function filterStepToAllowedVoices(step: PlaybackStep, allowedVoiceIds: Set<string>): PlaybackStep | undefined {
    const matchingOriginPlaybackIds = step.originPlaybackIds.filter((_, index) => {
      const originVoiceId = step.originVoiceIds[index]
      return originVoiceId !== undefined && allowedVoiceIds.has(originVoiceId)
    })
    const matchingOriginVoiceIds = [...new Set(
      matchingOriginPlaybackIds
        .map((playbackId) => playbackId.split('::')[0])
        .filter((voiceId): voiceId is string => voiceId !== undefined && voiceId !== ''),
    )]
    const matchingOriginZnIds = [...new Set(
      matchingOriginPlaybackIds.map((playbackId) => playbackId.split('::').slice(1).join('::')),
    )]
    const matchingActiveNotes = step.activeNotes.filter((note) => allowedVoiceIds.has(note.originVoiceId))
    const matchingPlaybackTextRanges = (step.activePlaybackTextRanges ?? []).filter((entry) => allowedVoiceIds.has(entry.voiceId))
    const matchingTextRanges = [...new Map(
      matchingPlaybackTextRanges.map((entry) => [textRangeKey(entry.textRange), entry.textRange] as const),
    ).values()]

    if (
      matchingOriginPlaybackIds.length === 0
      && matchingActiveNotes.length === 0
      && matchingTextRanges.length === 0
    ) {
      return undefined
    }

    return {
      ...step,
      originVoiceIds: matchingOriginVoiceIds,
      originPlaybackIds: matchingOriginPlaybackIds,
      originZnIds: matchingOriginZnIds,
      activeNotes: matchingActiveNotes,
      activeTextRanges: matchingTextRanges,
      activePlaybackTextRanges: matchingPlaybackTextRanges,
    }
  }

  const selectedSingleNoteTime = selectedEntries.length === 1
    && selectedEntries[0]?.kind === 'music-entity'
    && typeof selectedEntries[0].musicTime === 'number'
    ? selectedEntries[0].musicTime
    : undefined

  if (selectedSingleNoteTime !== undefined && activeVoiceIdSet.size > 0) {
    const startIndex = timeline.findIndex((step) => step.sourceTime >= selectedSingleNoteTime)
    if (startIndex < 0) return []

    const anchoredSteps = timeline
      .slice(startIndex)
      .map((step) => filterStepToAllowedVoices(step, activeVoiceIdSet))
      .filter((step): step is PlaybackStep => step !== undefined)
    const firstStartMs = anchoredSteps[0]?.playbackStartMs ?? 0

    return anchoredSteps.map((step) => ({
      ...step,
      playbackStartMs: step.playbackStartMs - firstStartMs,
    }))
  }

  if (mode === 'all-score' || selectedPlaybackIds.length === 0) {
    if (shouldRestrictToExtractVoices) {
      return timeline
        .map((step) => filterStepToAllowedVoices(step, activeVoiceIdSet))
        .filter((step): step is PlaybackStep => step !== undefined)
    }

    if (selection.source !== 'abc-editor' || selection.voiceScope !== 'single-voice' || selectedVoiceIds.length === 0) {
      return timeline
    }
  }

  const filteredSteps = timeline.flatMap((step) => {
    const matchingOriginPlaybackIds = step.originPlaybackIds.filter((playbackId, index) => {
      if (selectedPlaybackIdSet.has(playbackId)) return true
      if (!isEditorSingleVoiceSelection) return false
      const originVoiceId = step.originVoiceIds[index]
      return originVoiceId !== undefined && selectedVoiceIdSet.has(originVoiceId) && overlapsSelectedTextRange(step)
    })
    const matchingOriginZnIds = [...new Set(
      matchingOriginPlaybackIds.map((playbackId) => playbackId.split('::').slice(1).join('::')),
    )]
    const matchingActiveNotes = step.activeNotes.filter((note) => {
      if (selectedPlaybackIdSet.has(note.originPlaybackId)) return true
      return isEditorSingleVoiceSelection
        && selectedVoiceIdSet.has(note.originVoiceId)
        && overlapsSelectedTextRange(step)
    })
    const matchingPlaybackTextRanges = (step.activePlaybackTextRanges ?? [])
      .filter((entry) => {
        if (selectedPlaybackIdSet.has(entry.playbackId)) return true
        return isEditorSingleVoiceSelection
          && selectedVoiceIdSet.has(entry.voiceId)
          && selectedTextRanges.some((selectedRange) => (
            entry.textRange.endpos > selectedRange.startpos && entry.textRange.startpos < selectedRange.endpos
          ))
      })
    const matchingTextRanges = [...new Map(
      matchingPlaybackTextRanges.map((entry) => [textRangeKey(entry.textRange), entry.textRange] as const),
    ).values()]

    if (
      matchingOriginPlaybackIds.length === 0
      && matchingOriginZnIds.length === 0
      && matchingActiveNotes.length === 0
      && matchingTextRanges.length === 0
    ) {
      return []
    }

    const nextStep: PlaybackStep = {
      ...step,
      originVoiceIds: [...new Set(
        matchingOriginPlaybackIds
          .map((playbackId) => playbackId.split('::')[0])
          .filter((voiceId): voiceId is string => voiceId !== undefined && voiceId !== ''),
      )],
      originPlaybackIds: matchingOriginPlaybackIds,
      originZnIds: matchingOriginZnIds,
      activeNotes: matchingActiveNotes,
      activeTextRanges: matchingTextRanges,
      activePlaybackTextRanges: matchingPlaybackTextRanges,
    }

    if (shouldRestrictToExtractVoices) {
      const extractFilteredStep = filterStepToAllowedVoices(nextStep, activeVoiceIdSet)
      return extractFilteredStep === undefined ? [] : [extractFilteredStep]
    }

    return [nextStep]
  })

  if (filteredSteps.length === 0) {
    return []
  }

  const firstStartMs = filteredSteps[0]?.playbackStartMs ?? 0

  return filteredSteps.map((step) => ({
    ...step,
    playbackStartMs: step.playbackStartMs - firstStartMs,
  }))
}
