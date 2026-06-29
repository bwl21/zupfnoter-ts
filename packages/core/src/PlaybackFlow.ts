import type {
  Goto,
  PlaybackFlowStep,
  PlayableEntity,
  SelectionTextRange,
  Song,
  VoiceEntity,
} from '@zupfnoter/types'

interface PlayableGroup {
  sourceTime: number
  originZnIds: string[]
  activeTextRanges: SelectionTextRange[]
  activeStartChar?: number
  voltaNumber?: number
}

function isPlayableEntity(entity: VoiceEntity): entity is PlayableEntity {
  return entity.type === 'Note' || entity.type === 'Pause' || entity.type === 'SynchPoint'
}

function isGotoEntity(entity: VoiceEntity): entity is Goto {
  return entity.type === 'Goto'
}

function collectPlayableGroups(song: Song): Map<number, PlayableGroup> {
  const groups = new Map<number, PlayableGroup>()

  for (const voice of song.voices) {
    for (const entity of voice.entities) {
      if (!isPlayableEntity(entity)) continue

      const existing = groups.get(entity.time)
      const textRange = entity.sourceOffsets === undefined
        ? undefined
        : { startpos: entity.sourceOffsets[0], endpos: entity.sourceOffsets[1] }

      if (existing === undefined) {
        groups.set(entity.time, {
          sourceTime: entity.time,
          originZnIds: [entity.znId],
          activeTextRanges: textRange === undefined ? [] : [textRange],
          activeStartChar: entity.sourceOffsets?.[0],
          voltaNumber: entity.variant > 0 ? entity.variant : undefined,
        })
        continue
      }

      existing.originZnIds.push(entity.znId)
      if (textRange !== undefined) {
        existing.activeTextRanges.push(textRange)
      }
      existing.activeStartChar = existing.activeStartChar === undefined
        ? entity.sourceOffsets?.[0]
        : entity.sourceOffsets === undefined
          ? existing.activeStartChar
          : Math.min(existing.activeStartChar, entity.sourceOffsets[0])
      if (entity.variant > 0) {
        existing.voltaNumber = existing.voltaNumber === undefined
          ? entity.variant
          : Math.max(existing.voltaNumber, entity.variant) as 1 | 2
      }
    }
  }

  for (const group of groups.values()) {
    group.originZnIds = [...new Set(group.originZnIds)]
    group.activeTextRanges = [...new Map(
      group.activeTextRanges.map((range) => [`${range.startpos}:${range.endpos}`, range]),
    ).values()]
  }

  return groups
}

function resolveGotoConfKey(goto: Goto): string | undefined {
  return goto.confKey ?? goto.policy.confKey
}

function isRepeatGoto(goto: Goto): boolean {
  const confKey = resolveGotoConfKey(goto)
  return goto.policy.isRepeat === true
    && goto.from.time > goto.to.time
    && confKey?.endsWith('.p_repeat') === true
}

function isVariantBeginGoto(goto: Goto): boolean {
  const confKey = resolveGotoConfKey(goto)
  return goto.policy.isRepeat === true
    && goto.to.time > goto.from.time
    && confKey?.endsWith('.p_begin') === true
}

function isVariantFollowGoto(goto: Goto): boolean {
  const confKey = resolveGotoConfKey(goto)
  return goto.policy.isRepeat === true
    && goto.to.time > goto.from.time
    && (confKey?.endsWith('.p_follow') === true || confKey?.endsWith('.p_end') === true)
}

function parseVariantBeginOrder(goto: Goto): number {
  const confKey = resolveGotoConfKey(goto)
  const match = confKey?.match(/\.([0-9]+)\.p_begin$/)
  const order = match?.[1]
  if (order === undefined) return 0
  const parsed = Number.parseInt(order, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

interface RepeatDecision {
  key: string
  fromTime: number
  toTime: number
  level: number
}

interface VariantBeginDecision {
  fromTime: number
  toTime: number
  order: number
}

function collectRepeatDecisions(song: Song): Map<number, RepeatDecision> {
  const grouped = new Map<string, RepeatDecision>()

  for (const voice of song.voices) {
    for (const entity of voice.entities) {
      if (!isGotoEntity(entity) || !isRepeatGoto(entity)) continue

      const level = entity.policy.level ?? 0
      const groupKey = `${entity.to.time}:${level}`
      const existing = grouped.get(groupKey)
      if (existing !== undefined && existing.fromTime >= entity.from.time) continue

      grouped.set(groupKey, {
        key: `${entity.from.time}:${entity.to.time}:${level}`,
        fromTime: entity.from.time,
        toTime: entity.to.time,
        level,
      })
    }
  }

  const decisions = new Map<number, RepeatDecision>()
  for (const decision of grouped.values()) {
    decisions.set(decision.fromTime, decision)
  }

  return decisions
}

function collectVariantBeginDecisions(song: Song): Map<number, VariantBeginDecision[]> {
  const grouped = new Map<string, VariantBeginDecision>()

  for (const voice of song.voices) {
    for (const entity of voice.entities) {
      if (!isGotoEntity(entity) || !isVariantBeginGoto(entity)) continue

      const order = parseVariantBeginOrder(entity)
      const groupKey = `${order}:${entity.to.time}`
      const existing = grouped.get(groupKey)
      if (existing !== undefined && existing.fromTime >= entity.from.time) continue
      grouped.set(groupKey, {
        fromTime: entity.from.time,
        toTime: entity.to.time,
        order,
      })
    }
  }

  const decisions = new Map<number, VariantBeginDecision[]>()
  for (const decision of grouped.values()) {
    const existing = decisions.get(decision.fromTime) ?? []
    if (!decisions.has(decision.fromTime)) {
      decisions.set(decision.fromTime, existing)
    }
    existing.push(decision)
  }

  for (const decisionList of decisions.values()) {
    decisionList.sort((left, right) => left.order - right.order || left.toTime - right.toTime)
  }

  return decisions
}

function collectVariantFollowDecisions(song: Song): Map<number, number> {
  const grouped = new Map<string, { fromTime: number; toTime: number }>()

  for (const voice of song.voices) {
    for (const entity of voice.entities) {
      if (!isGotoEntity(entity) || !isVariantFollowGoto(entity)) continue

      const groupKey = `${entity.to.time}`
      const existing = grouped.get(groupKey)
      if (existing !== undefined && existing.fromTime >= entity.from.time) continue
      grouped.set(groupKey, { fromTime: entity.from.time, toTime: entity.to.time })
    }
  }

  const decisions = new Map<number, number>()
  for (const decision of grouped.values()) {
    const existing = decisions.get(decision.fromTime)
    if (existing === undefined || decision.toTime < existing) {
      decisions.set(decision.fromTime, decision.toTime)
    }
  }

  return decisions
}

/**
 * Expand the notated song into a playback flow that follows repeats and voltas.
 */
export function expandPlaybackFlow(song: Song): PlaybackFlowStep[] {
  const groups = collectPlayableGroups(song)
  const times = [...groups.keys()].sort((left, right) => left - right)
  if (times.length === 0) return []

  const repeatDecisions = collectRepeatDecisions(song)
  const repeatDecisionByKey = new Map(
    [...repeatDecisions.values()].map((decision) => [decision.key, decision]),
  )
  const variantBeginDecisions = collectVariantBeginDecisions(song)
  const variantFollowDecisions = collectVariantFollowDecisions(song)
  const timeIndexByTime = new Map(times.map((time, index) => [time, index]))
  const flow: PlaybackFlowStep[] = []
  const repeatUsageByKey = new Map<string, number>()
  const variantUsageByFromTime = new Map<number, number>()
  let index = 0
  let passIndex = 1
  let guard = 0
  const maxIterations = Math.max(
    times.length * 8,
    256,
  )

  while (index < times.length) {
    guard += 1
    if (guard > maxIterations) {
      throw new Error('expandPlaybackFlow(): repeat traversal exceeded safety limit')
    }

    const time = times[index]
    if (time === undefined) {
      break
    }

    const group = groups.get(time)
    if (group !== undefined) {
      flow.push({
        sourceTime: group.sourceTime,
        originZnIds: [...group.originZnIds],
        activeTextRanges: group.activeTextRanges.map((range) => ({ ...range })),
        activeStartChar: group.activeStartChar,
        flowIndex: flow.length,
        passIndex,
        voltaNumber: group.voltaNumber,
      })
    }

    const variantBegins = variantBeginDecisions.get(time)
    if (variantBegins !== undefined && variantBegins.length > 0) {
      const variantUsage = variantUsageByFromTime.get(time) ?? 0
      if (variantUsage === 0) {
        variantUsageByFromTime.set(time, 1)
      } else {
      const selectedVariant = variantBegins[variantUsage]
        if (selectedVariant !== undefined) {
          variantUsageByFromTime.set(time, variantUsage + 1)
          const jumpIndex = timeIndexByTime.get(selectedVariant.toTime)
          if (jumpIndex === undefined) {
            throw new Error(`expandPlaybackFlow(): missing variant begin target time ${selectedVariant.toTime}`)
          }
          index = jumpIndex
          continue
        }
      }
    }

    const repeatDecision = repeatDecisions.get(time)
    if (repeatDecision !== undefined) {
      const repeatUsage = repeatUsageByKey.get(repeatDecision.key) ?? 0
      if (repeatUsage === 0) {
        repeatUsageByKey.set(repeatDecision.key, 1)
        if (repeatDecision.level > 1) {
          for (const [key, usage] of repeatUsageByKey.entries()) {
            const nestedDecision = repeatDecisionByKey.get(key)
            if (
              usage > 0 &&
              nestedDecision !== undefined &&
              nestedDecision.fromTime > repeatDecision.toTime &&
              nestedDecision.fromTime < repeatDecision.fromTime
            ) {
              repeatUsageByKey.delete(key)
            }
          }

        }
        passIndex += 1
        const jumpIndex = timeIndexByTime.get(repeatDecision.toTime)
        if (jumpIndex === undefined) {
          throw new Error(`expandPlaybackFlow(): missing repeat target time ${repeatDecision.toTime}`)
        }
        index = jumpIndex
        continue
      }
    }

    const followTarget = variantFollowDecisions.get(time)
    if (followTarget !== undefined) {
      const jumpIndex = timeIndexByTime.get(followTarget)
      if (jumpIndex === undefined) {
        throw new Error(`expandPlaybackFlow(): missing variant follow target time ${followTarget}`)
      }
      index = jumpIndex
      continue
    }

    index += 1
  }

  return flow
}
