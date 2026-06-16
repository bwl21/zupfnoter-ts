import type {
  PlaybackFlowStep,
  SelectionTextRange,
  PlayableEntity,
  Song,
  Voice,
  VoiceEntity,
  Goto,
} from '@zupfnoter/types'

interface PlaybackNote {
  pitch: number
  durationMs: number
  attack: boolean
}

interface ExpandedVoiceEvent {
  voiceIndex: number
  entityIndex: number
  playbackTimeMs: number
  durationMs: number
  passIndex: number
  sourceTime: number
  originZnIds: string[]
  activeTextRanges: SelectionTextRange[]
  activeNotes: PlaybackNote[]
  activeStartChar?: number
  voltaNumber?: number
}

interface TraversalState {
  entityIndex: number
  passIndex: number
  currentPlaybackTimeMs: number
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
  const shortestNote = 64
  const wholeNoteFraction = duration / shortestNote
  return Math.max(120, (wholeNoteFraction / unit) * (60000 / bpm))
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
      return entity.notes.map((note) => ({
        pitch: note.pitch,
        durationMs: computeStepDurationMs(song, note.duration),
        attack: !note.tieEnd || note.tieStart,
      }))
  }
}

function uniqueTextRanges(ranges: SelectionTextRange[]): SelectionTextRange[] {
  const seen = new Map<string, SelectionTextRange>()
  for (const range of ranges) {
    const key = `${range.startpos}:${range.endpos}`
    if (!seen.has(key)) seen.set(key, range)
  }
  return [...seen.values()]
}

function createTextRange(entity: PlayableEntity): SelectionTextRange | undefined {
  const offsets = entity.sourceOffsets
  if (offsets === undefined) return undefined
  return { startpos: offsets[0], endpos: offsets[1] }
}

function expandVoice(song: Song, voice: Voice): ExpandedVoiceEvent[] {
  const entityIndexByObject = new Map<VoiceEntity, number>()
  voice.entities.forEach((entity, index) => {
    entityIndexByObject.set(entity, index)
  })

  const emittedRepeatCounts = new Map<number, number>()
  const events: ExpandedVoiceEvent[] = []
  const state: TraversalState = {
    entityIndex: 0,
    passIndex: 1,
    currentPlaybackTimeMs: 0,
  }

  while (state.entityIndex < voice.entities.length) {
    const entity = voice.entities[state.entityIndex]
    if (entity === undefined) break

    if (entity.type === 'Goto' && entity.policy.isRepeat === true) {
      const goto = entity as Goto
      const fromIndex = entityIndexByObject.get(goto.from as VoiceEntity)
      const toIndex = entityIndexByObject.get(goto.to as VoiceEntity)
      if (fromIndex !== undefined && toIndex !== undefined) {
        const seen = emittedRepeatCounts.get(fromIndex) ?? 0
        if (seen < 1) {
          emittedRepeatCounts.set(fromIndex, seen + 1)
          state.passIndex += 1
          state.entityIndex = toIndex
          continue
        }
      }
      state.entityIndex += 1
      continue
    }

    if (!isPlayableEntity(entity)) {
      state.entityIndex += 1
      continue
    }

    if (entity.variant === 1 && state.passIndex > 1) {
      state.entityIndex += 1
      continue
    }
    if (entity.variant === 2 && state.passIndex === 1) {
      state.entityIndex += 1
      continue
    }

    const durationMs = computeStepDurationMs(song, entity.duration)
    const textRange = createTextRange(entity)
    const activeTextRanges = textRange === undefined ? [] : [textRange]
    const event: ExpandedVoiceEvent = {
      voiceIndex: voice.index,
      entityIndex: state.entityIndex,
      playbackTimeMs: state.currentPlaybackTimeMs,
      durationMs,
      passIndex: state.passIndex,
      sourceTime: entity.time,
      originZnIds: [entity.znId],
      activeTextRanges,
      activeNotes: collectActiveNotes(entity, song),
      activeStartChar: textRange?.startpos,
      voltaNumber: entity.variant > 0 ? entity.variant : undefined,
    }
    events.push(event)
    state.currentPlaybackTimeMs += durationMs
    state.entityIndex += 1
  }

  return events
}

function mergeExpandedVoices(events: ExpandedVoiceEvent[]): PlaybackFlowStep[] {
  const grouped = new Map<number, ExpandedVoiceEvent[]>()
  for (const event of events) {
    const bucket = grouped.get(event.playbackTimeMs)
    if (bucket === undefined) {
      grouped.set(event.playbackTimeMs, [event])
      continue
    }
    bucket.push(event)
  }

  const playbackTimes = [...grouped.keys()].sort((left, right) => left - right)
  return playbackTimes.map((playbackTimeMs, flowIndex) => {
    const bucket = grouped.get(playbackTimeMs) ?? []
    const originZnIds = [...new Set(bucket.flatMap((event) => event.originZnIds))]
    const activeTextRanges = uniqueTextRanges(bucket.flatMap((event) => event.activeTextRanges))
    const activeNotes = bucket.flatMap((event) => event.activeNotes)
    const primary = bucket[0]
    return {
      playbackStartMs: playbackTimeMs,
      sourceTime: primary?.sourceTime ?? 0,
      originZnIds,
      activeTextRanges,
      activeNotes,
      activeStartChar: bucket
        .map((event) => event.activeStartChar)
        .find((value): value is number => value !== undefined),
      flowIndex,
      passIndex: primary?.passIndex ?? 1,
      voltaNumber: primary?.voltaNumber,
    }
  })
}

export function expandPlaybackFlow(song: Song): PlaybackFlowStep[] {
  const expanded: ExpandedVoiceEvent[] = []
  for (const voice of song.voices) {
    expanded.push(...expandVoice(song, voice))
  }
  return mergeExpandedVoices(expanded)
}
