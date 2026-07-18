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

export interface PlaybackLinkOptions {
  playerUrl: string
  timeResolutionMs?: number
  compression?: 'deflate-raw'
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
const FORMAT_VERSION = 2
const FLAG_DEFLATE_RAW = 1
const FLAG_EVENTS_HAVE_VELOCITY = 2
const FLAG_EVENTS_HAVE_PASS = 4
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

function encodeHeader(eventCount: number, resolutionMs: number, formatFlags: number): Uint8Array {
  const output: number[] = [...MAGIC, FORMAT_VERSION, formatFlags]
  writeVarUInt(output, resolutionMs)
  writeVarUInt(output, eventCount)
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

function encodeEvents(events: readonly PlaybackEvent[], resolutionMs: number, formatFlags: number): { bytes: Uint8Array; breakdown: PlaybackByteBreakdown } {
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
    if (event.position.measureNumber !== previousMeasure) eventFlags |= 1
    if (hasPass && event.position.passIndex !== previousPass) eventFlags |= 2
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

function resolveFormatFlags(events: readonly PlaybackEvent[]): number {
  const hasVelocity = events.some((event) => (event.velocity ?? 127) !== 127)
  const hasPass = events.some((event) => event.position.passIndex !== 1)
  return FLAG_DEFLATE_RAW
    | (hasVelocity ? FLAG_EVENTS_HAVE_VELOCITY : 0)
    | (hasPass ? FLAG_EVENTS_HAVE_PASS : 0)
}

interface EncodedPlaybackPayload {
  payload: Uint8Array
  normalized: PlaybackEvent[]
  breakdown: PlaybackByteBreakdown
  compressedEvents: Uint8Array
}

async function encodePayloadParts(
  events: readonly PlaybackEvent[],
  options: Pick<PlaybackLinkOptions, 'timeResolutionMs'>,
  codec: PlaybackCompressionCodec,
): Promise<EncodedPlaybackPayload> {
  const resolutionMs = options.timeResolutionMs ?? DEFAULT_TIME_RESOLUTION_MS
  if (!Number.isSafeInteger(resolutionMs) || resolutionMs <= 0) throw new Error(`Invalid playback resolution: ${resolutionMs}`)
  const normalized = normalizeEvents(events, resolutionMs)
  const formatFlags = resolveFormatFlags(normalized)
  const header = encodeHeader(normalized.length, resolutionMs, formatFlags)
  const encodedEvents = encodeEvents(normalized, resolutionMs, formatFlags)
  const compressedEvents = await codec.compress(encodedEvents.bytes)
  const payload = new Uint8Array(header.length + compressedEvents.length)
  payload.set(header)
  payload.set(compressedEvents, header.length)
  return {
    payload,
    normalized,
    breakdown: {
      ...encodedEvents.breakdown,
      headerBytes: header.length,
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
  options: Pick<PlaybackLinkOptions, 'timeResolutionMs'>,
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
    markerBytes: 0,
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
  if (version !== LEGACY_FORMAT_VERSION && version !== FORMAT_VERSION) {
    throw new Error(`Unsupported playback format version: ${version}`)
  }
  const formatFlags = payload[4] ?? 0
  if (version === LEGACY_FORMAT_VERSION && formatFlags !== FLAG_DEFLATE_RAW) {
    throw new Error(`Unsupported playback compression flags: ${formatFlags}`)
  }
  if (version === FORMAT_VERSION && (formatFlags & FLAG_DEFLATE_RAW) === 0) {
    throw new Error(`Unsupported playback compression flags: ${formatFlags}`)
  }
  if (version === FORMAT_VERSION && (formatFlags & ~(FLAG_DEFLATE_RAW | FLAG_EVENTS_HAVE_VELOCITY | FLAG_EVENTS_HAVE_PASS)) !== 0) {
    throw new Error(`Unsupported playback format flags: ${formatFlags}`)
  }
  const offset = { value: 5 }
  const timeResolutionMs = readVarUInt(payload, offset)
  const eventCount = readVarUInt(payload, offset)
  if (eventCount > 1_000_000) throw new Error('Playback event count is too large')
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
    } else {
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
    }
    const position = { measureNumber, passIndex }
    validatePosition(position)
    events.push({
      startMs: startUnits * timeResolutionMs,
      durationMs: durationUnits * timeResolutionMs,
      pitch,
      velocity,
      position,
    })
  }
  return { timeResolutionMs, events }
}

/** Decodes a complete Base64URL playback fragment using the platform codec. */
export async function decodePlaybackFragment(value: string, codec: PlaybackCompressionCodec): Promise<PlaybackDecodedData> {
  const encoded = fromBase64Url(value)
  const headerOffset = { value: 5 }
  readVarUInt(encoded, headerOffset)
  readVarUInt(encoded, headerOffset)
  if (headerOffset.value > encoded.length) throw new Error('Playback payload ends inside header')
  const decodedEvents = await codec.decompress(encoded.slice(headerOffset.value))
  const payload = new Uint8Array(headerOffset.value + decodedEvents.length)
  payload.set(encoded.slice(0, headerOffset.value))
  payload.set(decodedEvents, headerOffset.value)
  return decodePlaybackPayload(payload)
}
