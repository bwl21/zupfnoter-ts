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
import { resolveSelectionZnIds } from './selectionManager'
import { textRangeKey } from './selectionIndex'

export interface PlaybackNote {
  pitch: number
  durationMs: number
  attack: boolean
}

interface TiedPlaybackNote {
  durationMs: number
}

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
    pitch,
    durationMs,
    attack: true,
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
  pendingTies: Map<string, TiedPlaybackNote>,
): PlaybackNote[] {
  const notes: PlaybackNote[] = []

  switch (entity.type) {
    case 'Pause':
      return notes
    case 'Note':
      appendPlaybackNote(
        notes,
        pendingTies,
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
  originZnIds: string[]
  activeTextRanges: SelectionTextRange[]
  activeNotes: PlaybackNote[]
  activeStartChar?: number
  maxEntityTimeDuration: number
}

function collectPlaybackStepGroups(song: Song): Map<number, PlaybackStepGroup> {
  const grouped = new Map<number, PlaybackStepGroup>()

  for (const [voiceIndex, voice] of song.voices.entries()) {
    const pendingTies = new Map<string, TiedPlaybackNote>()
    for (const entity of voice.entities) {
      if (!isPlayableEntity(entity)) continue

      const existing = grouped.get(entity.time)
      const startChar = entity.sourceOffsets?.[0]
      const textRange = entity.sourceOffsets
        ? { startpos: entity.sourceOffsets[0], endpos: entity.sourceOffsets[1] }
        : undefined
      const notes = collectActiveNotes(entity, song, voiceIndex, pendingTies)
      if (existing === undefined) {
        grouped.set(entity.time, {
          originZnIds: [entity.znId],
          activeTextRanges: textRange !== undefined ? [textRange] : [],
          activeNotes: notes,
          activeStartChar: startChar,
          maxEntityTimeDuration: entity.duration,
        })
        continue
      }

      existing.originZnIds.push(entity.znId)
      if (textRange !== undefined) {
        existing.activeTextRanges.push(textRange)
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
    group.originZnIds = [...new Set(group.originZnIds)]
    group.activeTextRanges = [...new Map(
      group.activeTextRanges.map((tr) => [textRangeKey(tr), tr]),
    ).values()]
    group.activeNotes = [...new Map(
      group.activeNotes.map((note) => [`${note.pitch}:${note.attack ? 1 : 0}`, note] as const),
    ).values()]
  }

  return grouped
}

export function buildPlaybackTimeline(song: Song): PlaybackStep[] {
  const grouped = collectPlaybackStepGroups(song)
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
        originZnIds: [...flowStep.originZnIds],
        activeTextRanges: flowStep.activeTextRanges.map((range) => ({ ...range })),
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
      originZnIds: [...group.originZnIds],
      activeTextRanges: group.activeTextRanges.map((range) => ({ ...range })),
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
