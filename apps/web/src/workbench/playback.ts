import type {
  PlaybackMode,
  PlaybackPlayerEvent,
  PlaybackHighlight,
  PlaybackFlowStep,
  SelectionState,
  SelectionTextRange,
  SheetObjectIndex,
  PlayableEntity,
  Song,
  VoiceEntity,
  Note,
} from '@zupfnoter/types'
import { expandPlaybackFlow } from '@zupfnoter/core'
import { textRangeKey, buildPlaybackIdentity, projectIndexesToEntries, resolveSelectedPlaybackIds } from './selectionIndex'
import { isUserVisibleVoice, resolveUserVisibleVoiceId } from './songVoiceIdentity'

export interface PlaybackNote {
  originVoiceId: string
  originPlaybackId: string
  originZnId: string
  pitch: number
  durationMs: number
  attack: boolean
  pan: 'left' | 'right'
}

interface TiedPlaybackNote {
  durationMs: number
}

interface PlaybackStepTextRange {
  playbackId: string
  voiceId: string
  textRange: SelectionTextRange
}

export interface PlaybackStep {
  originVoiceIds: string[]
  originPlaybackIds: string[]
  originZnIds: string[]
  activeTextRanges: SelectionTextRange[]
  activePlaybackTextRanges?: PlaybackStepTextRange[]
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
    passIndex: event.passIndex,
    voltaNumber: event.voltaNumber,
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

function appendPlaybackNote(
  notes: PlaybackNote[],
  pendingTies: Map<string, TiedPlaybackNote>,
  originVoiceId: string,
  originPlaybackId: string,
  originZnId: string,
  voiceIndex: number,
  pitch: number,
  durationMs: number,
  tieStart: boolean,
  tieEnd: boolean,
): void {
  const tieKey = `${voiceIndex}:${pitch}`
  const pending = pendingTies.get(tieKey)

  if (tieEnd && pending !== undefined) {
    pending.durationMs += durationMs
    if (!tieStart) {
      pendingTies.delete(tieKey)
    }
    return
  }

  const nextNote: PlaybackNote = {
    originVoiceId,
    originPlaybackId,
    originZnId,
    pitch,
    durationMs,
    attack: true,
    pan: Number(originVoiceId) <= 2 ? 'left' : 'right',
  }
  notes.push(nextNote)

  if (tieStart) {
    pendingTies.set(tieKey, nextNote)
  } else {
    pendingTies.delete(tieKey)
  }
}

function collectActiveNotes(
  entity: PlayableEntity,
  song: Song,
  voiceIndex: number,
  originVoiceId: string,
  pendingTies: Map<string, TiedPlaybackNote>,
): PlaybackNote[] {
  const notes: PlaybackNote[] = []
  const originPlaybackId = buildPlaybackIdentity(originVoiceId, entity.znId)

  switch (entity.type) {
    case 'Pause':
      return notes
    case 'Note':
      appendPlaybackNote(
        notes,
        pendingTies,
        originVoiceId,
        originPlaybackId,
        entity.znId,
        voiceIndex,
        entity.pitch,
        computeStepDurationMs(song, entity.duration),
        entity.tieStart,
        entity.tieEnd,
      )
      return notes
    case 'SynchPoint':
      for (const note of entity.notes) {
        appendPlaybackNote(
          notes,
          pendingTies,
          originVoiceId,
          originPlaybackId,
          entity.znId,
          voiceIndex,
          note.pitch,
          computeStepDurationMs(song, note.duration),
          note.tieStart,
          note.tieEnd,
        )
      }
      return notes
  }
}

interface PlaybackStepGroup {
  originVoiceIds: string[]
  originPlaybackIds: string[]
  originZnIds: string[]
  activeTextRanges: SelectionTextRange[]
  activePlaybackTextRanges: PlaybackStepTextRange[]
  activeNotes: PlaybackNote[]
  activeStartChar?: number
  maxEntityTimeDuration: number
}

function collectPlaybackStepGroups(song: Song, activeVoices?: number[]): Map<number, PlaybackStepGroup> {
  const grouped = new Map<number, PlaybackStepGroup>()
  const allowedVoiceIndexes = activeVoices === undefined
    ? undefined
    : new Set(activeVoices)

  for (const [voiceIndex, voice] of song.voices.entries()) {
    const originVoiceId = resolveUserVisibleVoiceId(voice)
    if (!isUserVisibleVoice(voice) || originVoiceId === undefined) continue
    if (allowedVoiceIndexes !== undefined && !allowedVoiceIndexes.has(voice.index)) continue
    const pendingTies = new Map<string, TiedPlaybackNote>()
    for (const entity of voice.entities) {
      if (!isPlayableEntity(entity)) continue

      const existing = grouped.get(entity.time)
      const startChar = entity.sourceOffsets?.[0]
      const textRange = entity.sourceOffsets
        ? { startpos: entity.sourceOffsets[0], endpos: entity.sourceOffsets[1] }
        : undefined
      const notes = collectActiveNotes(entity, song, voiceIndex, originVoiceId, pendingTies)
      const originPlaybackId = buildPlaybackIdentity(originVoiceId, entity.znId)
      if (existing === undefined) {
        grouped.set(entity.time, {
          originVoiceIds: [originVoiceId],
          originPlaybackIds: [originPlaybackId],
          originZnIds: [entity.znId],
          activeTextRanges: textRange !== undefined ? [textRange] : [],
          activePlaybackTextRanges: textRange !== undefined ? [{
            playbackId: originPlaybackId,
            voiceId: originVoiceId,
            textRange,
          }] : [],
          activeNotes: notes,
          activeStartChar: startChar,
          maxEntityTimeDuration: entity.duration,
        })
        continue
      }

      existing.originVoiceIds.push(originVoiceId)
      existing.originPlaybackIds.push(originPlaybackId)
      existing.originZnIds.push(entity.znId)
      if (textRange !== undefined) {
        existing.activeTextRanges.push(textRange)
        existing.activePlaybackTextRanges.push({
          playbackId: originPlaybackId,
          voiceId: originVoiceId,
          textRange,
        })
      }
      if (notes.length > 0) {
        existing.activeNotes.push(...notes)
      }
      existing.activeStartChar = existing.activeStartChar === undefined
        ? startChar
        : startChar === undefined
          ? existing.activeStartChar
          : Math.min(existing.activeStartChar, startChar)
      existing.maxEntityTimeDuration = Math.max(existing.maxEntityTimeDuration, entity.duration)
    }
  }

  for (const group of grouped.values()) {
    group.originVoiceIds = [...new Set(group.originVoiceIds)]
    group.originPlaybackIds = [...new Set(group.originPlaybackIds)]
    group.originZnIds = [...new Set(group.originZnIds)]
    group.activeTextRanges = [...new Map(
      group.activeTextRanges.map((tr) => [textRangeKey(tr), tr]),
    ).values()]
    group.activePlaybackTextRanges = [...new Map(
      group.activePlaybackTextRanges.map((entry) => [
        `${entry.playbackId}:${textRangeKey(entry.textRange)}`,
        entry,
      ] as const),
    ).values()]
    group.activeNotes = [...new Map(
      group.activeNotes.map((note) => [`${note.originPlaybackId}:${note.pitch}:${note.attack ? 1 : 0}:${note.pan}`, note] as const),
    ).values()]
  }

  return grouped
}

export function buildPlaybackTimeline(song: Song, activeVoices?: number[]): PlaybackStep[] {
  const grouped = collectPlaybackStepGroups(song, activeVoices)
  const flow = expandPlaybackFlow(song)
  const sourceTimes = [...grouped.keys()].sort((left, right) => left - right)
  const nextSourceTimeByTime = new Map<number, number>()

  for (let index = 0; index < sourceTimes.length; index += 1) {
    const sourceTime = sourceTimes[index]
    const nextSourceTime = sourceTimes[index + 1]
    if (sourceTime !== undefined && nextSourceTime !== undefined) {
      nextSourceTimeByTime.set(sourceTime, nextSourceTime)
    }
  }

  const bpm = resolveTempoBpm(song)
  const unit = resolveTempoUnit(song)
  const ABC2SVG_DURATION_FACTOR = 1536
  const SHORTEST_NOTE = 64

  function timeToMs(duration: number): number {
    const wholeNoteFraction = duration / ABC2SVG_DURATION_FACTOR
    return Math.max(120, (wholeNoteFraction / unit) * (60000 / bpm))
  }

  let playbackCursorMs = 0

  return flow.map((flowStep: PlaybackFlowStep, index: number) => {
    const group = grouped.get(flowStep.sourceTime)
    if (group === undefined) {
      const fallbackStep: PlaybackStep = {
        originVoiceIds: [],
        originPlaybackIds: [...new Set(flowStep.originZnIds.map((znId) => buildPlaybackIdentity(undefined, znId)))],
        originZnIds: [...flowStep.originZnIds],
        activeTextRanges: flowStep.activeTextRanges.map((range) => ({ ...range })),
        activePlaybackTextRanges: [],
        activeNotes: [],
        activeStartChar: flowStep.activeStartChar,
        activeTime: `${flowStep.sourceTime}`,
        playbackStartMs: playbackCursorMs,
        durationMs: 120,
        sourceTime: flowStep.sourceTime,
        flowIndex: flowStep.flowIndex,
        passIndex: flowStep.passIndex,
        voltaNumber: flowStep.voltaNumber,
      }
      playbackCursorMs += fallbackStep.durationMs
      return fallbackStep
    }

    const ownDurationUnits = group.maxEntityTimeDuration * ABC2SVG_DURATION_FACTOR / SHORTEST_NOTE
    const nextFlowStep = flow[index + 1]
    const nextSourceTime = nextSourceTimeByTime.get(flowStep.sourceTime)
    const followsSourceSequence = nextFlowStep?.sourceTime === nextSourceTime
    const traversalDurationUnits = followsSourceSequence && nextSourceTime !== undefined && nextSourceTime > flowStep.sourceTime
      ? nextSourceTime - flowStep.sourceTime
      : ownDurationUnits
    const stepDurationMs = timeToMs(traversalDurationUnits)

    const playbackStep: PlaybackStep = {
      originVoiceIds: [...group.originVoiceIds],
      originPlaybackIds: [...group.originPlaybackIds],
      originZnIds: [...group.originZnIds],
      activeTextRanges: group.activeTextRanges.map((range) => ({ ...range })),
      activePlaybackTextRanges: group.activePlaybackTextRanges.map((entry) => ({
        playbackId: entry.playbackId,
        voiceId: entry.voiceId,
        textRange: { ...entry.textRange },
      })),
      activeNotes: [...group.activeNotes],
      activeStartChar: group.activeStartChar,
      activeTime: `${flowStep.sourceTime}`,
      playbackStartMs: playbackCursorMs,
      durationMs: stepDurationMs,
      sourceTime: flowStep.sourceTime,
      flowIndex: flowStep.flowIndex,
      passIndex: flowStep.passIndex,
      voltaNumber: flowStep.voltaNumber,
    }

    playbackCursorMs += playbackStep.durationMs

    return playbackStep
  })
}

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
