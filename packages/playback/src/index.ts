export interface PlaybackPosition {
  measureNumber: number
  passIndex: number
}

export interface PlaybackEvent {
  startMs: number
  durationMs: number
  pitch: number
  velocity?: number
  position: PlaybackPosition
}

export interface PlaybackPositionMarker {
  timeMs: number
  position: PlaybackPosition
  meter?: PlaybackMeter
  partName?: string
}

export interface PlaybackMeter {
  numerator: number
  denominator: number
  grouping?: readonly number[]
}

export interface PlaybackLinkOptions {
  playerUrl: string
  timeResolutionMs?: number
  compression?: 'deflate-raw'
  positionMarkers?: readonly PlaybackPositionMarker[]
  tempoBpm?: number
  tempoUnit?: number
  metronome?: PlaybackMetronomeConfig
}

export type PlaybackMetronomeMode = 'off' | 'countIn' | 'playback' | 'always'
export interface PlaybackMetronomeConfig {
  mode: PlaybackMetronomeMode
  minLeadIn?: number
  bandPreCount?: boolean
  /** Number of main beats per measure; defaults to the current meter numerator. */
  division?: number
  subdivision?: number
}

export interface PlaybackMetronomeClick {
  timeMs: number
  accent: boolean
  kind: 'BAR_START' | 'MAIN_BEAT' | 'SUBDIVISION'
  /** One-based main beat within the configured measure division. */
  beat: number
  /** Number of main beats in the measure containing this click. */
  division: number
  /** Zero-based subdivision within the main beat. */
  subdivision: number
  isLastBeforeEntry: boolean
}

export type PlaybackCountEventKind = import('./metronomeSound.js').PlaybackMetronomeEventKind

export interface PlaybackCountEvent {
  /** Offset from the beginning of the complete count-in, in milliseconds. */
  offsetMs: number
  kind: PlaybackCountEventKind
  /** Zero-based main-beat index within the displayed measure. */
  beat: number
  isLastBeforeEntry: boolean
}

export interface PlaybackCountInPlan {
  durationMs: number
  beatDurationMs: number
  meter: PlaybackMeter
  events: readonly PlaybackCountEvent[]
}

function delayedMeterIndexFor(
  markers: readonly PlaybackPositionMarker[],
  markerIndex: number,
): number {
  const pickupMarker = markers[markerIndex]
  if (pickupMarker === undefined || pickupMarker.meter !== undefined) return -1
  return markers.findIndex((candidate, index) => index > markerIndex
    && candidate.meter !== undefined
    && candidate.position.measureNumber === pickupMarker.position.measureNumber
    && candidate.position.passIndex === pickupMarker.position.passIndex)
}

function measuredDurationFor(
  markers: readonly PlaybackPositionMarker[],
  durationMs: number,
  markerIndex: number,
): number | undefined {
  const marker = markers[markerIndex]
  if (marker?.meter === undefined) return undefined
  const next = markers.slice(markerIndex + 1).find((candidate) => (
    candidate.position.measureNumber !== marker.position.measureNumber
    || candidate.position.passIndex !== marker.position.passIndex
  ))
  const nextIndex = next === undefined ? -1 : markers.indexOf(next)
  const delayedMeterIndex = nextIndex < 0 ? -1 : delayedMeterIndexFor(markers, nextIndex)
  const delayedMeterMarker = delayedMeterIndex < 0 ? undefined : markers[delayedMeterIndex]
  const pickupDurationMs = next !== undefined && next.meter === undefined && delayedMeterMarker !== undefined
    ? delayedMeterMarker.timeMs - next.timeMs
    : 0
  const measuredDurationMs = (next?.timeMs ?? durationMs) - marker.timeMs + pickupDurationMs
  return measuredDurationMs > 0 ? measuredDurationMs : undefined
}

function sameMeter(left: PlaybackMeter | undefined, right: PlaybackMeter): boolean {
  return left?.numerator === right.numerator
    && left.denominator === right.denominator
    && (left.grouping ?? []).join(',') === (right.grouping ?? []).join(',')
}

function referenceMeasureDurationFor(
  markers: readonly PlaybackPositionMarker[],
  durationMs: number,
  meter: PlaybackMeter,
): number | undefined {
  const durations = markers.flatMap((candidate, index) => {
    if (!sameMeter(candidate.meter, meter)) return []
    const measuredDurationMs = measuredDurationFor(markers, durationMs, index)
    return measuredDurationMs === undefined ? [] : [measuredDurationMs]
  })
  if (durations.length === 0) return undefined
  const frequencies = new Map<number, number>()
  for (const duration of durations) {
    const bucket = Math.round(duration)
    frequencies.set(bucket, (frequencies.get(bucket) ?? 0) + 1)
  }
  return [...frequencies.entries()].sort(([leftDuration, leftCount], [rightDuration, rightCount]) => (
    rightCount - leftCount || rightDuration - leftDuration
  ))[0]?.[0]
}

function resolvePlaybackBeatDuration(
  markers: readonly PlaybackPositionMarker[],
  durationMs: number,
  meter: PlaybackMeter,
  division: number,
  tempoBpm?: number,
  tempoUnit = 0.25,
): number {
  if (tempoBpm !== undefined && tempoBpm > 0 && tempoUnit > 0) {
    return 60000 / tempoBpm / (tempoUnit * meter.denominator) * meter.numerator / division
  }
  const referenceMeasureDurationMs = referenceMeasureDurationFor(markers, durationMs, meter)
  if (referenceMeasureDurationMs !== undefined) return referenceMeasureDurationMs / division
  return 0
}

/** Plans count-in events backwards from the actual musical entry. */
export function createPlaybackCountInPlan(
  markers: readonly PlaybackPositionMarker[],
  entryTimeMs: number,
  settings: Pick<PlaybackMetronomeConfig, 'minLeadIn' | 'bandPreCount' | 'division' | 'subdivision'>,
  tempoBpm?: number,
  tempoUnit = 0.25,
): PlaybackCountInPlan | undefined {
  const subdivision = Math.max(1, Math.floor(settings.subdivision ?? 1))
  const openingMarker = markers[0]
  const delayedMeterMarker = markers.find((marker, index) => index > 0
    && marker.meter !== undefined
    && openingMarker !== undefined
    && marker.position.measureNumber === openingMarker.position.measureNumber
    && marker.position.passIndex === openingMarker.position.passIndex)
  const isPickupEntry = openingMarker !== undefined
    && openingMarker.timeMs === entryTimeMs
    && openingMarker.meter === undefined
    && delayedMeterMarker?.meter !== undefined
  let markerIndex = -1
  for (const [index, candidate] of markers.entries()) {
    if (candidate.timeMs > entryTimeMs) break
    if (candidate.meter !== undefined) markerIndex = index
  }
  if (isPickupEntry && delayedMeterMarker !== undefined) markerIndex = markers.indexOf(delayedMeterMarker)
  const marker = markerIndex < 0 ? undefined : markers[markerIndex]
  const meter = marker?.meter
  if (marker === undefined || meter === undefined) return undefined
  const minLeadIn = Math.max(1, Math.floor(settings.minLeadIn ?? meter.numerator))
  const division = Math.max(1, Math.floor(settings.division ?? meter.numerator))
  const timelineDurationMs = Math.max(entryTimeMs, markers[markers.length - 1]?.timeMs ?? 0)
  const beatDurationMs = resolvePlaybackBeatDuration(
    markers,
    timelineDurationMs,
    meter,
    division,
    tempoBpm,
    tempoUnit,
  )
  if (!(beatDurationMs > 0)) return undefined

  let pickupBeats = 0
  if (isPickupEntry && openingMarker !== undefined) {
    const pickupDurationMs = marker.timeMs - openingMarker.timeMs
    const soundingPickupBeats = Math.max(1, Math.min(division, Math.round(pickupDurationMs / beatDurationMs)))
    pickupBeats = Math.max(0, division - soundingPickupBeats)
  }
  const selectionStartMs = openingMarker?.timeMs ?? entryTimeMs
  const availableActualClicks = isPickupEntry
    ? []
    : createPlaybackMetronomeClicks(
      markers,
      entryTimeMs,
      settings.division,
      subdivision,
      tempoBpm,
      tempoUnit,
    )
      .filter((click) => click.timeMs >= selectionStartMs && click.timeMs < entryTimeMs)
  let actualClickStartIndex = 0
  let mainBeatsFromCandidate = 0
  for (let index = availableActualClicks.length - 1; index >= 0; index -= 1) {
    const click = availableActualClicks[index]
    if (click === undefined) continue
    if (click.subdivision === 0) mainBeatsFromCandidate += 1
    if (click.kind === 'BAR_START' && mainBeatsFromCandidate >= minLeadIn) {
      actualClickStartIndex = index
      break
    }
  }
  const actualClicks = availableActualClicks.slice(actualClickStartIndex)
  const actualMainBeatCount = actualClicks.filter((click) => click.subdivision === 0).length
  const availableBeatCount = pickupBeats + actualMainBeatCount
  const precedingFullBeats = availableBeatCount >= minLeadIn
    ? 0
    : Math.ceil((minLeadIn - availableBeatCount) / division) * division
  const virtualBeatCount = precedingFullBeats + pickupBeats
  const virtualDurationMs = virtualBeatCount * beatDurationMs
  const actualStartMs = actualClicks[0]?.timeMs ?? entryTimeMs
  const actualDurationMs = isPickupEntry ? 0 : Math.max(0, entryTimeMs - actualStartMs)
  const normalDurationMs = virtualDurationMs + actualDurationMs
  const bandDurationMs = settings.bandPreCount === true ? 4 * beatDurationMs : 0
  const events: PlaybackCountEvent[] = []
  if (settings.bandPreCount === true) {
    events.push(
      { offsetMs: 0, kind: 'PRE_COUNT', beat: 0, isLastBeforeEntry: false },
      { offsetMs: 2 * beatDurationMs, kind: 'PRE_COUNT', beat: 2, isLastBeforeEntry: false },
    )
  }
  for (let beatIndex = 0; beatIndex < virtualBeatCount; beatIndex += 1) {
    const beat = beatIndex % division
    for (let subdivisionIndex = 0; subdivisionIndex < subdivision; subdivisionIndex += 1) {
      const kind: PlaybackCountEventKind = subdivisionIndex > 0
        ? 'SUBDIVISION'
        : beat === 0 ? 'BAR_START' : 'MAIN_BEAT'
      events.push({
        offsetMs: bandDurationMs + (beatIndex + subdivisionIndex / subdivision) * beatDurationMs,
        kind,
        beat,
        isLastBeforeEntry: false,
      })
    }
  }
  for (const click of actualClicks) {
    events.push({
      offsetMs: bandDurationMs + virtualDurationMs + click.timeMs - actualStartMs,
      kind: click.kind,
      beat: click.beat - 1,
      isLastBeforeEntry: false,
    })
  }
  const lastEvent = events[events.length - 1]
  if (lastEvent !== undefined && lastEvent.kind !== 'PRE_COUNT') lastEvent.isLastBeforeEntry = true
  return { durationMs: bandDurationMs + normalDurationMs, beatDurationMs, meter, events }
}

/** Creates metric clicks from the shared time-based position track. */
export function createPlaybackMetronomeClicks(
  markers: readonly PlaybackPositionMarker[],
  durationMs: number,
  division?: number,
  subdivision = 1,
  tempoBpm?: number,
  tempoUnit = 0.25,
): PlaybackMetronomeClick[] {
  const clicks: PlaybackMetronomeClick[] = []
  const safeSubdivision = Math.max(1, Math.floor(subdivision))
  for (const [pickupMarkerIndex, pickupMarker] of markers.entries()) {
    const delayedMeterIndex = delayedMeterIndexFor(markers, pickupMarkerIndex)
    const delayedMeterMarker = delayedMeterIndex < 0 ? undefined : markers[delayedMeterIndex]
    if (pickupMarker.meter !== undefined || delayedMeterMarker?.meter === undefined) continue
    const safeDivision = Math.max(1, Math.floor(division ?? delayedMeterMarker.meter.numerator))
    const beatDurationMs = resolvePlaybackBeatDuration(
      markers, durationMs, delayedMeterMarker.meter, safeDivision, tempoBpm, tempoUnit,
    )
    const pickupDurationMs = delayedMeterMarker.timeMs - pickupMarker.timeMs
    if (!(beatDurationMs > 0) || !(pickupDurationMs > 0)) continue
    const pickupBeatCount = Math.max(1, Math.min(safeDivision, Math.round(pickupDurationMs / beatDurationMs)))
    const pickupStartBeat = safeDivision - pickupBeatCount
    for (let clickIndex = 0; clickIndex < pickupBeatCount * safeSubdivision; clickIndex += 1) {
      const subdivisionIndex = clickIndex % safeSubdivision
      const beat = pickupStartBeat + Math.floor(clickIndex / safeSubdivision)
      const timeMs = pickupMarker.timeMs + clickIndex * beatDurationMs / safeSubdivision
      if (timeMs >= durationMs || timeMs >= delayedMeterMarker.timeMs) continue
      clicks.push({
        timeMs,
        accent: beat === 0 && subdivisionIndex === 0,
        kind: subdivisionIndex > 0 ? 'SUBDIVISION' : beat === 0 ? 'BAR_START' : 'MAIN_BEAT',
        beat: beat + 1,
        division: safeDivision,
        subdivision: subdivisionIndex,
        isLastBeforeEntry: false,
      })
    }
  }
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index]
    if (marker === undefined || marker.meter === undefined) continue
    const safeDivision = Math.max(1, Math.floor(division ?? marker.meter.numerator))
    const next = markers.slice(index + 1).find((candidate) => (
      candidate.position.measureNumber !== marker.position.measureNumber
      || candidate.position.passIndex !== marker.position.passIndex
    ))
    const nextIndex = next === undefined ? -1 : markers.indexOf(next)
    const delayedMeterIndex = nextIndex < 0 ? -1 : delayedMeterIndexFor(markers, nextIndex)
    const delayedMeterMarker = delayedMeterIndex < 0 ? undefined : markers[delayedMeterIndex]
    const pickupDurationMs = next !== undefined && next.meter === undefined && delayedMeterMarker !== undefined
      ? delayedMeterMarker.timeMs - next.timeMs
      : 0
    const measureEndMs = next?.timeMs ?? durationMs
    const measureDurationMs = measureEndMs - marker.timeMs + pickupDurationMs
    if (measureDurationMs <= 0) continue
    const clickCount = safeDivision * safeSubdivision
    const beatDurationMs = resolvePlaybackBeatDuration(
      markers, durationMs, marker.meter, safeDivision, tempoBpm, tempoUnit,
    )
    if (!(beatDurationMs > 0)) continue
    for (let clickIndex = 0; clickIndex < clickCount; clickIndex += 1) {
      const mainBeat = clickIndex % safeSubdivision === 0
      const kind = clickIndex === 0 ? 'BAR_START' : mainBeat ? 'MAIN_BEAT' : 'SUBDIVISION'
      const timeMs = marker.timeMs + clickIndex * beatDurationMs / safeSubdivision
      if (timeMs >= durationMs || timeMs >= measureEndMs) continue
      clicks.push({
        timeMs,
        accent: kind === 'BAR_START',
        kind,
        beat: Math.floor(clickIndex / safeSubdivision) + 1,
        division: safeDivision,
        subdivision: clickIndex % safeSubdivision,
        isLastBeforeEntry: false,
      })
    }
  }
  return clicks.sort((left, right) => left.timeMs - right.timeMs || left.subdivision - right.subdivision)
}

export interface PlaybackLinkResult {
  url: string
  payload: Uint8Array
  encodedPayload: string
  analysis: PlaybackLinkAnalysis
}

export interface PlaybackByteBreakdown {
  headerBytes: number
  timeBytes: number
  durationBytes: number
  pitchBytes: number
  velocityBytes: number
  instrumentBytes: number
  voiceBytes: number
  flagsBytes: number
  idsBytes: number
  markerBytes: number
  otherMetadataBytes: number
}

export interface PlaybackLinkAnalysis {
  eventCount: number
  binaryBytes: number
  compressedBytes: number
  base64UrlChars: number
  bytesPerEvent: number
  breakdown: PlaybackByteBreakdown
  percentages: PlaybackByteBreakdown
}

const MAGIC = new Uint8Array([0x5a, 0x4e, 0x50])
const LEGACY_FORMAT_VERSION = 1
const COMPACT_FORMAT_VERSION = 2
const POSITION_FORMAT_VERSION = 3
const TEMPO_FORMAT_VERSION = 4
const PART_FORMAT_VERSION = 5
const METRONOME_FORMAT_VERSION = 7
const FORMAT_VERSION = 8
const FLAG_DEFLATE_RAW = 1
const FLAG_EVENTS_HAVE_VELOCITY = 2
const FLAG_EVENTS_HAVE_PASS = 4
const FLAG_HAS_POSITION_TRACK = 8
const FLAG_POSITION_MARKERS_HAVE_METER = 16
const FLAG_HAS_TEMPO = 32
const FLAG_POSITION_MARKERS_HAVE_PART_NAME = 64
const FLAG_HAS_METRONOME_CONFIG = 128
const DEFAULT_TIME_RESOLUTION_MS = 10

/** Platform adapter for the one compression method supported by format v1. */
export interface PlaybackCompressionCodec {
  compress(value: Uint8Array): Promise<Uint8Array>
  decompress(value: Uint8Array): Promise<Uint8Array>
}

/** Encoded link payload together with its player URL. */
export interface PlaybackDecodedData {
  timeResolutionMs: number
  events: PlaybackEvent[]
  positionMarkers: PlaybackPositionMarker[]
  tempoBpm?: number
  tempoUnit?: number
  metronome?: PlaybackMetronomeConfig
}

function writeVarUInt(target: number[], value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Playback VarUInt out of range: ${value}`)
  let remaining = value
  do {
    let byte = remaining % 128
    remaining = Math.floor(remaining / 128)
    if (remaining > 0) byte |= 128
    target.push(byte)
  } while (remaining > 0)
}

function readVarUInt(bytes: Uint8Array, offset: { value: number }): number {
  let result = 0
  let multiplier = 1
  for (let count = 0; count < 8; count += 1) {
    const byte = bytes[offset.value]
    if (byte === undefined) throw new Error('Playback payload ends inside VarUInt')
    offset.value += 1
    result += (byte & 127) * multiplier
    if ((byte & 128) === 0) return result
    multiplier *= 128
  }
  throw new Error('Playback VarUInt is too long')
}

function validatePosition(position: PlaybackPosition): void {
  if (!Number.isSafeInteger(position.measureNumber) || position.measureNumber < 1) {
    throw new Error(`Invalid playback measure number: ${position.measureNumber}`)
  }
  if (!Number.isSafeInteger(position.passIndex) || position.passIndex < 1) {
    throw new Error(`Invalid playback pass number: ${position.passIndex}`)
  }
}

function quantize(valueMs: number, resolutionMs: number): number {
  if (!Number.isFinite(valueMs) || valueMs < 0) throw new Error(`Invalid playback time: ${valueMs}`)
  return Math.max(0, Math.round(valueMs / resolutionMs))
}

function normalizeEvents(events: readonly PlaybackEvent[], resolutionMs: number): PlaybackEvent[] {
  const normalized = events.map((event) => {
    validatePosition(event.position)
    if (!Number.isSafeInteger(event.pitch) || event.pitch < 0 || event.pitch > 127) {
      throw new Error(`Invalid playback MIDI pitch: ${event.pitch}`)
    }
    const velocity = event.velocity ?? 127
    if (!Number.isSafeInteger(velocity) || velocity < 0 || velocity > 127) {
      throw new Error(`Invalid playback velocity: ${velocity}`)
    }
    const duration = Math.max(1, quantize(event.durationMs, resolutionMs))
    return {
      ...event,
      startMs: quantize(event.startMs, resolutionMs) * resolutionMs,
      durationMs: duration * resolutionMs,
      velocity,
    }
  })
  normalized.sort((left, right) => left.startMs - right.startMs || left.pitch - right.pitch)
  return normalized
}

function encodeHeader(eventCount: number, markerCount: number, resolutionMs: number, formatFlags: number): Uint8Array {
  const output: number[] = [...MAGIC, FORMAT_VERSION, formatFlags]
  writeVarUInt(output, resolutionMs)
  writeVarUInt(output, eventCount)
  writeVarUInt(output, markerCount)
  return new Uint8Array(output)
}

function createEmptyBreakdown(): PlaybackByteBreakdown {
  return {
    headerBytes: 0,
    timeBytes: 0,
    durationBytes: 0,
    pitchBytes: 0,
    velocityBytes: 0,
    instrumentBytes: 0,
    voiceBytes: 0,
    flagsBytes: 0,
    idsBytes: 0,
    markerBytes: 0,
    otherMetadataBytes: 0,
  }
}

function encodeEvents(events: readonly PlaybackEvent[], resolutionMs: number, formatFlags: number, includeEventPositions: boolean): { bytes: Uint8Array; breakdown: PlaybackByteBreakdown } {
  const output: number[] = []
  const breakdown = createEmptyBreakdown()
  const hasVelocity = (formatFlags & FLAG_EVENTS_HAVE_VELOCITY) !== 0
  const hasPass = (formatFlags & FLAG_EVENTS_HAVE_PASS) !== 0
  let previousStart = 0
  let previousMeasure = 0
  let previousPass = 1
  for (const event of events) {
    const start = quantize(event.startMs, resolutionMs)
    const duration = Math.max(1, quantize(event.durationMs, resolutionMs))
    const timeStart = output.length
    writeVarUInt(output, start - previousStart)
    breakdown.timeBytes += output.length - timeStart
    const durationStart = output.length
    writeVarUInt(output, duration)
    breakdown.durationBytes += output.length - durationStart
    output.push(event.pitch)
    breakdown.pitchBytes += 1
    const flagsStart = output.length
    let eventFlags = 0
    if (includeEventPositions && event.position.measureNumber !== previousMeasure) eventFlags |= 1
    if (includeEventPositions && hasPass && event.position.passIndex !== previousPass) eventFlags |= 2
    if (hasVelocity) eventFlags |= 4
    output.push(eventFlags)
    breakdown.flagsBytes += output.length - flagsStart
    if ((eventFlags & 1) !== 0) {
      const measureStart = output.length
      writeVarUInt(output, event.position.measureNumber)
      breakdown.otherMetadataBytes += output.length - measureStart
      previousMeasure = event.position.measureNumber
    }
    if ((eventFlags & 2) !== 0) {
      const passStart = output.length
      writeVarUInt(output, event.position.passIndex)
      breakdown.otherMetadataBytes += output.length - passStart
      previousPass = event.position.passIndex
    }
    if (hasVelocity) {
      output.push(event.velocity ?? 127)
      breakdown.velocityBytes += 1
    }
    previousStart = start
  }
  return { bytes: new Uint8Array(output), breakdown }
}

function normalizePositionMarkers(
  markers: readonly PlaybackPositionMarker[] | undefined,
  events: readonly PlaybackEvent[],
  resolutionMs: number,
): PlaybackPositionMarker[] {
  const source: readonly PlaybackPositionMarker[] = markers === undefined || markers.length === 0
    ? events.map((event) => ({ timeMs: event.startMs, position: event.position }))
    : markers
  const normalized = source.map((marker) => {
    validatePosition(marker.position)
    if (marker.meter !== undefined) {
      if (!Number.isSafeInteger(marker.meter.numerator) || marker.meter.numerator <= 0
        || !Number.isSafeInteger(marker.meter.denominator) || marker.meter.denominator <= 0) {
        throw new Error('Invalid playback meter')
      }
    }
    return {
      timeMs: quantize(marker.timeMs, resolutionMs) * resolutionMs,
      position: { ...marker.position },
      partName: marker.partName === undefined || marker.partName.trim() === '' ? undefined : marker.partName,
      meter: marker.meter === undefined ? undefined : {
        numerator: marker.meter.numerator,
        denominator: marker.meter.denominator,
        grouping: marker.meter.grouping === undefined ? undefined : [...marker.meter.grouping],
      },
    }
  }).sort((left, right) => left.timeMs - right.timeMs)
  const deduplicated: PlaybackPositionMarker[] = []
  for (const marker of normalized) {
    const previous = deduplicated[deduplicated.length - 1]
    if (previous !== undefined && previous.position.measureNumber === marker.position.measureNumber
      && previous.position.passIndex === marker.position.passIndex) {
      if (previous.timeMs === marker.timeMs && previous.partName === undefined && marker.partName !== undefined) {
        previous.partName = marker.partName
      }
      if (previous.timeMs === marker.timeMs && previous.meter === undefined && marker.meter !== undefined) {
        previous.meter = marker.meter
      } else if (previous.meter === undefined && marker.meter !== undefined && marker.timeMs > previous.timeMs) {
        deduplicated.push(marker)
      } else if (marker.meter === undefined && previous.meter !== undefined && marker.timeMs > previous.timeMs) {
        deduplicated.push(marker)
      }
      continue
    }
    deduplicated.push(marker)
  }
  return deduplicated
}

function encodePositionMarkers(markers: readonly PlaybackPositionMarker[], resolutionMs: number, includeMeter: boolean, includePartName: boolean): { bytes: Uint8Array; markerBytes: number } {
  const output: number[] = []
  let previousTime = 0
  for (const marker of markers) {
    const time = quantize(marker.timeMs, resolutionMs)
    writeVarUInt(output, time - previousTime)
    writeVarUInt(output, marker.position.measureNumber)
    writeVarUInt(output, marker.position.passIndex)
    if (includeMeter) {
      const hasMeter = marker.meter !== undefined
      output.push(hasMeter ? 1 : 0)
      if (hasMeter) {
        writeVarUInt(output, marker.meter?.numerator ?? 4)
        writeVarUInt(output, marker.meter?.denominator ?? 4)
        const grouping = marker.meter?.grouping ?? []
        writeVarUInt(output, grouping.length)
        for (const value of grouping) writeVarUInt(output, value)
      }
    }
    if (includePartName) {
      const partName = marker.partName
      if (partName === undefined || partName.trim() === '') {
        output.push(0)
      } else {
        const bytes = new TextEncoder().encode(partName)
        if (bytes.length > 1024) throw new Error('Playback part name is too long')
        output.push(1)
        writeVarUInt(output, bytes.length)
        output.push(...bytes)
      }
    }
    previousTime = time
  }
  return { bytes: new Uint8Array(output), markerBytes: output.length }
}

interface EncodedPlaybackPayload {
  payload: Uint8Array
  normalized: PlaybackEvent[]
  positionMarkers: PlaybackPositionMarker[]
  breakdown: PlaybackByteBreakdown
  compressedEvents: Uint8Array
}

async function encodePayloadParts(
  events: readonly PlaybackEvent[],
  options: Pick<PlaybackLinkOptions, 'timeResolutionMs' | 'positionMarkers' | 'tempoBpm' | 'tempoUnit' | 'metronome'>,
  codec: PlaybackCompressionCodec,
): Promise<EncodedPlaybackPayload> {
  const resolutionMs = options.timeResolutionMs ?? DEFAULT_TIME_RESOLUTION_MS
  if (!Number.isSafeInteger(resolutionMs) || resolutionMs <= 0) throw new Error(`Invalid playback resolution: ${resolutionMs}`)
  const normalized = normalizeEvents(events, resolutionMs)
  const positionMarkers = normalizePositionMarkers(options.positionMarkers, normalized, resolutionMs)
  const formatFlags = FLAG_DEFLATE_RAW | FLAG_HAS_POSITION_TRACK
    | (normalized.some((event) => (event.velocity ?? 127) !== 127) ? FLAG_EVENTS_HAVE_VELOCITY : 0)
    | (positionMarkers.some((marker) => marker.meter !== undefined) ? FLAG_POSITION_MARKERS_HAVE_METER : 0)
    | (positionMarkers.some((marker) => marker.partName !== undefined && marker.partName.trim() !== '') ? FLAG_POSITION_MARKERS_HAVE_PART_NAME : 0)
    | (options.metronome !== undefined ? FLAG_HAS_METRONOME_CONFIG : 0)
    | (options.tempoBpm !== undefined && options.tempoBpm > 0 ? FLAG_HAS_TEMPO : 0)
  const header = encodeHeader(normalized.length, positionMarkers.length, resolutionMs, formatFlags)
  const encodedEvents = encodeEvents(normalized, resolutionMs, formatFlags, false)
  const encodedMarkers = encodePositionMarkers(positionMarkers, resolutionMs,
    (formatFlags & FLAG_POSITION_MARKERS_HAVE_METER) !== 0,
    (formatFlags & FLAG_POSITION_MARKERS_HAVE_PART_NAME) !== 0)
  const metadata: number[] = []
  if ((formatFlags & FLAG_HAS_TEMPO) !== 0) {
    writeVarUInt(metadata, Math.round((options.tempoBpm ?? 0) * 100))
    writeVarUInt(metadata, Math.round((options.tempoUnit ?? 0.25) * 100000))
  }
  if ((formatFlags & FLAG_HAS_METRONOME_CONFIG) !== 0) {
    const metronome = options.metronome
    if (metronome === undefined) throw new Error('Missing playback metronome config')
    const modes: PlaybackMetronomeMode[] = ['off', 'countIn', 'playback', 'always']
    const mode = modes.indexOf(metronome.mode)
    if (mode < 0) throw new Error(`Invalid playback metronome mode: ${metronome.mode}`)
    // Zero encodes the dynamic default (the current meter numerator).
    const minLeadIn = metronome.minLeadIn ?? 0
    const division = metronome.division ?? 0
    const subdivision = metronome.subdivision ?? 1
    if (!Number.isSafeInteger(minLeadIn) || minLeadIn < 0
      || !Number.isSafeInteger(division) || division < 0
      || !Number.isSafeInteger(subdivision) || subdivision < 1) {
      throw new Error('Invalid playback count settings')
    }
    metadata.push(mode)
    writeVarUInt(metadata, minLeadIn)
    writeVarUInt(metadata, metronome.bandPreCount === true ? 1 : 0)
    writeVarUInt(metadata, division)
    writeVarUInt(metadata, subdivision)
  }
  const eventAndMarkerBytes = new Uint8Array(metadata.length + encodedEvents.bytes.length + encodedMarkers.bytes.length)
  eventAndMarkerBytes.set(metadata)
  eventAndMarkerBytes.set(encodedEvents.bytes, metadata.length)
  eventAndMarkerBytes.set(encodedMarkers.bytes, metadata.length + encodedEvents.bytes.length)
  const compressedEvents = await codec.compress(eventAndMarkerBytes)
  const payload = new Uint8Array(header.length + compressedEvents.length)
  payload.set(header)
  payload.set(compressedEvents, header.length)
  return {
    payload,
    normalized,
    positionMarkers,
    breakdown: {
      ...encodedEvents.breakdown,
      headerBytes: header.length,
      markerBytes: encodedMarkers.markerBytes,
    },
    compressedEvents,
  }
}

function toBase64Url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let base64 = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    base64 += alphabet[first >> 2]
    base64 += alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)]
    base64 += second === undefined ? '=' : alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)]
    base64 += third === undefined ? '=' : alphabet[third & 63]
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes: number[] = []
  for (let index = 0; index < padded.length; index += 4) {
    const a = alphabet.indexOf(padded[index] ?? '=')
    const b = alphabet.indexOf(padded[index + 1] ?? '=')
    const c = alphabet.indexOf(padded[index + 2] ?? '=')
    const d = alphabet.indexOf(padded[index + 3] ?? '=')
    if (a < 0 || b < 0 || (padded[index + 2] !== '=' && c < 0) || (padded[index + 3] !== '=' && d < 0)) {
      throw new Error('Invalid playback Base64URL')
    }
    bytes.push((a << 2) | (b >> 4))
    if (padded[index + 2] !== '=') bytes.push(((b & 15) << 4) | (c >> 2))
    if (padded[index + 3] !== '=') bytes.push(((c & 3) << 6) | d)
  }
  return new Uint8Array(bytes)
}

/** Encodes audio events into the versioned compressed playback payload. */
export async function encodePlaybackPayload(
  events: readonly PlaybackEvent[],
  options: Pick<PlaybackLinkOptions, 'timeResolutionMs' | 'positionMarkers' | 'metronome'>,
  codec: PlaybackCompressionCodec,
): Promise<Uint8Array> {
  return (await encodePayloadParts(events, options, codec)).payload
}

/** Creates a hash-fragment playback URL from normalized audio events. */
export async function exportPlaybackLink(
  events: readonly PlaybackEvent[],
  options: PlaybackLinkOptions,
  codec: PlaybackCompressionCodec,
): Promise<PlaybackLinkResult> {
  const encoded = await encodePayloadParts(events, options, codec)
  const { payload, normalized, breakdown } = encoded
  const encodedPayload = toBase64Url(payload)
  const url = new URL(options.playerUrl)
  url.hash = `p=${encodedPayload}`
  const binaryBytes = breakdown.headerBytes + breakdown.timeBytes + breakdown.durationBytes
    + breakdown.pitchBytes + breakdown.velocityBytes + breakdown.instrumentBytes
    + breakdown.voiceBytes + breakdown.flagsBytes + breakdown.idsBytes + breakdown.markerBytes
    + breakdown.otherMetadataBytes
  const percentages: PlaybackByteBreakdown = {
    headerBytes: binaryBytes === 0 ? 0 : breakdown.headerBytes / binaryBytes * 100,
    timeBytes: binaryBytes === 0 ? 0 : breakdown.timeBytes / binaryBytes * 100,
    durationBytes: binaryBytes === 0 ? 0 : breakdown.durationBytes / binaryBytes * 100,
    pitchBytes: binaryBytes === 0 ? 0 : breakdown.pitchBytes / binaryBytes * 100,
    velocityBytes: binaryBytes === 0 ? 0 : breakdown.velocityBytes / binaryBytes * 100,
    instrumentBytes: 0,
    voiceBytes: 0,
    flagsBytes: binaryBytes === 0 ? 0 : breakdown.flagsBytes / binaryBytes * 100,
    idsBytes: 0,
    markerBytes: binaryBytes === 0 ? 0 : breakdown.markerBytes / binaryBytes * 100,
    otherMetadataBytes: binaryBytes === 0 ? 0 : breakdown.otherMetadataBytes / binaryBytes * 100,
  }
  return {
    url: url.toString(),
    payload,
    encodedPayload,
    analysis: {
      eventCount: normalized.length,
      binaryBytes,
      compressedBytes: encoded.payload.length,
      base64UrlChars: encodedPayload.length,
      bytesPerEvent: normalized.length === 0 ? 0 : binaryBytes / normalized.length,
      breakdown,
      percentages,
    },
  }
}

/** Decodes and validates a playback payload after platform decompression. */
export function decodePlaybackPayload(payload: Uint8Array): PlaybackDecodedData {
  if (payload.length < 6 || !MAGIC.every((value, index) => payload[index] === value)) throw new Error('Invalid playback payload magic')
  const version = payload[3]
  if (version !== LEGACY_FORMAT_VERSION && version !== COMPACT_FORMAT_VERSION
    && version !== POSITION_FORMAT_VERSION && version !== TEMPO_FORMAT_VERSION
    && version !== PART_FORMAT_VERSION && version !== METRONOME_FORMAT_VERSION && version !== FORMAT_VERSION) {
    throw new Error(`Unsupported playback format version: ${version}`)
  }
  const formatFlags = payload[4] ?? 0
  if (version === LEGACY_FORMAT_VERSION && formatFlags !== FLAG_DEFLATE_RAW) {
    throw new Error(`Unsupported playback compression flags: ${formatFlags}`)
  }
  if (version !== LEGACY_FORMAT_VERSION && (formatFlags & FLAG_DEFLATE_RAW) === 0) {
    throw new Error(`Unsupported playback compression flags: ${formatFlags}`)
  }
  if (version === COMPACT_FORMAT_VERSION && (formatFlags & ~(FLAG_DEFLATE_RAW | FLAG_EVENTS_HAVE_VELOCITY | FLAG_EVENTS_HAVE_PASS)) !== 0) {
    throw new Error(`Unsupported playback format flags: ${formatFlags}`)
  }
  const isPositionFormat = version >= POSITION_FORMAT_VERSION
  if (isPositionFormat && (formatFlags & ~(FLAG_DEFLATE_RAW | FLAG_EVENTS_HAVE_VELOCITY | FLAG_HAS_POSITION_TRACK | FLAG_POSITION_MARKERS_HAVE_METER | FLAG_HAS_TEMPO | FLAG_POSITION_MARKERS_HAVE_PART_NAME | FLAG_HAS_METRONOME_CONFIG)) !== 0) {
    throw new Error(`Unsupported playback format flags: ${formatFlags}`)
  }
  const offset = { value: 5 }
  const timeResolutionMs = readVarUInt(payload, offset)
  const eventCount = readVarUInt(payload, offset)
  const markerCount = isPositionFormat ? readVarUInt(payload, offset) : 0
  if (eventCount > 1_000_000) throw new Error('Playback event count is too large')
  let tempoBpm: number | undefined
  let tempoUnit: number | undefined
  let metronome: PlaybackMetronomeConfig | undefined
  if (version >= TEMPO_FORMAT_VERSION && (formatFlags & FLAG_HAS_TEMPO) !== 0) {
    tempoBpm = readVarUInt(payload, offset) / 100
    tempoUnit = readVarUInt(payload, offset) / 100000
    if (!(tempoBpm > 0) || !(tempoUnit > 0)) throw new Error('Invalid playback tempo metadata')
  }
  if (version >= METRONOME_FORMAT_VERSION && (formatFlags & FLAG_HAS_METRONOME_CONFIG) !== 0) {
    const modeValue = payload[offset.value]
    if (modeValue === undefined || modeValue > 3) throw new Error('Invalid playback metronome mode')
    offset.value += 1
    const modes: PlaybackMetronomeMode[] = ['off', 'countIn', 'playback', 'always']
    const encodedMinLeadIn = readVarUInt(payload, offset)
    const bandPreCount = readVarUInt(payload, offset)
    const division = readVarUInt(payload, offset)
    const subdivision = readVarUInt(payload, offset)
    if (encodedMinLeadIn < 0 || bandPreCount > 1
      || (version === METRONOME_FORMAT_VERSION ? division < 1 : division < 0)
      || subdivision < 1) throw new Error('Invalid playback count settings')
    metronome = {
      mode: modes[modeValue] ?? 'off',
      minLeadIn: encodedMinLeadIn === 0 ? undefined : encodedMinLeadIn,
      bandPreCount: bandPreCount === 1,
      division: division === 0 ? undefined : division,
      subdivision,
    }
  }
  const events: PlaybackEvent[] = []
  let startUnits = 0
  let measureNumber = 0
  let passIndex = 1
  for (let index = 0; index < eventCount; index += 1) {
    startUnits += readVarUInt(payload, offset)
    const durationUnits = readVarUInt(payload, offset)
    const pitch = payload[offset.value]
    if (pitch === undefined) throw new Error('Playback payload ends inside an event')
    offset.value += 1
    let velocity = 127
    if (version === LEGACY_FORMAT_VERSION) {
      const legacyVelocity = payload[offset.value]
      if (legacyVelocity === undefined) throw new Error('Playback payload ends inside an event')
      velocity = legacyVelocity
      offset.value += 1
      measureNumber = readVarUInt(payload, offset)
      passIndex = readVarUInt(payload, offset)
    } else if (version === COMPACT_FORMAT_VERSION) {
      const eventFlags = payload[offset.value]
      if (eventFlags === undefined) throw new Error('Playback payload ends inside an event')
      offset.value += 1
      if ((eventFlags & ~7) !== 0) throw new Error(`Unsupported playback event flags: ${eventFlags}`)
      if ((eventFlags & 1) !== 0) measureNumber = readVarUInt(payload, offset)
      if ((eventFlags & 2) !== 0) passIndex = readVarUInt(payload, offset)
      if ((formatFlags & FLAG_EVENTS_HAVE_VELOCITY) !== 0) {
        const eventVelocity = payload[offset.value]
        if (eventVelocity === undefined) throw new Error('Playback payload ends inside an event')
        velocity = eventVelocity
        offset.value += 1
      }
    } else {
      const eventFlags = payload[offset.value]
      if (eventFlags === undefined) throw new Error('Playback payload ends inside an event')
      offset.value += 1
      if ((eventFlags & ~4) !== 0) throw new Error(`Unsupported playback event flags: ${eventFlags}`)
      if ((formatFlags & FLAG_EVENTS_HAVE_VELOCITY) !== 0) {
        const eventVelocity = payload[offset.value]
        if (eventVelocity === undefined) throw new Error('Playback payload ends inside an event')
        velocity = eventVelocity
        offset.value += 1
      }
    }
    const position = isPositionFormat
      ? { measureNumber: 1, passIndex: 1 }
      : { measureNumber, passIndex }
    validatePosition(position)
    events.push({
      startMs: startUnits * timeResolutionMs,
      durationMs: durationUnits * timeResolutionMs,
      pitch,
      velocity,
      position,
    })
  }
  const positionMarkers: PlaybackPositionMarker[] = []
  if (isPositionFormat) {
    if ((formatFlags & FLAG_HAS_POSITION_TRACK) === 0) throw new Error('Playback payload has no position track')
    let markerTimeUnits = 0
    for (let index = 0; index < markerCount; index += 1) {
      markerTimeUnits += readVarUInt(payload, offset)
      const measureNumber = readVarUInt(payload, offset)
      const passIndex = readVarUInt(payload, offset)
      const position = { measureNumber, passIndex }
      validatePosition(position)
      let meter: PlaybackMeter | undefined
      if ((formatFlags & FLAG_POSITION_MARKERS_HAVE_METER) !== 0) {
        const meterFlags = payload[offset.value]
        if (meterFlags === undefined) throw new Error('Playback payload ends inside a position marker')
        offset.value += 1
        if ((meterFlags & 1) !== 0) {
          const numerator = readVarUInt(payload, offset)
          const denominator = readVarUInt(payload, offset)
          const groupingCount = readVarUInt(payload, offset)
          if (groupingCount > 32) throw new Error('Playback meter grouping is too large')
          const grouping: number[] = []
          for (let groupingIndex = 0; groupingIndex < groupingCount; groupingIndex += 1) {
            grouping.push(readVarUInt(payload, offset))
          }
          meter = grouping.length > 0 ? { numerator, denominator, grouping } : { numerator, denominator }
        }
      }
      let partName: string | undefined
      if (version >= 5 && (formatFlags & FLAG_POSITION_MARKERS_HAVE_PART_NAME) !== 0) {
        const partFlags = payload[offset.value]
        if (partFlags === undefined) throw new Error('Playback payload ends inside a position marker')
        offset.value += 1
        if ((partFlags & ~1) !== 0) throw new Error(`Unsupported playback part flags: ${partFlags}`)
        if ((partFlags & 1) !== 0) {
          const length = readVarUInt(payload, offset)
          if (length > 1024 || offset.value + length > payload.length) throw new Error('Invalid playback part name')
          const bytes = payload.slice(offset.value, offset.value + length)
          offset.value += length
          partName = new TextDecoder().decode(bytes)
        }
      }
      positionMarkers.push({ timeMs: markerTimeUnits * timeResolutionMs, position, meter, partName })
    }
    let markerIndex = 0
    let currentPosition = positionMarkers[0]?.position ?? { measureNumber: 1, passIndex: 1 }
    for (const event of events) {
      while (markerIndex + 1 < positionMarkers.length
        && (positionMarkers[markerIndex + 1]?.timeMs ?? Number.POSITIVE_INFINITY) <= event.startMs) {
        markerIndex += 1
        currentPosition = positionMarkers[markerIndex]?.position ?? currentPosition
      }
      event.position = { ...currentPosition }
    }
  } else {
    const deduplicated = new Map<string, PlaybackPositionMarker>()
    for (const event of events) {
      const key = `${event.startMs}:${event.position.measureNumber}:${event.position.passIndex}`
      deduplicated.set(key, { timeMs: event.startMs, position: { ...event.position } })
    }
    positionMarkers.push(...deduplicated.values())
  }
  return { timeResolutionMs, events, positionMarkers, tempoBpm, tempoUnit, metronome }
}

/** Decodes a complete Base64URL playback fragment using the platform codec. */
export async function decodePlaybackFragment(value: string, codec: PlaybackCompressionCodec): Promise<PlaybackDecodedData> {
  const encoded = fromBase64Url(value)
  const headerOffset = { value: 5 }
  readVarUInt(encoded, headerOffset)
  readVarUInt(encoded, headerOffset)
  if (encoded[3] !== undefined && encoded[3] >= POSITION_FORMAT_VERSION) readVarUInt(encoded, headerOffset)
  if (headerOffset.value > encoded.length) throw new Error('Playback payload ends inside header')
  const decodedEvents = await codec.decompress(encoded.slice(headerOffset.value))
  const payload = new Uint8Array(headerOffset.value + decodedEvents.length)
  payload.set(encoded.slice(0, headerOffset.value))
  payload.set(decodedEvents, headerOffset.value)
  return decodePlaybackPayload(payload)
}

export {
  resolvePlaybackMetronomeEventSound,
  resolvePlaybackMetronomeSound,
  schedulePlaybackMetronomeClick,
} from './metronomeSound.js'
export type { PlaybackMetronomeEventKind, PlaybackMetronomeSound, PlaybackMetronomeSoundKind } from './metronomeSound.js'
