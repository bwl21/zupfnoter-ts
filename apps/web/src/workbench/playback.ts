import type {
  PlaybackMode,
  PlaybackPlayerEvent,
  PlaybackHighlight,
  SelectionState,
  SelectionTextRange,
  SheetObjectIndex,
} from '@zupfnoter/types'
import type { PlaybackStep } from '@zupfnoter/types'
import { filterPlaybackTimelineToVoices } from '@zupfnoter/core'
export { expireActivePlaybackRanges, updateActivePlaybackRanges } from '@zupfnoter/core'
import { textRangeKey, projectIndexesToEntries, resolveSelectedPlaybackIds } from './selectionIndex'

export type { PlaybackNote, PlaybackStep } from '@zupfnoter/types'

export interface PlaybackResolutionOptions {
  activeVoiceIds?: string[]
}

function closePlaybackPassGaps(steps: readonly PlaybackStep[]): PlaybackStep[] {
  let timeShiftMs = 0
  return steps.map((step, index) => {
    const previousStep = steps[index - 1]
    if (previousStep !== undefined && previousStep.passIndex !== step.passIndex) {
      const previousEndMs = previousStep.playbackStartMs + previousStep.durationMs
      timeShiftMs += Math.max(0, step.playbackStartMs - previousEndMs)
    }
    return {
      ...step,
      playbackStartMs: step.playbackStartMs - timeShiftMs,
    }
  })
}

/**
 * Resolve the playback mode from the shared selection state.
 *
 * This keeps the decision logic outside of the view layer so Practice,
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
  const selectedMusicEntries = selectedEntries.filter((entry) => entry.kind === 'music-entity')
  const selectedMusicTimes = [...new Set(
    selectedMusicEntries
      .map((entry) => entry.musicTime)
      .filter((musicTime): musicTime is number => typeof musicTime === 'number'),
  )]
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
  const hasNoSelection = selection.selectedIndexes.length === 0
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

  const selectedSingleBeatTime = selectedMusicTimes.length === 1
    ? selectedMusicTimes[0]
    : undefined

  const singleBeatVoiceIds = selection.voiceScope === 'single-voice' && selectedVoiceIdSet.size > 0
    ? selectedVoiceIdSet
    : activeVoiceIdSet

  if (selectedSingleBeatTime !== undefined && singleBeatVoiceIds.size > 0) {
    const startIndex = timeline.findIndex((step) => step.sourceTime >= selectedSingleBeatTime)
    if (startIndex < 0) return []

    const anchoredSteps = filterPlaybackTimelineToVoices(timeline.slice(startIndex), [...singleBeatVoiceIds])
    const firstStartMs = anchoredSteps[0]?.playbackStartMs ?? 0

    return anchoredSteps.map((step) => ({
      ...step,
      playbackStartMs: step.playbackStartMs - firstStartMs,
    }))
  }

  if (mode === 'all-score' || selectedPlaybackIds.length === 0) {
    if (activeVoiceIds.length > 0 && (hasNoSelection || shouldRestrictToExtractVoices)) {
      return filterPlaybackTimelineToVoices(timeline, activeVoiceIds)
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
      return filterPlaybackTimelineToVoices([nextStep], activeVoiceIds)
    }

    return [nextStep]
  })

  if (filteredSteps.length === 0) {
    return []
  }

  const firstStartMs = filteredSteps[0]?.playbackStartMs ?? 0

  return closePlaybackPassGaps(filteredSteps).map((step) => ({
    ...step,
    playbackStartMs: step.playbackStartMs - firstStartMs,
  }))
}
