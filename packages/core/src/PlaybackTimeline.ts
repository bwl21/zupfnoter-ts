import type {
  PlaybackNote,
  PlaybackStep,
  PlaybackStepTextRange,
  PlayableEntity,
  SelectionTextRange,
  Song,
  TimeSignature,
  VoiceEntity,
} from '@zupfnoter/types'
import { expandPlaybackFlow } from './PlaybackFlow.js'

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
    if (typeof firstDuration === 'number' && firstDuration > 0) return firstDuration
  }
  return 0.25
}

function computeNoteDurationMs(song: Song, duration: number): number {
  const wholeNoteFraction = duration / 64
  return Math.max(120, (wholeNoteFraction / resolveTempoUnit(song)) * (60000 / resolveTempoBpm(song)))
}

export function resolveBaseTempoFromSong(song: Song): number {
  return resolveTempoBpm(song)
}

/** Returns the whole-note fraction used by the ABC tempo declaration. */
export function resolveTempoUnitFromSong(song: Song): number {
  const tempo = song.metaData.tempo
  if (tempo !== undefined && typeof tempo !== 'number' && tempo.duration.length > 0) {
    const firstDuration = tempo.duration[0]
    if (typeof firstDuration === 'number' && firstDuration > 0) return firstDuration
  }
  return 0.25
}

function buildPlaybackIdentity(voiceId: string | undefined, znId: string): string {
  return `${voiceId ?? '?'}::${znId}`
}

type TiedPlaybackNote = PlaybackNote

function appendPlaybackNote(
  notes: PlaybackNote[],
  pendingTies: Map<string, TiedPlaybackNote>,
  endedPlaybackIds: string[],
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
      endedPlaybackIds.push(pending.originPlaybackId)
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
  if (tieStart) pendingTies.set(tieKey, nextNote)
  else pendingTies.delete(tieKey)
}

function collectActiveNotes(
  entity: PlayableEntity,
  song: Song,
  voiceIndex: number,
  originVoiceId: string,
  pendingTies: Map<string, TiedPlaybackNote>,
  endedPlaybackIds: string[],
): PlaybackNote[] {
  const notes: PlaybackNote[] = []
  const originPlaybackId = buildPlaybackIdentity(originVoiceId, entity.znId)
  if (entity.type === 'Pause') return notes
  if (entity.type === 'Note') {
    appendPlaybackNote(notes, pendingTies, endedPlaybackIds, originVoiceId, originPlaybackId, entity.znId,
      voiceIndex, entity.pitch, computeNoteDurationMs(song, entity.duration), entity.tieStart, entity.tieEnd)
    return notes
  }
  for (const note of entity.notes) {
    appendPlaybackNote(notes, pendingTies, endedPlaybackIds, originVoiceId, originPlaybackId, entity.znId,
      voiceIndex, note.pitch, computeNoteDurationMs(song, note.duration), entity.tieStart, entity.tieEnd)
  }
  return notes
}

interface PlaybackStepGroup {
  originVoiceIds: string[]
  originPlaybackIds: string[]
  originZnIds: string[]
  activeTextRanges: SelectionTextRange[]
  activePlaybackTextRanges: PlaybackStepTextRange[]
  endedPlaybackIds: string[]
  activeNotes: PlaybackNote[]
  activeStartChar?: number
  maxEntityTimeDuration: number
}

function textRangeKey(range: SelectionTextRange): string {
  return `${range.startpos}:${range.endpos}`
}

function collectPlaybackStepGroups(song: Song, activeVoices?: readonly number[]): Map<number, PlaybackStepGroup> {
  const grouped = new Map<number, PlaybackStepGroup>()
  const allowedVoiceIndexes = activeVoices === undefined ? undefined : new Set(activeVoices)

  for (const voice of song.voices) {
    const originVoiceId = voice.index > 0 ? `${voice.index}` : undefined
    if (originVoiceId === undefined || (allowedVoiceIndexes !== undefined && !allowedVoiceIndexes.has(voice.index))) continue
    const pendingTies = new Map<string, TiedPlaybackNote>()
    const endedPlaybackIds: string[] = []
    for (const entity of voice.entities) {
      if (!isPlayableEntity(entity)) continue
      const existing = grouped.get(entity.time)
      const textRange = entity.sourceOffsets === undefined
        ? undefined
        : { startpos: entity.sourceOffsets[0], endpos: entity.sourceOffsets[1] }
      const endedCount = endedPlaybackIds.length
      const notes = collectActiveNotes(entity, song, voice.index, originVoiceId, pendingTies, endedPlaybackIds)
      const originPlaybackId = buildPlaybackIdentity(originVoiceId, entity.znId)
      const entityEndedPlaybackIds = endedPlaybackIds.slice(endedCount)
      if (existing === undefined) {
        grouped.set(entity.time, {
          originVoiceIds: [originVoiceId],
          originPlaybackIds: [originPlaybackId],
          originZnIds: [entity.znId],
          activeTextRanges: textRange === undefined ? [] : [textRange],
          activePlaybackTextRanges: textRange === undefined ? [] : [{ playbackId: originPlaybackId, voiceId: originVoiceId, textRange }],
          endedPlaybackIds: entityEndedPlaybackIds,
          activeNotes: notes,
          activeStartChar: entity.sourceOffsets?.[0],
          maxEntityTimeDuration: entity.duration,
        })
        continue
      }
      existing.originVoiceIds.push(originVoiceId)
      existing.originPlaybackIds.push(originPlaybackId)
      existing.originZnIds.push(entity.znId)
      if (textRange !== undefined) {
        existing.activeTextRanges.push(textRange)
        existing.activePlaybackTextRanges.push({ playbackId: originPlaybackId, voiceId: originVoiceId, textRange })
      }
      existing.activeNotes.push(...notes)
      existing.endedPlaybackIds.push(...entityEndedPlaybackIds)
      existing.activeStartChar = existing.activeStartChar === undefined || entity.sourceOffsets === undefined
        ? existing.activeStartChar ?? entity.sourceOffsets?.[0]
        : Math.min(existing.activeStartChar, entity.sourceOffsets[0])
      existing.maxEntityTimeDuration = Math.max(existing.maxEntityTimeDuration, entity.duration)
    }
  }

  for (const group of grouped.values()) {
    group.originVoiceIds = [...new Set(group.originVoiceIds)]
    group.originPlaybackIds = [...new Set(group.originPlaybackIds)]
    group.originZnIds = [...new Set(group.originZnIds)]
    group.activeTextRanges = [...new Map(group.activeTextRanges.map((range) => [textRangeKey(range), range])).values()]
    group.activePlaybackTextRanges = [...new Map(group.activePlaybackTextRanges.map((entry) => [
      `${entry.playbackId}:${textRangeKey(entry.textRange)}`, entry,
    ])).values()]
    group.activeNotes = [...new Map(group.activeNotes.map((note) => [
      `${note.originPlaybackId}:${note.pitch}:${note.attack ? 1 : 0}:${note.pan}`, note,
    ])).values()]
    group.endedPlaybackIds = [...new Set(group.endedPlaybackIds)]
  }
  return grouped
}

export function buildPlaybackTimeline(song: Song, activeVoices?: readonly number[]): PlaybackStep[] {
  const grouped = collectPlaybackStepGroups(song, activeVoices)
  const flow = expandPlaybackFlow(song)
  const sourceTimes = [...grouped.keys()].sort((left, right) => left - right)
  const nextSourceTime = new Map<number, number>()
  for (let index = 0; index + 1 < sourceTimes.length; index += 1) {
    const current = sourceTimes[index]
    const next = sourceTimes[index + 1]
    if (current !== undefined && next !== undefined) nextSourceTime.set(current, next)
  }
  const unit = resolveTempoUnit(song)
  const bpm = resolveTempoBpm(song)
  const timeToMs = (duration: number): number => Math.max(120, (duration / 1536 / unit) * (60000 / bpm))
  let cursorMs = 0

  return flow.map((flowStep, index) => {
    const group = grouped.get(flowStep.sourceTime)
    const nextFlowStep = flow[index + 1]
    const nextSource = nextSourceTime.get(flowStep.sourceTime)
    const followsSource = nextFlowStep?.sourceTime === nextSource && nextSource !== undefined
    const durationUnits = group === undefined
      ? 64
      : followsSource && nextSource !== undefined && nextSource > flowStep.sourceTime
        ? nextSource - flowStep.sourceTime
        : group.maxEntityTimeDuration * 1536 / 64
    const step: PlaybackStep = group === undefined
      ? {
        originVoiceIds: [],
        originPlaybackIds: [...new Set(flowStep.originZnIds.map((znId) => buildPlaybackIdentity(undefined, znId)))],
        originZnIds: [...flowStep.originZnIds],
        activeTextRanges: flowStep.activeTextRanges.map((range) => ({ ...range })),
        activePlaybackTextRanges: [],
        endedPlaybackIds: [],
        activeNotes: [],
        activeStartChar: flowStep.activeStartChar,
        activeTime: `${flowStep.sourceTime}`,
        playbackStartMs: cursorMs,
        durationMs: timeToMs(durationUnits),
        sourceTime: flowStep.sourceTime,
        position: { measureNumber: flowStep.measureNumber, passIndex: flowStep.passIndex },
        meter: flowStep.meter,
        flowIndex: flowStep.flowIndex,
        passIndex: flowStep.passIndex,
        voltaNumber: flowStep.voltaNumber,
      }
      : {
        originVoiceIds: [...group.originVoiceIds],
        originPlaybackIds: [...group.originPlaybackIds],
        originZnIds: [...group.originZnIds],
        activeTextRanges: group.activeTextRanges.map((range) => ({ ...range })),
        activePlaybackTextRanges: group.activePlaybackTextRanges.map((entry) => ({ ...entry, textRange: { ...entry.textRange } })),
        endedPlaybackIds: [...group.endedPlaybackIds],
        activeNotes: [...group.activeNotes],
        activeStartChar: group.activeStartChar,
        activeTime: `${flowStep.sourceTime}`,
        playbackStartMs: cursorMs,
        durationMs: timeToMs(durationUnits),
        sourceTime: flowStep.sourceTime,
        position: { measureNumber: flowStep.measureNumber, passIndex: flowStep.passIndex },
        meter: flowStep.meter,
        flowIndex: flowStep.flowIndex,
        passIndex: flowStep.passIndex,
        voltaNumber: flowStep.voltaNumber,
      }
    cursorMs += step.durationMs
    return step
  })
}
