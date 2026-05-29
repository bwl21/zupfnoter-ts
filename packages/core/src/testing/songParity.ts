import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { transformFixtureToSong, loadFixture, scanFixtureCases, type FixtureCase } from './fixtureLoader.js'

// ---------------------------------------------------------------------------
// Repository paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../../..')
const CONTRACT_PATH = resolve(REPO_ROOT, 'fixtures/contracts/song-field-contract.json')
const CASES_ROOT = resolve(REPO_ROOT, 'fixtures/cases')
const REPORTS_ROOT = resolve(REPO_ROOT, 'fixtures/reports')

// ---------------------------------------------------------------------------
// Contract types
// ---------------------------------------------------------------------------

export type SongParitySource = 'legacy' | 'ts'
export type MatchQuality = 'exact-source' | 'exact-position' | 'near-position' | 'sequence' | 'unmatched' | 'ambiguous'
export type GapCategory =
  | 'missing-event'
  | 'extra-event'
  | 'missing-field'
  | 'extra-field'
  | 'different-value'
  | 'different-array-order'
  | 'different-length'
  | 'different-type'
  | 'matching-ambiguous'
  | 'ignored-by-contract'
  | 'normalization-warning'

interface ContractSection {
  required: string[]
  optional: string[]
  ignored: string[]
  aliases: Record<string, string[]>
  tolerances: Record<string, number>
}

interface SongFieldContract {
  version: number
  song: ContractSection
  meta: ContractSection
  voice: ContractSection
  event: ContractSection & {
    kinds: Record<string, ContractSection>
  }
}

// ---------------------------------------------------------------------------
// Normalized model
// ---------------------------------------------------------------------------

export interface ParityDiagnostic {
  category: Exclude<GapCategory, 'missing-event' | 'extra-event' | 'missing-field' | 'extra-field' | 'different-value' | 'different-array-order' | 'different-length' | 'different-type' | 'matching-ambiguous'>
  path: string
  message: string
  source: SongParitySource
  field?: string
  value?: unknown
}

export interface NormalizedMeta {
  title?: string
  composer?: string
  number?: string
  filename?: string
  meter?: string | string[]
  key?: string
  oKey?: string
  tempo?: number | { duration: number[]; bpm: number }
  tempoDisplay?: string
  checksum?: string
  diagnostics: ParityDiagnostic[]
  raw?: Record<string, unknown>
}

export interface NormalizedRepeatInfo {
  firstInPart?: boolean
  measureStart?: boolean
  measureCount?: number
  countNote?: string | null
  tieStart?: boolean
  tieEnd?: boolean
  tuplet?: number
  tupletStart?: boolean
  tupletEnd?: boolean
  nextPitch?: number
  prevPitch?: number
  slurStarts?: number[]
  slurEnds?: number[]
  jumpStarts?: string[]
  jumpEnds?: string[]
  lyrics?: string | null
}

export interface NormalizedGotoInfo {
  fromBeat?: number
  toBeat?: number
  policy?: Record<string, unknown>
}

export interface NormalizedEvent {
  stableKey: string
  kind: string
  voiceId: string
  voiceIndex: number
  indexInVoice: number
  globalIndex: number
  measure?: number
  beat?: number
  absBeat?: number
  duration?: number
  abcStart?: [number, number]
  abcEnd?: [number, number]
  sourceOffsets?: [number, number]
  abcExcerpt?: string
  abcText?: string
  pitch?: number
  octave?: number
  string?: number
  fret?: number
  decorations: string[]
  lyrics?: string | null
  variant?: 0 | 1 | 2
  repeatInfo?: NormalizedRepeatInfo
  gotoInfo?: NormalizedGotoInfo
  sourcePath: string
  raw?: Record<string, unknown>
  debug?: Record<string, unknown>
}

export interface SongParityContext {
  caseId: string
  abcText: string
}

export interface NormalizedVoice {
  voiceId: string
  voiceIndex: number
  name?: string
  showVoice?: boolean
  showFlowline?: boolean
  showJumpline?: boolean
  events: NormalizedEvent[]
  diagnostics: ParityDiagnostic[]
  raw?: Record<string, unknown>
}

export interface NormalizedHarpnoteOptions {
  lyrics?: {
    text?: string | null
  }
  template?: {
    filebase?: string
    title?: string
  }
  print?: Array<Record<string, unknown>>
  diagnostics: ParityDiagnostic[]
  raw?: Record<string, unknown>
}

export interface NormalizedSong {
  harpnoteOptions?: NormalizedHarpnoteOptions
  meta: NormalizedMeta
  voices: NormalizedVoice[]
  events: NormalizedEvent[]
  diagnostics: ParityDiagnostic[]
  source: SongParitySource
  raw?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Comparison result
// ---------------------------------------------------------------------------

export interface MatchedEventPair {
  quality: MatchQuality
  legacy: NormalizedEvent
  ts: NormalizedEvent
  trace: MatchTraceEntry
}

export interface MatchingCandidate {
  index: number
  quality: MatchQuality
  score: number
  reason: string
}

export interface MatchTraceEntry {
  voiceIndex: number
  legacyIndex: number
  legacyStableKey: string
  legacyKind: string
  candidates: MatchingCandidate[]
  selectedIndex?: number
  selectedQuality?: MatchQuality
  selectedReason?: string
}

export interface SongGap {
  category: GapCategory
  caseId: string
  stage: 'song'
  voiceIndex?: number
  voiceId?: string
  measure?: number
  beat?: number
  eventKind?: string
  stableKey?: string
  legacyJsonPath?: string
  tsJsonPath?: string
  legacyValue?: unknown
  tsValue?: unknown
  legacyAbcPosition?: string
  tsAbcPosition?: string
  abcExcerpt?: string
  matchQuality?: MatchQuality
  impact: string
  message: string
}

export interface SongParityComparisonResult {
  caseId: string
  legacy: NormalizedSong
  ts: NormalizedSong
  matchedEvents: MatchedEventPair[]
  unmatchedLegacyEvents: NormalizedEvent[]
  unmatchedTsEvents: NormalizedEvent[]
  gaps: SongGap[]
  trace: MatchTraceEntry[]
  requiredGapCount: number
  warningCount: number
}

export interface SongParityCaseReport {
  caseId: string
  caseDir: string
  normalizedDir: string
  reportDir: string
  debugDir: string
  result: SongParityComparisonResult
}

export interface SongParityRunSummary {
  cases: SongParityCaseReport[]
  requiredGapCount: number
  warningCount: number
}

// ---------------------------------------------------------------------------
// Contract loading
// ---------------------------------------------------------------------------

function loadContract(): SongFieldContract {
  const raw = JSON.parse(readFileSync(CONTRACT_PATH, 'utf-8')) as SongFieldContract
  return raw
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function readPoint(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined
  const left = value[0]
  const right = value[1]
  if (typeof left !== 'number' || typeof right !== 'number') return undefined
  return [left, right]
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return undefined
    out.push(item)
  }
  return out
}

function readNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: number[] = []
  for (const item of value) {
    if (typeof item !== 'number') return undefined
    out.push(item)
  }
  return out
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function formatPath(base: string, suffix: string): string {
  return base.length === 0 ? suffix : `${base}.${suffix}`
}

function extractAbcExcerptFromOffsets(
  abcText: string,
  startOffset?: number,
  endOffset?: number,
): string | undefined {
  if (startOffset === undefined || !Number.isFinite(startOffset)) return undefined
  const resolvedEnd = endOffset !== undefined && Number.isFinite(endOffset) ? endOffset : startOffset
  const slice = abcText.slice(Math.max(0, startOffset), Math.max(startOffset, resolvedEnd + 1))
  const normalized = slice.replace(/\r\n?/g, '\n').replace(/\n/g, ' ⏎ ').replace(/\s+/g, ' ').trim()
  if (normalized.length === 0) return undefined
  return normalized.length > 180 ? `${normalized.slice(0, 177)}…` : normalized
}

function lineStartOffsets(text: string): number[] {
  const offsets: number[] = [0]
  for (let index = 0; index < text.length; index++) {
    if (text[index] !== '\n') continue
    offsets.push(index + 1)
  }
  return offsets
}

function toAbsoluteOffset(text: string, position: [number, number]): number | undefined {
  const [line, column] = position
  if (line < 1 || column < 1) return undefined
  const starts = lineStartOffsets(text)
  const lineStart = starts[line - 1]
  if (lineStart === undefined) return undefined
  return lineStart + column - 1
}

function extractAbcExcerptFromPositions(
  abcText: string,
  startPos?: [number, number],
  endPos?: [number, number],
): string | undefined {
  if (startPos === undefined) return undefined
  const start = toAbsoluteOffset(abcText, startPos)
  if (start === undefined) return undefined
  const resolvedEndPos = endPos ?? startPos
  const end = toAbsoluteOffset(abcText, resolvedEndPos)
  if (end === undefined) return undefined
  return extractAbcExcerptFromOffsets(abcText, start, end)
}

function sortKeys<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) as T
}

function extractDeclaredFieldAliases(section: ContractSection, field: string): string[] {
  return section.aliases[field] ?? []
}

const LEGACY_EVENT_KNOWN_KEYS = new Set([
  'class',
  '@beat',
  '@time',
  '@duration',
  '@start_pos',
  '@end_pos',
  '@text',
  '@pitch',
  '@decorations',
  '@lyrics',
  '@variant',
  '@measure_count',
  '@measure_start',
  '@first_in_part',
  '@count_note',
  '@tie_start',
  '@tie_end',
  '@tuplet',
  '@tuplet_start',
  '@tuplet_end',
  '@prev_pitch',
  '@next_pitch',
  '@slur_starts',
  '@slur_ends',
  '@jump_starts',
  '@jump_ends',
  '@from',
  '@to',
  '@policy',
  'beat',
  'time',
  'duration',
  'startPos',
  'endPos',
  'text',
  'pitch',
  'decorations',
  'lyrics',
  'variant',
  'measureCount',
  'measureStart',
  'firstInPart',
  'countNote',
  'tieStart',
  'tieEnd',
  'tuplet',
  'tupletStart',
  'tupletEnd',
  'prevPitch',
  'nextPitch',
  'slurStarts',
  'slurEnds',
  'jumpStarts',
  'jumpEnds',
  'fromBeat',
  'toBeat',
  'policy',
])

const TS_EVENT_KNOWN_KEYS = new Set([
  'type',
  'beat',
  'time',
  'duration',
  'startPos',
  'endPos',
  'text',
  'pitch',
  'decorations',
  'lyrics',
  'variant',
  'measureStart',
  'measureCount',
  'firstInPart',
  'countNote',
  'tieStart',
  'tieEnd',
  'tuplet',
  'tupletStart',
  'tupletEnd',
  'nextPitch',
  'prevPitch',
  'slurStarts',
  'slurEnds',
  'jumpStarts',
  'jumpEnds',
  'from',
  'to',
  'policy',
  'confKey',
  'visible',
  'barDecorations',
  'znId',
  'raw',
  'debug',
  'measure',
  'absBeat',
  'octave',
  'string',
  'fret',
  'sourcePath',
  'voiceIndex',
  'voiceId',
  'indexInVoice',
  'globalIndex',
  'stableKey',
  'repeatInfo',
  'gotoInfo',
])

function addDiagnostic(
  diagnostics: ParityDiagnostic[],
  category: ParityDiagnostic['category'],
  source: SongParitySource,
  path: string,
  message: string,
  field?: string,
  value?: unknown,
): void {
  diagnostics.push({ category, source, path, message, field, value })
}

function mergeDiagnostics(...lists: ParityDiagnostic[]): ParityDiagnostic[] {
  return [...lists]
}

function coerceSongMeta(meta: Record<string, unknown> | undefined, source: SongParitySource, path: string): NormalizedMeta {
  const diagnostics: ParityDiagnostic[] = []
  const normalized: NormalizedMeta = { diagnostics }

  if (!meta) {
    addDiagnostic(diagnostics, 'normalization-warning', source, path, 'Missing top-level meta object')
    return normalized
  }

  const used = new Set<string>()
  const title = readString(meta.title)
  if (title !== undefined) normalized.title = title
  used.add('title')

  const composer = readString(meta.composer)
  if (composer !== undefined) normalized.composer = composer
  used.add('composer')

  const number = readString(meta.number)
  if (number !== undefined) normalized.number = number
  used.add('number')

  const filename = readString(meta.filename)
  if (filename !== undefined) normalized.filename = filename
  used.add('filename')

  const meter = meta.meter
  if (typeof meter === 'string' || Array.isArray(meter)) normalized.meter = meter as string | string[]
  used.add('meter')

  const key = readString(meta.key)
  if (key !== undefined) normalized.key = key
  used.add('key')

  const oKey = readString(meta.oKey)
  if (oKey !== undefined) normalized.oKey = oKey
  used.add('oKey')

  const tempo = meta.tempo
  if (typeof tempo === 'number' || isRecord(tempo)) normalized.tempo = tempo as number | { duration: number[]; bpm: number }
  used.add('tempo')

  const tempoDisplay = readString(meta.tempoDisplay)
  if (tempoDisplay !== undefined) normalized.tempoDisplay = tempoDisplay
  used.add('tempoDisplay')

  const checksum = readString(meta.checksum)
  if (checksum !== undefined) normalized.checksum = checksum
  used.add('checksum')

  for (const [keyName, value] of Object.entries(meta)) {
    if (used.has(keyName)) continue
    if (keyName === 'o_key' || keyName === 'tempo_display') continue
    if (keyName === 'diagnostics') continue
    addDiagnostic(
      diagnostics,
      'ignored-by-contract',
      source,
      formatPath(path, keyName),
      `Ignored top-level meta field ${keyName}`,
      keyName,
      value,
    )
  }

  const diagnosticsField = meta.diagnostics
  if (Array.isArray(diagnosticsField)) {
    normalized.diagnostics.push(
      ...diagnosticsField
        .filter((item): item is Record<string, unknown> => isRecord(item))
        .map((item) => {
          const diagnostic: ParityDiagnostic = {
            category: 'normalization-warning',
            source,
            path,
            message: typeof item.message === 'string' ? item.message : 'Legacy diagnostic',
            field: typeof item.field === 'string' ? item.field : undefined,
            value: item.value,
          }
          return diagnostic
        }),
    )
  }

  return normalized
}

function normalizeHarpnoteOptions(
  options: Record<string, unknown> | undefined,
  source: SongParitySource,
  path: string,
): NormalizedHarpnoteOptions | undefined {
  if (!options) return undefined

  const diagnostics: ParityDiagnostic[] = []
  const normalized: NormalizedHarpnoteOptions = { diagnostics }
  const used = new Set<string>()

  const lyrics = options.lyrics
  if (isRecord(lyrics)) {
    const text = typeof lyrics.text === 'string' || lyrics.text === null ? lyrics.text : undefined
    if (text !== undefined) {
      normalized.lyrics = { text }
      used.add('lyrics')
    }
  }

  const template = options.template
  if (isRecord(template)) {
    const filebase = readString(template.filebase)
    const title = readString(template.title)
    if (filebase !== undefined || title !== undefined) {
      normalized.template = { filebase, title }
      used.add('template')
    }
  }

  const print = options.print
  if (Array.isArray(print)) {
    const normalizedPrint: Record<string, unknown>[] = []
    for (const item of print) {
      if (!isRecord(item)) {
        addDiagnostic(diagnostics, 'normalization-warning', source, formatPath(path, 'print'), 'Non-object print variant encountered')
        continue
      }
      normalizedPrint.push(cloneRecord(item))
    }
    if (normalizedPrint.length > 0 || print.length === 0) {
      normalized.print = normalizedPrint
      used.add('print')
    }
  }

  for (const [keyName, value] of Object.entries(options)) {
    if (used.has(keyName)) continue
    normalized.raw = normalized.raw ?? {}
    normalized.raw[keyName] = isRecord(value) ? cloneRecord(value) : value
    addDiagnostic(
      diagnostics,
      'ignored-by-contract',
      source,
      formatPath(path, keyName),
      `Ignored harpnote_options field ${keyName}`,
      keyName,
      value,
    )
  }

  return normalized
}

function toVoiceId(voiceIndex: number, name?: string): string {
  return name && name.trim().length > 0 ? `${name.trim()}#${voiceIndex}` : `voice-${voiceIndex}`
}

function kindFromLegacyClass(rawClass: unknown): string {
  if (typeof rawClass !== 'string') return 'Unknown'
  const className = rawClass.split('::').pop()
  return className ?? rawClass
}

function normalizeRepeatInfo(event: Record<string, unknown>, source: SongParitySource, path: string): NormalizedRepeatInfo | undefined {
  const repeatInfo: NormalizedRepeatInfo = {}
  let hasValue = false

  const firstInPart = readBoolean(event.firstInPart)
  if (firstInPart === true) {
    repeatInfo.firstInPart = firstInPart
    hasValue = true
  }
  const measureStart = readBoolean(event.measureStart)
  if (measureStart === true) {
    repeatInfo.measureStart = measureStart
    hasValue = true
  }
  const measureCount = readNumber(event.measureCount)
  if (measureCount !== undefined) {
    repeatInfo.measureCount = measureCount
    hasValue = true
  }
  const countNote = typeof event.countNote === 'string' || event.countNote === null ? event.countNote : undefined
  if (countNote !== undefined) {
    repeatInfo.countNote = countNote
    hasValue = true
  }
  const tieStart = readBoolean(event.tieStart)
  if (tieStart !== undefined) {
    repeatInfo.tieStart = tieStart
    hasValue = true
  }
  const tieEnd = readBoolean(event.tieEnd)
  if (tieEnd !== undefined) {
    repeatInfo.tieEnd = tieEnd
    hasValue = true
  }
  const tuplet = readNumber(event.tuplet)
  if (tuplet !== undefined) {
    repeatInfo.tuplet = tuplet
    hasValue = true
  }
  const tupletStart = readBoolean(event.tupletStart)
  if (tupletStart !== undefined) {
    repeatInfo.tupletStart = tupletStart
    hasValue = true
  } else if (tuplet !== undefined && tuplet > 1) {
    repeatInfo.tupletStart = false
    hasValue = true
  }
  const tupletEnd = readBoolean(event.tupletEnd)
  if (tupletEnd !== undefined) {
    repeatInfo.tupletEnd = tupletEnd
    hasValue = true
  } else if (tuplet !== undefined && tuplet > 1) {
    repeatInfo.tupletEnd = false
    hasValue = true
  }
  const nextPitch = readNumber(event.nextPitch)
  if (nextPitch !== undefined) {
    repeatInfo.nextPitch = nextPitch
    hasValue = true
  }
  const prevPitch = readNumber(event.prevPitch)
  if (prevPitch !== undefined) {
    repeatInfo.prevPitch = prevPitch
    hasValue = true
  }
  const slurStarts = readNumberArray(event.slurStarts)
  if (slurStarts !== undefined) {
    repeatInfo.slurStarts = slurStarts
    hasValue = true
  }
  const slurEnds = readNumberArray(event.slurEnds)
  if (slurEnds !== undefined) {
    repeatInfo.slurEnds = slurEnds
    hasValue = true
  }
  const jumpStarts = readStringArray(event.jumpStarts)
  if (jumpStarts !== undefined && jumpStarts.length > 0) {
    repeatInfo.jumpStarts = jumpStarts
    hasValue = true
  }
  const jumpEnds = readStringArray(event.jumpEnds)
  if (jumpEnds !== undefined && jumpEnds.length > 0) {
    repeatInfo.jumpEnds = jumpEnds
    hasValue = true
  }
  const lyrics = typeof event.lyrics === 'string' || event.lyrics === null ? event.lyrics : undefined
  if (lyrics !== undefined) {
    repeatInfo.lyrics = lyrics
    hasValue = true
  }

  if (!hasValue) return undefined
  return repeatInfo
}

function readLegacySourceOffsets(entity: Record<string, unknown>): [number, number] | undefined {
  const origin = entity['@origin']
  if (!isRecord(origin)) return undefined
  const rawVoiceElement = origin.raw_voice_element
  if (!isRecord(rawVoiceElement)) return undefined
  const istart = readNumber(rawVoiceElement.istart)
  const iend = readNumber(rawVoiceElement.iend)
  if (istart === undefined || iend === undefined) return undefined
  return [istart, iend]
}

function normalizeGotoInfo(event: Record<string, unknown>): NormalizedGotoInfo | undefined {
  const gotoInfo: NormalizedGotoInfo = {}
  let hasValue = false

  const fromBeat = readNumber(event.fromBeat)
  if (fromBeat !== undefined) {
    gotoInfo.fromBeat = fromBeat
    hasValue = true
  }
  const toBeat = readNumber(event.toBeat)
  if (toBeat !== undefined) {
    gotoInfo.toBeat = toBeat
    hasValue = true
  }
  const policy = event.policy
  if (isRecord(policy)) {
    gotoInfo.policy = cloneRecord(policy)
    hasValue = true
  }

  if (!hasValue) return undefined
  return gotoInfo
}

function baseEvent(
  source: SongParitySource,
  voiceIndex: number,
  indexInVoice: number,
  globalIndex: number,
  kind: string,
  sourcePath: string,
): NormalizedEvent {
  return {
    stableKey: '',
    kind,
    voiceId: `voice-${voiceIndex}`,
    voiceIndex,
    indexInVoice,
    globalIndex,
    decorations: [],
    sourcePath,
  }
}

function computeStableKey(event: NormalizedEvent): string {
  const parts = [
    event.voiceIndex,
    event.kind,
    event.abcStart?.join(':') ?? '-',
    event.abcEnd?.join(':') ?? '-',
    event.measure ?? '-',
    event.beat ?? '-',
    event.duration ?? '-',
    event.pitch ?? '-',
    event.lyrics ?? '-',
    event.abcText ?? '-',
  ]
  return parts.join('|')
}

function finalizeEvent(event: NormalizedEvent): NormalizedEvent {
  return {
    ...event,
    stableKey: computeStableKey(event),
  }
}

function normalizeLegacyEvent(
  entity: unknown,
  voiceIndex: number,
  indexInVoice: number,
  globalIndex: number,
  source: SongParitySource,
  context: SongParityContext,
  path: string,
): NormalizedEvent | null {
  if (!isRecord(entity)) return null
  const kind = kindFromLegacyClass(entity.class)
  const event = baseEvent(source, voiceIndex, indexInVoice, globalIndex, kind, path)
  const raw = cloneRecord(entity)
  const sourceOffsets = readLegacySourceOffsets(entity)

  event.voiceId = toVoiceId(voiceIndex)
  event.raw = raw
  if (sourceOffsets !== undefined) event.sourceOffsets = sourceOffsets

  const beat = readNumber(entity['@beat']) ?? readNumber(entity.beat)
  if (beat !== undefined) {
    event.beat = beat
    event.absBeat = beat
  }

  const time = readNumber(entity['@time']) ?? readNumber(entity.time)
  if (time !== undefined) {
    event.absBeat = time
  }

  const duration = readNumber(entity['@duration']) ?? readNumber(entity.duration)
  if (duration !== undefined) event.duration = duration

  const startPos = readPoint(entity['@start_pos']) ?? readPoint(entity.startPos)
  if (startPos !== undefined) {
    event.abcStart = startPos
  }

  const endPos = readPoint(entity['@end_pos']) ?? readPoint(entity.endPos)
  if (endPos !== undefined) {
    event.abcEnd = endPos
  }

  if (sourceOffsets !== undefined) {
    event.abcExcerpt = extractAbcExcerptFromOffsets(context.abcText, sourceOffsets[0], sourceOffsets[1])
  } else if (startPos !== undefined) {
    event.abcExcerpt = extractAbcExcerptFromPositions(context.abcText, startPos, endPos)
  }

  const text = readString(entity['@text']) ?? readString(entity.text)
  if (text !== undefined) event.abcText = text

  const pitch = readNumber(entity['@pitch']) ?? readNumber(entity.pitch)
  if (pitch !== undefined) event.pitch = pitch

  const decorations = readStringArray(entity['@decorations']) ?? readStringArray(entity.decorations)
  if (decorations !== undefined) event.decorations = decorations

  const lyrics = typeof entity['@lyrics'] === 'string' || entity['@lyrics'] === null
    ? entity['@lyrics']
    : typeof entity.lyrics === 'string' || entity.lyrics === null
      ? entity.lyrics
      : undefined
  if (lyrics !== undefined) event.lyrics = lyrics

  const variant = readNumber(entity['@variant']) ?? readNumber(entity.variant)
  if (variant === 0 || variant === 1 || variant === 2) event.variant = variant

  if (kind === 'SynchPoint') {
    const proxyNote = getLegacySynchPointProxyNote(entity)
    if (proxyNote !== undefined) {
      if (event.pitch === undefined) {
        const proxyPitch = readNumber(proxyNote['@pitch']) ?? readNumber(proxyNote.pitch)
        if (proxyPitch !== undefined) event.pitch = proxyPitch
      }
      if (event.variant === undefined) {
        const proxyVariant = readNumber(proxyNote['@variant']) ?? readNumber(proxyNote.variant)
        if (proxyVariant === 0 || proxyVariant === 1 || proxyVariant === 2) event.variant = proxyVariant
      }
    }
  }

  const measureCount = readNumber(entity['@measure_count']) ?? readNumber(entity.measureCount)
  let measureStart = readBoolean(entity['@measure_start']) ?? readBoolean(entity.measureStart)
  if (measureStart === undefined && kind === 'SynchPoint') {
    const proxyNote = getLegacySynchPointProxyNote(entity)
    if (proxyNote !== undefined) {
      measureStart = readBoolean(proxyNote['@measure_start']) ?? readBoolean(proxyNote.measureStart)
    }
  }
  const firstInPart = readBoolean(entity['@first_in_part']) ?? readBoolean(entity.firstInPart)
  const countNote = typeof entity['@count_note'] === 'string' || entity['@count_note'] === null
    ? entity['@count_note']
    : typeof entity.countNote === 'string' || entity.countNote === null
      ? entity.countNote
      : undefined
  const tieStart = readBoolean(entity['@tie_start']) ?? readBoolean(entity.tieStart)
  const tieEnd = readBoolean(entity['@tie_end']) ?? readBoolean(entity.tieEnd)
  const tuplet = readNumber(entity['@tuplet']) ?? readNumber(entity.tuplet)
  const tupletStart = readBoolean(entity['@tuplet_start']) ?? readBoolean(entity.tupletStart)
  const tupletEnd = readBoolean(entity['@tuplet_end']) ?? readBoolean(entity.tupletEnd)
  const prevPitch = readNumber(entity['@prev_pitch']) ?? readNumber(entity.prevPitch)
  const nextPitch = readNumber(entity['@next_pitch']) ?? readNumber(entity.nextPitch)
  const slurStarts = readNumberArray(entity['@slur_starts']) ?? readNumberArray(entity.slurStarts)
  const slurEnds = readNumberArray(entity['@slur_ends']) ?? readNumberArray(entity.slurEnds)
  const jumpStarts = readStringArray(entity['@jump_starts']) ?? readStringArray(entity.jumpStarts)
  const jumpEnds = readStringArray(entity['@jump_ends']) ?? readStringArray(entity.jumpEnds)

  const repeatInfo = normalizeRepeatInfo(
    {
      firstInPart,
      measureStart,
      measureCount,
      countNote,
      tieStart,
      tieEnd,
      tuplet,
      tupletStart,
      tupletEnd,
      prevPitch,
      nextPitch,
      slurStarts,
      slurEnds,
      jumpStarts,
      jumpEnds,
      lyrics,
    },
    source,
    path,
  )
  if (repeatInfo !== undefined) event.repeatInfo = repeatInfo

  const from = entity['@from']
  const to = entity['@to']
  const policy = entity['@policy']
  if (kind === 'Goto' && (from !== undefined || to !== undefined || policy !== undefined)) {
    const gotoInfo: NormalizedGotoInfo = {}
    if (isRecord(from)) {
      const fromBeat = readNumber(from['@beat']) ?? readNumber(from.beat)
      if (fromBeat !== undefined) gotoInfo.fromBeat = fromBeat
    }
    if (isRecord(to)) {
      const toBeat = readNumber(to['@beat']) ?? readNumber(to.beat)
      if (toBeat !== undefined) gotoInfo.toBeat = toBeat
    }
    if (isRecord(policy)) gotoInfo.policy = cloneRecord(policy)
    if (gotoInfo.fromBeat !== undefined || gotoInfo.toBeat !== undefined || gotoInfo.policy !== undefined) {
      event.gotoInfo = gotoInfo
    }
  }

  const leftovers = Object.fromEntries(
    Object.entries(entity).filter(([key]) => !LEGACY_EVENT_KNOWN_KEYS.has(key)),
  )
  if (Object.keys(leftovers).length > 0) {
    event.debug = { leftovers }
  }

  return finalizeEvent(event)
}

function getLegacySynchPointProxyNote(entity: Record<string, unknown>): Record<string, unknown> | undefined {
  const notes = entity['@notes']
  if (!Array.isArray(notes) || notes.length === 0) return undefined
  const proxy = notes[notes.length - 1]
  if (!isRecord(proxy)) return undefined
  return proxy
}

function normalizeTsEvent(
  entity: unknown,
  voiceIndex: number,
  indexInVoice: number,
  globalIndex: number,
  source: SongParitySource,
  context: SongParityContext,
  path: string,
): NormalizedEvent | null {
  if (!isRecord(entity)) return null
  const kind = typeof entity.type === 'string' ? entity.type : 'Unknown'
  const event = baseEvent(source, voiceIndex, indexInVoice, globalIndex, kind, path)
  event.voiceId = toVoiceId(voiceIndex)
  event.raw = cloneRecord(entity)

  const beat = readNumber(entity.beat)
  if (beat !== undefined) {
    event.beat = beat
    event.absBeat = beat
  }

  const time = readNumber(entity.time)
  if (time !== undefined) event.absBeat = time

  const duration = readNumber(entity.duration)
  if (duration !== undefined) event.duration = duration

  const startPos = readPoint(entity.startPos)
  if (startPos !== undefined) {
    event.abcStart = startPos
  }

  const endPos = readPoint(entity.endPos)
  if (endPos !== undefined) {
    event.abcEnd = endPos
  }

  const sourceOffsets = readPoint(entity.sourceOffsets)
  if (sourceOffsets !== undefined) {
    event.sourceOffsets = sourceOffsets
  }

  if (event.abcExcerpt === undefined && startPos !== undefined && endPos !== undefined) {
    event.abcExcerpt = extractAbcExcerptFromPositions(context.abcText, startPos, endPos)
  }

  const text = readString(entity.text)
  if (text !== undefined) event.abcText = text

  const pitch = readNumber(entity.pitch)
  if (pitch !== undefined) event.pitch = pitch

  const decorations = readStringArray(entity.decorations)
  if (decorations !== undefined) event.decorations = decorations

  const lyrics = typeof entity.lyrics === 'string' || entity.lyrics === null ? entity.lyrics : undefined
  if (lyrics !== undefined) event.lyrics = lyrics

  const variant = readNumber(entity.variant)
  if (variant === 0 || variant === 1 || variant === 2) event.variant = variant

  const repeatInfo = normalizeRepeatInfo(
    {
      firstInPart: readBoolean(entity.firstInPart),
      measureStart: readBoolean(entity.measureStart),
      measureCount: readNumber(entity.measureCount),
      countNote: typeof entity.countNote === 'string' || entity.countNote === null ? entity.countNote : undefined,
      tieStart: readBoolean(entity.tieStart),
      tieEnd: readBoolean(entity.tieEnd),
      tuplet: readNumber(entity.tuplet),
      tupletStart: readBoolean(entity.tupletStart),
      tupletEnd: readBoolean(entity.tupletEnd),
      nextPitch: readNumber(entity.nextPitch),
      prevPitch: readNumber(entity.prevPitch),
      slurStarts: readNumberArray(entity.slurStarts),
      slurEnds: readNumberArray(entity.slurEnds),
      jumpStarts: readStringArray(entity.jumpStarts),
      jumpEnds: readStringArray(entity.jumpEnds),
      lyrics,
    },
    source,
    path,
  )
  if (repeatInfo !== undefined) event.repeatInfo = repeatInfo

  if (kind === 'Goto' && (entity.from !== undefined || entity.to !== undefined || entity.policy !== undefined)) {
    const gotoInfo: NormalizedGotoInfo = {}
    if (isRecord(entity.from)) {
      const fromBeat = readNumber(entity.from.beat)
      if (fromBeat !== undefined) gotoInfo.fromBeat = fromBeat
    }
    if (isRecord(entity.to)) {
      const toBeat = readNumber(entity.to.beat)
      if (toBeat !== undefined) gotoInfo.toBeat = toBeat
    }
    if (isRecord(entity.policy)) gotoInfo.policy = cloneRecord(entity.policy)
    if (gotoInfo.fromBeat !== undefined || gotoInfo.toBeat !== undefined || gotoInfo.policy !== undefined) {
      event.gotoInfo = gotoInfo
    }
  }

  if (
    kind === 'Chordsymbol' &&
    typeof event.abcExcerpt === 'string' &&
    (event.abcExcerpt.startsWith('|') || event.abcExcerpt.startsWith(':|'))
  ) {
    return null
  }

  if (kind === 'Goto') {
    const policyConfKey = event.gotoInfo?.policy && isRecord(event.gotoInfo.policy)
      ? readString((event.gotoInfo.policy as Record<string, unknown>).confKey)
      : undefined
    if (typeof policyConfKey === 'string' && policyConfKey.endsWith('.p_begin')) {
      return null
    }
  }

  const leftovers = Object.fromEntries(
    Object.entries(entity).filter(([key]) => !TS_EVENT_KNOWN_KEYS.has(key)),
  )
  if (Object.keys(leftovers).length > 0) {
    event.debug = { leftovers }
  }

  return finalizeEvent(event)
}

function normalizeLegacyVoice(
  voice: unknown,
  voiceIndex: number,
  source: SongParitySource,
  context: SongParityContext,
): NormalizedVoice {
  const diagnostics: ParityDiagnostic[] = []
  const voiceId = toVoiceId(voiceIndex)
  const normalized: NormalizedVoice = {
    voiceId,
    voiceIndex,
    events: [],
    diagnostics,
  }

  if (!Array.isArray(voice)) {
    addDiagnostic(diagnostics, 'normalization-warning', source, `voices[${voiceIndex}]`, 'Voice is not an array')
    return normalized
  }

  const header = voice[0]
  if (header !== undefined && (!isRecord(header) || !('class' in header))) {
    const leftovers = isRecord(header) ? cloneRecord(header) : { value: header }
    normalized.raw = { header: leftovers }
    addDiagnostic(
      diagnostics,
      'ignored-by-contract',
      source,
      `voices[${voiceIndex}][0]`,
      'Ignored legacy voice header entry',
      undefined,
      leftovers,
    )
  }

  let globalIndex = 0
  for (let index = 0; index < voice.length; index++) {
    const entity = voice[index]
    if (index === 0 && isRecord(entity) && !('class' in entity)) continue
    const event = normalizeLegacyEvent(entity, voiceIndex, normalized.events.length, globalIndex, source, context, `voices[${voiceIndex}].events[${normalized.events.length}]`)
    globalIndex++
    if (event === null) continue
    normalized.events.push(event)
  }

  return normalized
}

function normalizeTsVoice(
  voice: unknown,
  voiceIndex: number,
  source: SongParitySource,
  context: SongParityContext,
): NormalizedVoice {
  const diagnostics: ParityDiagnostic[] = []
  const voiceId = toVoiceId(voiceIndex, isRecord(voice) ? readString(voice.name) : undefined)
  const normalized: NormalizedVoice = {
    voiceId,
    voiceIndex,
    events: [],
    diagnostics,
  }

  if (!isRecord(voice)) {
    addDiagnostic(diagnostics, 'normalization-warning', source, `voices[${voiceIndex}]`, 'Voice is not an object')
    return normalized
  }

  normalized.name = readString(voice.name)
  normalized.showVoice = readBoolean(voice.showVoice)
  normalized.showFlowline = readBoolean(voice.showFlowline)
  normalized.showJumpline = readBoolean(voice.showJumpline)

  const entities = asArray(voice.entities)
  if (!entities) {
    addDiagnostic(diagnostics, 'normalization-warning', source, `voices[${voiceIndex}].entities`, 'Voice entities are missing or invalid')
    return normalized
  }

  let globalIndex = 0
  for (let index = 0; index < entities.length; index++) {
    const event = normalizeTsEvent(
      entities[index],
      voiceIndex,
      normalized.events.length,
      globalIndex,
      source,
      context,
      `voices[${voiceIndex}].events[${normalized.events.length}]`,
    )
    globalIndex++
    if (event === null) continue
    normalized.events.push(event)
  }

  const leftovers = Object.fromEntries(
    Object.entries(voice).filter(([key]) => !['index', 'name', 'showVoice', 'showFlowline', 'showJumpline', 'entities'].includes(key)),
  )
  if (Object.keys(leftovers).length > 0) {
    normalized.raw = leftovers
  }

  return normalized
}

function normalizeLegacyMetaData(raw: unknown, source: SongParitySource): NormalizedMeta {
  if (!isRecord(raw)) {
    return {
      diagnostics: [
        {
          category: 'normalization-warning',
          source,
          path: 'meta',
          message: 'Legacy song has no meta_data object',
        },
      ],
    }
  }

  const tempo = isRecord(raw.tempo) ? { ...raw.tempo } : raw.tempo
  const diagnostics: ParityDiagnostic[] = []
  if (isRecord(tempo) && 'sym' in tempo) {
    diagnostics.push({
      category: 'ignored-by-contract',
      source,
      path: 'meta.tempo.sym',
      message: 'Ignored internal abc2svg tempo symbol',
      field: 'sym',
      value: tempo.sym,
    })
    delete tempo.sym
  }

  const normalized = coerceSongMeta(
    {
      ...raw,
      oKey: typeof raw.o_key === 'string' ? raw.o_key : undefined,
      tempoDisplay: typeof raw.tempoDisplay === 'string' ? raw.tempoDisplay : typeof raw.tempo_display === 'string' ? raw.tempo_display : undefined,
      tempo,
      diagnostics: raw.diagnostics,
    },
    source,
    'meta',
  )
  normalized.diagnostics.push(...diagnostics)
  return normalized
}

function normalizeTsMetaData(raw: unknown, source: SongParitySource): NormalizedMeta {
  if (!isRecord(raw)) {
    return {
      diagnostics: [
        {
          category: 'normalization-warning',
          source,
          path: 'meta',
          message: 'TS song has no meta_data object',
        },
      ],
    }
  }
  return coerceSongMeta(
    {
      ...raw,
      oKey: typeof raw.oKey === 'string' ? raw.oKey : typeof raw.o_key === 'string' ? raw.o_key : undefined,
      tempoDisplay: typeof raw.tempoDisplay === 'string' ? raw.tempoDisplay : typeof raw.tempo_display === 'string' ? raw.tempo_display : undefined,
      diagnostics: raw.diagnostics,
    },
    source,
    'meta',
  )
}

function normalizeSongCommon(
  raw: unknown,
  source: SongParitySource,
  metaReader: (value: unknown, source: SongParitySource) => NormalizedMeta,
  voiceReader: (value: unknown, index: number, source: SongParitySource, context: SongParityContext) => NormalizedVoice,
  context: SongParityContext,
): NormalizedSong {
  const diagnostics: ParityDiagnostic[] = []
  const rawRecord = isRecord(raw) ? raw : undefined
  if (rawRecord === undefined) {
    addDiagnostic(diagnostics, 'normalization-warning', source, 'song', 'Song input is not an object')
    return {
      harpnoteOptions: undefined,
      meta: { diagnostics },
      voices: [],
      events: [],
      diagnostics,
      source,
    }
  }

  const harpnoteOptionsSource = source === 'legacy' ? rawRecord.harpnote_options : rawRecord.harpnote_options ?? rawRecord.harpnoteOptions
  const harpnoteOptions = normalizeHarpnoteOptions(
    isRecord(harpnoteOptionsSource) ? harpnoteOptionsSource : undefined,
    source,
    'harpnote_options',
  )
  const meta = metaReader(source === 'legacy' ? rawRecord.meta_data : rawRecord.meta_data, source)
  const voicesSource = rawRecord.voices
  const voicesArray = Array.isArray(voicesSource) ? voicesSource : []
  const voices = voicesArray.map((voice, index) => voiceReader(voice, index, source, context))
  const events = voices.flatMap((voice) => voice.events)
  let globalIndex = 0
  for (const event of events) {
    event.globalIndex = globalIndex
    globalIndex++
  }

  const leftovers = Object.fromEntries(
    Object.entries(rawRecord).filter(([key]) => !['meta_data', 'voices', 'beat_maps', 'harpnote_options', 'harpnoteOptions'].includes(key)),
  )
  if (Object.keys(leftovers).length > 0) {
    addDiagnostic(
      diagnostics,
      'ignored-by-contract',
      source,
      'song',
      'Ignored top-level song fields',
      undefined,
      leftovers,
    )
  }

  diagnostics.push(...meta.diagnostics)
  if (harpnoteOptions !== undefined) diagnostics.push(...harpnoteOptions.diagnostics)
  for (const voice of voices) diagnostics.push(...voice.diagnostics)

  return {
    harpnoteOptions,
    meta,
    voices,
    events,
    diagnostics,
    source,
    raw: Object.keys(leftovers).length > 0 ? leftovers : undefined,
  }
}

export function normalizeLegacySong(rawLegacy: unknown, context: SongParityContext): NormalizedSong {
  return normalizeSongCommon(rawLegacy, 'legacy', normalizeLegacyMetaData, normalizeLegacyVoice, context)
}

export function normalizeTsSong(rawTs: unknown, context: SongParityContext): NormalizedSong {
  return normalizeSongCommon(rawTs, 'ts', normalizeTsMetaData, normalizeTsVoice, context)
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function exactSourceKey(event: NormalizedEvent): string | null {
  if (event.abcStart === undefined || event.abcEnd === undefined) return null
  return [
    event.voiceIndex,
    event.kind,
    event.abcStart.join(':'),
    event.abcEnd.join(':'),
  ].join('|')
}

function exactPositionKey(event: NormalizedEvent): string | null {
  if (event.measure === undefined || event.beat === undefined || event.duration === undefined) return null
  return [event.voiceIndex, event.kind, event.measure, event.beat, event.duration].join('|')
}

function pitchRestKey(event: NormalizedEvent): string | null {
  if (event.duration === undefined) return null
  const pitch = event.pitch === undefined ? 'rest' : event.pitch
  return [event.voiceIndex, event.kind, pitch, event.duration].join('|')
}

function sequenceFingerprint(event: NormalizedEvent): string {
  return [
    event.kind,
    event.measure ?? '-',
    event.beat ?? '-',
    event.duration ?? '-',
    event.pitch ?? '-',
    event.abcStart?.join(':') ?? '-',
    event.abcEnd?.join(':') ?? '-',
    event.abcText ?? '-',
  ].join('|')
}

function compareIndexDistance(left: NormalizedEvent, right: NormalizedEvent): number {
  return Math.abs(left.indexInVoice - right.indexInVoice)
}

function scoreCandidate(
  legacy: NormalizedEvent,
  candidate: NormalizedEvent,
  quality: MatchQuality,
): MatchingCandidate {
  const distance = compareIndexDistance(legacy, candidate)
  const scoreByQuality: Record<MatchQuality, number> = {
    'exact-source': 400,
    'exact-position': 300,
    'near-position': 200,
    sequence: 100,
    ambiguous: 50,
    unmatched: 0,
  }
  const reason = quality === 'near-position'
    ? `index distance ${distance}`
    : quality === 'sequence'
      ? `fingerprint ${sequenceFingerprint(candidate)}`
      : quality === 'exact-source'
        ? 'same source span'
        : 'same measure/beat/duration'
  return {
    index: candidate.indexInVoice,
    quality,
    score: scoreByQuality[quality] - distance,
    reason,
  }
}

function buildTraceEntry(voiceIndex: number, legacy: NormalizedEvent): MatchTraceEntry {
  return {
    voiceIndex,
    legacyIndex: legacy.indexInVoice,
    legacyStableKey: legacy.stableKey,
    legacyKind: legacy.kind,
    candidates: [],
  }
}

function createAmbiguousGap(
  caseId: string,
  event: NormalizedEvent,
  reason: string,
): SongGap {
  return {
    category: 'matching-ambiguous',
    caseId,
    stage: 'song',
    voiceIndex: event.voiceIndex,
    voiceId: event.voiceId,
    measure: event.measure,
    beat: event.beat,
    eventKind: event.kind,
    stableKey: event.stableKey,
    legacyJsonPath: event.sourcePath,
    tsJsonPath: event.sourcePath,
    legacyAbcPosition: formatAbcPosition(event),
    tsAbcPosition: formatAbcPosition(event),
    matchQuality: 'ambiguous',
    impact: 'Comparator could not uniquely establish a stable pair; inspect the matching trace before trusting downstream comparisons.',
    message: reason,
    abcExcerpt: event.abcExcerpt,
  }
}

function withGapExcerpt<T extends SongGap>(gap: T, legacy?: NormalizedEvent, ts?: NormalizedEvent): T {
  return {
    ...gap,
    legacyAbcPosition: legacy ? formatAbcPosition(legacy) : gap.legacyAbcPosition,
    tsAbcPosition: ts ? formatAbcPosition(ts) : gap.tsAbcPosition,
    abcExcerpt: legacy?.abcExcerpt ?? ts?.abcExcerpt ?? gap.abcExcerpt,
  }
}

function describeAbcEndGap(legacy: NormalizedEvent, ts: NormalizedEvent): { impact: string; messageSuffix: string } {
  const legacyOffsets = legacy.sourceOffsets?.join('..')
  const tsOffsets = ts.sourceOffsets?.join('..')
  const offsetsDiffer =
    legacy.sourceOffsets !== undefined &&
    ts.sourceOffsets !== undefined &&
    (legacy.sourceOffsets[0] !== ts.sourceOffsets[0] || legacy.sourceOffsets[1] !== ts.sourceOffsets[1])

  const offsetNote =
    legacyOffsets !== undefined || tsOffsets !== undefined
      ? ` Raw istart/iend spans: ${legacyOffsets ?? '-'} vs ${tsOffsets ?? '-'}.`
      : ''

  return {
    impact: offsetsDiffer
      ? 'abcEnd diverges together with the raw istart/iend span reported by abc2svg. Fix the ABC input at this position; TS should not compensate the offset.'
      : 'abcEnd diverges on a shared raw span. Re-check the ABC input and the abc2svg boundary handling at this position.',
    messageSuffix: `${offsetNote} Correct the ABC source here instead of adding a TS endoffset adjustment.`,
  }
}

function formatAbcPosition(event?: NormalizedEvent): string | undefined {
  if (!event) return undefined
  const start = event.abcStart !== undefined ? event.abcStart.join(':') : undefined
  const end = event.abcEnd !== undefined ? event.abcEnd.join(':') : undefined
  if (start === undefined && end === undefined) return undefined
  const base = `${start ?? '-'}..${end ?? '-'}`
  if (event.sourceOffsets !== undefined) {
    return `${base} (istart/iend ${event.sourceOffsets[0]}..${event.sourceOffsets[1]})`
  }
  return base
}

function compareFieldValue(
  caseId: string,
  legacy: NormalizedEvent,
  ts: NormalizedEvent,
  fieldPath: string,
  legacyValue: unknown,
  tsValue: unknown,
  contractField: ContractSection,
): SongGap | null {
  const abcEndGapHint = fieldPath === 'abcEnd' ? describeAbcEndGap(legacy, ts) : undefined
  if (legacyValue === undefined && tsValue === undefined) return null
  if (legacyValue === undefined) {
    return withGapExcerpt({
      category: 'extra-field',
      caseId,
      stage: 'song',
      voiceIndex: ts.voiceIndex,
      voiceId: ts.voiceId,
      measure: ts.measure,
      beat: ts.beat,
      eventKind: ts.kind,
      stableKey: ts.stableKey,
      legacyJsonPath: legacy.sourcePath,
      tsJsonPath: formatPath(ts.sourcePath, fieldPath),
      tsValue,
      matchQuality: 'exact-source',
      impact:
        fieldPath === 'abcEnd'
          ? abcEndGapHint?.impact ?? 'TS emits a field not present in legacy; downstream consumers may rely on this value only in the new pipeline.'
          : 'TS emits a field not present in legacy; downstream consumers may rely on this value only in the new pipeline.',
      message:
        fieldPath === 'abcEnd'
          ? `Extra field ${fieldPath}.${abcEndGapHint?.messageSuffix ?? ''}`
          : `Extra field ${fieldPath}`,
    }, legacy, ts)
  }
  if (tsValue === undefined) {
    return withGapExcerpt({
      category: 'missing-field',
      caseId,
      stage: 'song',
      voiceIndex: legacy.voiceIndex,
      voiceId: legacy.voiceId,
      measure: legacy.measure,
      beat: legacy.beat,
      eventKind: legacy.kind,
      stableKey: legacy.stableKey,
      legacyJsonPath: formatPath(legacy.sourcePath, fieldPath),
      tsJsonPath: ts.sourcePath,
      legacyValue,
      matchQuality: 'exact-source',
      impact:
        fieldPath === 'abcEnd'
          ? abcEndGapHint?.impact ?? 'Legacy carries a field that the TS pipeline dropped; later layout or debug stages may diverge because of the missing data.'
          : 'Legacy carries a field that the TS pipeline dropped; later layout or debug stages may diverge because of the missing data.',
      message:
        fieldPath === 'abcEnd'
          ? `Missing field ${fieldPath}.${abcEndGapHint?.messageSuffix ?? ''}`
          : `Missing field ${fieldPath}`,
    }, legacy, ts)
  }

  if (Array.isArray(legacyValue) && Array.isArray(tsValue)) {
    if (legacyValue.length !== tsValue.length) {
      return withGapExcerpt({
        category: 'different-length',
        caseId,
        stage: 'song',
        voiceIndex: legacy.voiceIndex,
        voiceId: legacy.voiceId,
        measure: legacy.measure,
        beat: legacy.beat,
        eventKind: legacy.kind,
        stableKey: legacy.stableKey,
        legacyJsonPath: formatPath(legacy.sourcePath, fieldPath),
        tsJsonPath: formatPath(ts.sourcePath, fieldPath),
        legacyValue,
        tsValue,
        matchQuality: 'exact-source',
        impact:
          fieldPath === 'abcEnd'
            ? abcEndGapHint?.impact ?? 'Array cardinality differs; ordering and semantic groupings can shift in downstream consumers.'
            : 'Array cardinality differs; ordering and semantic groupings can shift in downstream consumers.',
        message:
          fieldPath === 'abcEnd'
            ? `Different length at ${fieldPath}.${abcEndGapHint?.messageSuffix ?? ''}`
            : `Different length at ${fieldPath}`,
      }, legacy, ts)
    }
    const sameOrder = legacyValue.every((entry, index) => valuesEqual(entry, tsValue[index]))
    if (!sameOrder) {
      const sortedLegacy = [...legacyValue].map((item) => JSON.stringify(item)).sort()
      const sortedTs = [...tsValue].map((item) => JSON.stringify(item)).sort()
      if (sortedLegacy.length === sortedTs.length && sortedLegacy.every((entry, index) => entry === sortedTs[index])) {
        return withGapExcerpt({
          category: 'different-array-order',
          caseId,
          stage: 'song',
          voiceIndex: legacy.voiceIndex,
          voiceId: legacy.voiceId,
          measure: legacy.measure,
          beat: legacy.beat,
          eventKind: legacy.kind,
          stableKey: legacy.stableKey,
          legacyJsonPath: formatPath(legacy.sourcePath, fieldPath),
          tsJsonPath: formatPath(ts.sourcePath, fieldPath),
          legacyValue,
          tsValue,
          matchQuality: 'sequence',
          impact:
            fieldPath === 'abcEnd'
              ? abcEndGapHint?.impact ?? 'The array carries the same members in a different order, which is still a semantic change for order-sensitive consumers.'
              : 'The array carries the same members in a different order, which is still a semantic change for order-sensitive consumers.',
          message:
            fieldPath === 'abcEnd'
              ? `Different array order at ${fieldPath}.${abcEndGapHint?.messageSuffix ?? ''}`
              : `Different array order at ${fieldPath}`,
        }, legacy, ts)
      }
      return withGapExcerpt({
        category: 'different-value',
        caseId,
        stage: 'song',
        voiceIndex: legacy.voiceIndex,
        voiceId: legacy.voiceId,
        measure: legacy.measure,
        beat: legacy.beat,
        eventKind: legacy.kind,
        stableKey: legacy.stableKey,
        legacyJsonPath: formatPath(legacy.sourcePath, fieldPath),
        tsJsonPath: formatPath(ts.sourcePath, fieldPath),
        legacyValue,
        tsValue,
        matchQuality: 'exact-source',
        impact:
          fieldPath === 'abcEnd'
            ? abcEndGapHint?.impact ?? 'Array content diverges, so later layout and annotation logic can no longer be trusted to behave identically.'
            : 'Array content diverges, so later layout and annotation logic can no longer be trusted to behave identically.',
        message:
          fieldPath === 'abcEnd'
            ? `Different value at ${fieldPath}.${abcEndGapHint?.messageSuffix ?? ''}`
            : `Different value at ${fieldPath}`,
      }, legacy, ts)
    }
    return null
  }

  if (typeof legacyValue !== typeof tsValue) {
    return withGapExcerpt({
      category: 'different-type',
      caseId,
      stage: 'song',
      voiceIndex: legacy.voiceIndex,
      voiceId: legacy.voiceId,
      measure: legacy.measure,
      beat: legacy.beat,
      eventKind: legacy.kind,
      stableKey: legacy.stableKey,
      legacyJsonPath: formatPath(legacy.sourcePath, fieldPath),
      tsJsonPath: formatPath(ts.sourcePath, fieldPath),
      legacyValue,
      tsValue,
      matchQuality: 'exact-source',
      impact:
        fieldPath === 'abcEnd'
          ? abcEndGapHint?.impact ?? 'A type change usually means the field cannot be consumed by the same downstream logic anymore.'
          : 'A type change usually means the field cannot be consumed by the same downstream logic anymore.',
      message:
        fieldPath === 'abcEnd'
          ? `Different type at ${fieldPath}.${abcEndGapHint?.messageSuffix ?? ''}`
          : `Different type at ${fieldPath}`,
    }, legacy, ts)
  }

  if (!valuesEqual(legacyValue, tsValue)) {
    return withGapExcerpt({
      category: 'different-value',
      caseId,
      stage: 'song',
      voiceIndex: legacy.voiceIndex,
      voiceId: legacy.voiceId,
      measure: legacy.measure,
      beat: legacy.beat,
      eventKind: legacy.kind,
      stableKey: legacy.stableKey,
      legacyJsonPath: formatPath(legacy.sourcePath, fieldPath),
      tsJsonPath: formatPath(ts.sourcePath, fieldPath),
      legacyValue,
      tsValue,
      matchQuality: 'exact-source',
      impact:
        fieldPath === 'abcEnd'
          ? abcEndGapHint?.impact ?? 'The value changed even though the field exists on both sides; this is a true semantic divergence.'
          : 'The value changed even though the field exists on both sides; this is a true semantic divergence.',
      message:
        fieldPath === 'abcEnd'
          ? `Different value at ${fieldPath}.${abcEndGapHint?.messageSuffix ?? ''}`
          : `Different value at ${fieldPath}`,
    }, legacy, ts)
  }

  return null
}

function compareEvents(caseId: string, legacy: NormalizedEvent, ts: NormalizedEvent): SongGap[] {
  const gaps: SongGap[] = []
  const fields: Array<[string, unknown, unknown, ContractSection]> = [
    ['kind', legacy.kind, ts.kind, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['voiceId', legacy.voiceId, ts.voiceId, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['voiceIndex', legacy.voiceIndex, ts.voiceIndex, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['indexInVoice', legacy.indexInVoice, ts.indexInVoice, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['measure', legacy.measure, ts.measure, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['beat', legacy.beat, ts.beat, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['absBeat', legacy.absBeat, ts.absBeat, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['duration', legacy.duration, ts.duration, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['abcStart', legacy.abcStart, ts.abcStart, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['abcEnd', legacy.abcEnd, ts.abcEnd, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['abcText', legacy.abcText, ts.abcText, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['pitch', legacy.pitch, ts.pitch, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['decorations', legacy.decorations, ts.decorations, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['lyrics', legacy.lyrics, ts.lyrics, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
    ['variant', legacy.variant, ts.variant, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} }],
  ]

  for (const [fieldPath, legacyValue, tsValue, contractField] of fields) {
    const gap = compareFieldValue(caseId, legacy, ts, fieldPath, legacyValue, tsValue, contractField)
    if (gap !== null) gaps.push(gap)
  }

  const repeatInfoFields: Array<[string, unknown, unknown]> = [
    ['repeatInfo.firstInPart', legacy.repeatInfo?.firstInPart, ts.repeatInfo?.firstInPart],
    ['repeatInfo.measureStart', legacy.repeatInfo?.measureStart, ts.repeatInfo?.measureStart],
    ['repeatInfo.measureCount', legacy.repeatInfo?.measureCount, ts.repeatInfo?.measureCount],
    ['repeatInfo.countNote', legacy.repeatInfo?.countNote, ts.repeatInfo?.countNote],
    ['repeatInfo.tieStart', legacy.repeatInfo?.tieStart, ts.repeatInfo?.tieStart],
    ['repeatInfo.tieEnd', legacy.repeatInfo?.tieEnd, ts.repeatInfo?.tieEnd],
    ['repeatInfo.tuplet', legacy.repeatInfo?.tuplet, ts.repeatInfo?.tuplet],
    ['repeatInfo.tupletStart', legacy.repeatInfo?.tupletStart, ts.repeatInfo?.tupletStart],
    ['repeatInfo.tupletEnd', legacy.repeatInfo?.tupletEnd, ts.repeatInfo?.tupletEnd],
    ['repeatInfo.nextPitch', legacy.repeatInfo?.nextPitch, ts.repeatInfo?.nextPitch],
    ['repeatInfo.prevPitch', legacy.repeatInfo?.prevPitch, ts.repeatInfo?.prevPitch],
    ['repeatInfo.slurStarts', legacy.repeatInfo?.slurStarts, ts.repeatInfo?.slurStarts],
    ['repeatInfo.slurEnds', legacy.repeatInfo?.slurEnds, ts.repeatInfo?.slurEnds],
    ['repeatInfo.jumpStarts', legacy.repeatInfo?.jumpStarts, ts.repeatInfo?.jumpStarts],
    ['repeatInfo.jumpEnds', legacy.repeatInfo?.jumpEnds, ts.repeatInfo?.jumpEnds],
    ['repeatInfo.lyrics', legacy.repeatInfo?.lyrics, ts.repeatInfo?.lyrics],
  ]

  for (const [fieldPath, legacyValue, tsValue] of repeatInfoFields) {
    const gap = compareFieldValue(caseId, legacy, ts, fieldPath, legacyValue, tsValue, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} })
    if (gap !== null) gaps.push(gap)
  }

  const gotoInfoFields: Array<[string, unknown, unknown]> = [
    ['gotoInfo.fromBeat', legacy.gotoInfo?.fromBeat, ts.gotoInfo?.fromBeat],
    ['gotoInfo.toBeat', legacy.gotoInfo?.toBeat, ts.gotoInfo?.toBeat],
    ['gotoInfo.policy', legacy.gotoInfo?.policy, ts.gotoInfo?.policy],
  ]

  for (const [fieldPath, legacyValue, tsValue] of gotoInfoFields) {
    const gap = compareFieldValue(caseId, legacy, ts, fieldPath, legacyValue, tsValue, { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} })
    if (gap !== null) gaps.push(gap)
  }

  const legacyRawKeys = legacy.raw ? Object.keys(legacy.raw) : []
  const tsRawKeys = ts.raw ? Object.keys(ts.raw) : []
  if (legacyRawKeys.length > 0 || tsRawKeys.length > 0) {
    gaps.push({
      category: 'ignored-by-contract',
      caseId,
      stage: 'song',
      voiceIndex: legacy.voiceIndex,
      voiceId: legacy.voiceId,
      measure: legacy.measure,
      beat: legacy.beat,
      eventKind: legacy.kind,
      stableKey: legacy.stableKey,
      legacyJsonPath: legacy.sourcePath,
      tsJsonPath: ts.sourcePath,
      legacyValue: legacy.raw,
      tsValue: ts.raw,
      matchQuality: 'exact-source',
      impact: 'These fields are explicitly excluded by the contract and remain visible for manual review.',
      message: 'Ignored raw/debug fields are present on at least one side.',
    })
  }

  return gaps
}

function alignByKey(
  legacyEvents: NormalizedEvent[],
  tsEvents: NormalizedEvent[],
  legacyUsed: Set<number>,
  tsUsed: Set<number>,
  keyOf: (event: NormalizedEvent) => string | null,
  quality: MatchQuality,
  traceMap: Map<number, MatchTraceEntry>,
): Array<{ legacyIndex: number; tsIndex: number; quality: MatchQuality; reason: string }> {
  const matches: Array<{ legacyIndex: number; tsIndex: number; quality: MatchQuality; reason: string }> = []
  const buckets = new Map<string, Array<{ side: 'legacy' | 'ts'; index: number; event: NormalizedEvent }>>()

  for (let index = 0; index < legacyEvents.length; index++) {
    if (legacyUsed.has(index)) continue
    const event = legacyEvents[index]
    if (event === undefined) continue
    const key = keyOf(event)
    if (key === null) continue
    const bucket = buckets.get(key) ?? []
    bucket.push({ side: 'legacy', index, event })
    buckets.set(key, bucket)
  }
  for (let index = 0; index < tsEvents.length; index++) {
    if (tsUsed.has(index)) continue
    const event = tsEvents[index]
    if (event === undefined) continue
    const key = keyOf(event)
    if (key === null) continue
    const bucket = buckets.get(key) ?? []
    bucket.push({ side: 'ts', index, event })
    buckets.set(key, bucket)
  }

  for (const bucket of buckets.values()) {
    const legacyCandidates = bucket.filter((item) => item.side === 'legacy')
    const tsCandidates = bucket.filter((item) => item.side === 'ts')
    if (legacyCandidates.length === 0 || tsCandidates.length === 0) continue

    if (legacyCandidates.length === 1 && tsCandidates.length === 1) {
      const legacyCandidate = legacyCandidates[0]
      const tsCandidate = tsCandidates[0]
      if (!legacyCandidate || !tsCandidate) continue
      legacyUsed.add(legacyCandidate.index)
      tsUsed.add(tsCandidate.index)
      matches.push({
        legacyIndex: legacyCandidate.index,
        tsIndex: tsCandidate.index,
        quality,
        reason: keyOf(legacyCandidate.event) ?? quality,
      })
      const trace = traceMap.get(legacyCandidate.index)
      if (trace) {
        trace.selectedIndex = tsCandidate.index
        trace.selectedQuality = quality
        trace.selectedReason = keyOf(legacyCandidate.event) ?? quality
      }
      continue
    }

    for (const legacyCandidate of legacyCandidates) {
      const trace = traceMap.get(legacyCandidate.index)
      if (!trace) continue
      for (const tsCandidate of tsCandidates) {
        trace.candidates.push({
          index: tsCandidate.index,
          quality,
          score: 0,
          reason: `shared ${quality} key`,
        })
      }
    }
  }

  return matches
}

function alignByNearPosition(
  legacyEvents: NormalizedEvent[],
  tsEvents: NormalizedEvent[],
  legacyUsed: Set<number>,
  tsUsed: Set<number>,
  traceMap: Map<number, MatchTraceEntry>,
): Array<{ legacyIndex: number; tsIndex: number; quality: MatchQuality; reason: string }> {
  const matches: Array<{ legacyIndex: number; tsIndex: number; quality: MatchQuality; reason: string }> = []
  const groups = new Map<string, { legacy: Array<{ index: number; event: NormalizedEvent }>; ts: Array<{ index: number; event: NormalizedEvent }> }>()

  for (let index = 0; index < legacyEvents.length; index++) {
    if (legacyUsed.has(index)) continue
    const event = legacyEvents[index]
    if (event === undefined) continue
    const key = pitchRestKey(event)
    if (key === null) continue
    const group = groups.get(key) ?? { legacy: [], ts: [] }
    group.legacy.push({ index, event })
    groups.set(key, group)
  }
  for (let index = 0; index < tsEvents.length; index++) {
    if (tsUsed.has(index)) continue
    const event = tsEvents[index]
    if (event === undefined) continue
    const key = pitchRestKey(event)
    if (key === null) continue
    const group = groups.get(key) ?? { legacy: [], ts: [] }
    group.ts.push({ index, event })
    groups.set(key, group)
  }

  for (const group of groups.values()) {
    const legacyCandidates = [...group.legacy].sort((left, right) => left.event.indexInVoice - right.event.indexInVoice)
    const tsCandidates = [...group.ts].sort((left, right) => left.event.indexInVoice - right.event.indexInVoice)
    for (const legacyCandidate of legacyCandidates) {
      if (legacyUsed.has(legacyCandidate.index)) continue
      let bestIndex = -1
      let bestDistance = Number.POSITIVE_INFINITY
      let ambiguous = false
      for (let i = 0; i < tsCandidates.length; i++) {
        const tsCandidate = tsCandidates[i]
        if (tsCandidate === undefined) continue
        if (tsUsed.has(tsCandidate.index)) continue
        const distance = Math.abs(legacyCandidate.event.indexInVoice - tsCandidate.event.indexInVoice)
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = i
          ambiguous = false
        } else if (distance === bestDistance) {
          ambiguous = true
        }
      }
      if (bestIndex === -1) continue
      const tsCandidate = tsCandidates[bestIndex]
      if (!tsCandidate) continue
      legacyUsed.add(legacyCandidate.index)
      tsUsed.add(tsCandidate.index)
      const quality: MatchQuality = ambiguous ? 'ambiguous' : 'near-position'
      matches.push({
        legacyIndex: legacyCandidate.index,
        tsIndex: tsCandidate.index,
        quality,
        reason: `index distance ${Math.abs(legacyCandidate.event.indexInVoice - tsCandidate.event.indexInVoice)}`,
      })
      const trace = traceMap.get(legacyCandidate.index)
      if (trace) {
        trace.selectedIndex = tsCandidate.index
        trace.selectedQuality = quality
        trace.selectedReason = `index distance ${Math.abs(legacyCandidate.event.indexInVoice - tsCandidate.event.indexInVoice)}`
      }
    }
  }

  return matches
}

function buildSequenceMatches(
  legacyEvents: NormalizedEvent[],
  tsEvents: NormalizedEvent[],
  legacyUsed: Set<number>,
  tsUsed: Set<number>,
  traceMap: Map<number, MatchTraceEntry>,
): Array<{ legacyIndex: number; tsIndex: number; quality: MatchQuality; reason: string }> {
  const remainingLegacy = legacyEvents
    .map((event, index) => ({ event, index }))
    .filter(({ index }) => !legacyUsed.has(index))
  const remainingTs = tsEvents
    .map((event, index) => ({ event, index }))
    .filter(({ index }) => !tsUsed.has(index))

  const matches: Array<{ legacyIndex: number; tsIndex: number; quality: MatchQuality; reason: string }> = []
  let legacyCursor = 0
  let tsCursor = 0
  while (legacyCursor < remainingLegacy.length && tsCursor < remainingTs.length) {
    const legacyItem = remainingLegacy[legacyCursor]
    const tsItem = remainingTs[tsCursor]
    if (legacyItem === undefined) break
    if (tsItem === undefined) break
    if (sequenceFingerprint(legacyItem.event) === sequenceFingerprint(tsItem.event)) {
      legacyUsed.add(legacyItem.index)
      tsUsed.add(tsItem.index)
      matches.push({
        legacyIndex: legacyItem.index,
        tsIndex: tsItem.index,
        quality: 'sequence',
        reason: sequenceFingerprint(legacyItem.event),
      })
      const trace = traceMap.get(legacyItem.index)
      if (trace) {
        trace.selectedIndex = tsItem.index
        trace.selectedQuality = 'sequence'
        trace.selectedReason = sequenceFingerprint(legacyItem.event)
      }
      legacyCursor++
      tsCursor++
      continue
    }
    const nextLegacyMatch = remainingTs.findIndex((item, index) => index >= tsCursor && sequenceFingerprint(item.event) === sequenceFingerprint(legacyItem.event))
    const nextTsMatch = remainingLegacy.findIndex((item, index) => index >= legacyCursor && sequenceFingerprint(item.event) === sequenceFingerprint(tsItem.event))
    if (nextLegacyMatch !== -1 && (nextTsMatch === -1 || nextLegacyMatch - tsCursor <= nextTsMatch - legacyCursor)) {
      tsCursor = nextLegacyMatch
      continue
    }
    if (nextTsMatch !== -1) {
      legacyCursor = nextTsMatch
      continue
    }
    legacyCursor++
    tsCursor++
  }

  return matches
}

function compareSongMeta(caseId: string, legacy: NormalizedMeta, ts: NormalizedMeta): SongGap[] {
  const gaps: SongGap[] = []
  const fields: Array<[string, unknown, unknown]> = [
    ['title', legacy.title, ts.title],
    ['composer', legacy.composer, ts.composer],
    ['number', legacy.number, ts.number],
    ['filename', legacy.filename, ts.filename],
    ['meter', legacy.meter, ts.meter],
    ['key', legacy.key, ts.key],
    ['oKey', legacy.oKey, ts.oKey],
    ['tempo', legacy.tempo, ts.tempo],
    ['tempoDisplay', legacy.tempoDisplay, ts.tempoDisplay],
    ['checksum', legacy.checksum, ts.checksum],
  ]

  for (const [fieldPath, legacyValue, tsValue] of fields) {
    const gap = compareFieldValue(
      caseId,
      { ...emptyEvent('legacy'), sourcePath: 'meta', voiceId: 'meta', voiceIndex: -1, indexInVoice: -1, globalIndex: -1, kind: 'meta', stableKey: 'meta', decorations: [] },
      { ...emptyEvent('ts'), sourcePath: 'meta', voiceId: 'meta', voiceIndex: -1, indexInVoice: -1, globalIndex: -1, kind: 'meta', stableKey: 'meta', decorations: [] },
      fieldPath,
      legacyValue,
      tsValue,
      { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} },
    )
    if (gap !== null) gaps.push(gap)
  }

  return gaps
}

function compareSongHarpnoteOptions(
  caseId: string,
  legacy: NormalizedHarpnoteOptions | undefined,
  ts: NormalizedHarpnoteOptions | undefined,
): SongGap[] {
  const gaps: SongGap[] = []
  const legacyEvent = { ...emptyEvent('legacy'), sourcePath: 'harpnote_options', voiceId: 'song', voiceIndex: -1, indexInVoice: -1, globalIndex: -1, kind: 'song', stableKey: 'harpnote_options' }
  const tsEvent = { ...emptyEvent('ts'), sourcePath: 'harpnote_options', voiceId: 'song', voiceIndex: -1, indexInVoice: -1, globalIndex: -1, kind: 'song', stableKey: 'harpnote_options' }
  const fields: Array<[string, unknown, unknown]> = [
    ['lyrics.text', legacy?.lyrics?.text, ts?.lyrics?.text],
    ['template.filebase', legacy?.template?.filebase, ts?.template?.filebase],
    ['template.title', legacy?.template?.title, ts?.template?.title],
    ['print', legacy?.print, ts?.print],
  ]

  for (const [fieldPath, legacyValue, tsValue] of fields) {
    const gap = compareFieldValue(
      caseId,
      legacyEvent,
      tsEvent,
      fieldPath,
      legacyValue,
      tsValue,
      { required: [], optional: [], ignored: [], aliases: {}, tolerances: {} },
    )
    if (gap !== null) gaps.push(gap)
  }

  const legacyRawKeys = legacy?.raw ? Object.keys(legacy.raw) : []
  const tsRawKeys = ts?.raw ? Object.keys(ts.raw) : []
  if (legacyRawKeys.length > 0 || tsRawKeys.length > 0) {
    gaps.push({
      category: 'ignored-by-contract',
      caseId,
      stage: 'song',
      voiceIndex: -1,
      voiceId: 'song',
      measure: undefined,
      beat: undefined,
      eventKind: 'song',
      stableKey: 'harpnote_options',
      legacyJsonPath: 'harpnote_options',
      tsJsonPath: 'harpnote_options',
      legacyValue: legacy?.raw,
      tsValue: ts?.raw,
      matchQuality: 'exact-source',
      impact: 'Unknown harpnote_options subfields are preserved for review instead of being silently discarded.',
      message: 'Ignored harpnote_options subfields are present on at least one side.',
    })
  }

  return gaps
}

function emptyEvent(source: SongParitySource): NormalizedEvent {
  return {
    stableKey: source,
    kind: source,
    voiceId: source,
    voiceIndex: -1,
    indexInVoice: -1,
    globalIndex: -1,
    decorations: [],
    sourcePath: 'meta',
  }
}

export function compareNormalizedSongs(
  legacy: NormalizedSong,
  ts: NormalizedSong,
  contract: SongFieldContract,
  caseId: string,
): SongParityComparisonResult {
  const gaps: SongGap[] = []
  gaps.push(...compareSongHarpnoteOptions(caseId, legacy.harpnoteOptions, ts.harpnoteOptions))
  gaps.push(...compareSongMeta(caseId, legacy.meta, ts.meta))

  const legacyEvents = legacy.events
  const tsEvents = ts.events
  const legacyUsed = new Set<number>()
  const tsUsed = new Set<number>()
  const traceMap = new Map<number, MatchTraceEntry>()

  for (let index = 0; index < legacyEvents.length; index++) {
    const event = legacyEvents[index]
    if (event) traceMap.set(index, buildTraceEntry(event.voiceIndex, event))
  }

  const matches: Array<{ legacyIndex: number; tsIndex: number; quality: MatchQuality; reason: string }> = []
  matches.push(...alignByKey(legacyEvents, tsEvents, legacyUsed, tsUsed, exactSourceKey, 'exact-source', traceMap))
  matches.push(...alignByKey(legacyEvents, tsEvents, legacyUsed, tsUsed, exactPositionKey, 'exact-position', traceMap))
  matches.push(...alignByNearPosition(legacyEvents, tsEvents, legacyUsed, tsUsed, traceMap))
  matches.push(...buildSequenceMatches(legacyEvents, tsEvents, legacyUsed, tsUsed, traceMap))

  const matchedEvents: MatchedEventPair[] = []
  for (const match of matches) {
    const legacyEvent = legacyEvents[match.legacyIndex]
    const tsEvent = tsEvents[match.tsIndex]
    if (legacyEvent === undefined || tsEvent === undefined) continue
    matchedEvents.push({
      quality: match.quality,
      legacy: legacyEvent,
      ts: tsEvent,
      trace: traceMap.get(match.legacyIndex) ?? buildTraceEntry(legacyEvent.voiceIndex, legacyEvent),
    })
    gaps.push(...compareEvents(caseId, legacyEvent, tsEvent))
    if (match.quality === 'ambiguous') {
      gaps.push(createAmbiguousGap(caseId, legacyEvent, match.reason))
    }
    if (match.quality !== 'exact-source' && match.quality !== 'exact-position') {
      gaps.push(withGapExcerpt({
        category: 'different-array-order',
        caseId,
        stage: 'song',
        voiceIndex: legacyEvent.voiceIndex,
        voiceId: legacyEvent.voiceId,
        measure: legacyEvent.measure,
        beat: legacyEvent.beat,
        eventKind: legacyEvent.kind,
        stableKey: legacyEvent.stableKey,
        legacyJsonPath: legacyEvent.sourcePath,
        tsJsonPath: tsEvent.sourcePath,
        legacyValue: legacyEvent.indexInVoice,
        tsValue: tsEvent.indexInVoice,
        matchQuality: match.quality,
        impact: 'The event was matched, but only after reordering. This is a structural divergence that can influence downstream presentation.',
        message: `Matched by ${match.quality} instead of source or position.`,
      }, legacyEvent, tsEvent))
    }
  }

  const unmatchedLegacyEvents = legacyEvents.filter((_, index) => !legacyUsed.has(index))
  const unmatchedTsEvents = tsEvents.filter((_, index) => !tsUsed.has(index))

  for (const event of unmatchedLegacyEvents) {
    gaps.push(withGapExcerpt({
      category: 'missing-event',
      caseId,
      stage: 'song',
      voiceIndex: event.voiceIndex,
      voiceId: event.voiceId,
      measure: event.measure,
      beat: event.beat,
      eventKind: event.kind,
      stableKey: event.stableKey,
      legacyJsonPath: event.sourcePath,
      tsJsonPath: '-',
      legacyValue: event.raw ?? event.debug ?? event,
      matchQuality: 'unmatched',
      impact: 'Legacy has an event that the TS pipeline does not reproduce. This often changes later layout or repeat handling.',
      message: 'Legacy event remained unmatched.',
    }, event))
  }

  for (const event of unmatchedTsEvents) {
    gaps.push(withGapExcerpt({
      category: 'extra-event',
      caseId,
      stage: 'song',
      voiceIndex: event.voiceIndex,
      voiceId: event.voiceId,
      measure: event.measure,
      beat: event.beat,
      eventKind: event.kind,
      stableKey: event.stableKey,
      legacyJsonPath: '-',
      tsJsonPath: event.sourcePath,
      tsValue: event.raw ?? event.debug ?? event,
      matchQuality: 'unmatched',
      impact: 'TS emits an event that legacy did not expose. That can alter the sheet model downstream.',
      message: 'TS event remained unmatched.',
    }, undefined, event))
  }

  if (legacyEvents.length !== tsEvents.length) {
    gaps.push(withGapExcerpt({
      category: 'different-length',
      caseId,
      stage: 'song',
      voiceIndex: undefined,
      voiceId: undefined,
      eventKind: undefined,
      stableKey: undefined,
      legacyJsonPath: `events.length`,
      tsJsonPath: `events.length`,
      legacyValue: legacyEvents.length,
      tsValue: tsEvents.length,
      matchQuality: 'unmatched',
      impact: 'A different event count is a structural regression and usually cascades into sheet mismatches.',
      message: 'Song event list lengths differ.',
    }, legacyEvents[0], tsEvents[0]))
  }

  const diagnostics = [...legacy.diagnostics, ...ts.diagnostics]
  const warningCount = diagnostics.filter((diag) => diag.category === 'normalization-warning').length
  for (const diag of diagnostics) {
    gaps.push({
      category: diag.category,
      caseId,
      stage: 'song',
      voiceIndex: undefined,
      voiceId: undefined,
      eventKind: undefined,
      stableKey: undefined,
      legacyJsonPath: diag.source === 'legacy' ? diag.path : '-',
      tsJsonPath: diag.source === 'ts' ? diag.path : '-',
      legacyValue: diag.source === 'legacy' ? diag.value : undefined,
      tsValue: diag.source === 'ts' ? diag.value : undefined,
      matchQuality: 'unmatched',
      impact: diag.category === 'ignored-by-contract'
        ? 'Documented and intentionally excluded by the Song Field Contract.'
        : 'Normalization produced a warning. Inspect the raw source before trusting this parity result.',
      message: diag.message,
    })
  }

  const requiredGapCount = gaps.filter((gap) => gap.category !== 'ignored-by-contract' && gap.category !== 'normalization-warning').length

  return {
    caseId,
    legacy,
    ts,
    matchedEvents,
    unmatchedLegacyEvents,
    unmatchedTsEvents,
    gaps,
    trace: [...traceMap.values()].sort((a, b) => a.legacyIndex - b.legacyIndex),
    requiredGapCount,
    warningCount,
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderValue(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? 'null'
}

function renderInlineValue(value: unknown): string {
  const json = JSON.stringify(value)
  if (json === undefined) return '`undefined`'
  const compact = json.length > 160 ? `${json.slice(0, 157)}…` : json
  return `\`${compact.replace(/`/g, '\\`')}\``
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function countByCategory(gaps: SongGap[]): Map<GapCategory, number> {
  const counts = new Map<GapCategory, number>()
  for (const gap of gaps) {
    counts.set(gap.category, (counts.get(gap.category) ?? 0) + 1)
  }
  return counts
}

function renderGapOverviewTable(gaps: SongGap[]): string {
  const counts = countByCategory(gaps)
  const categories = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b))
  const lines = [
    '| Gap category | Count |',
    '| --- | ---: |',
  ]
  for (const category of categories) {
    lines.push(`| ${category} | ${counts.get(category) ?? 0} |`)
  }
  return lines.join('\n')
}

function renderGapValue(value: unknown): string {
  if (value === undefined) return '-'
  return escapeTableCell(renderInlineValue(value))
}

function renderGap(gap: SongGap, index: number): string {
  const contextParts = [
    `voice=${gap.voiceId ?? '-'} (${gap.voiceIndex ?? '-'})`,
    `measure=${gap.measure ?? '-'}`,
    `beat=${gap.beat ?? '-'}`,
    `kind=${gap.eventKind ?? '-'}`,
  ]
  const lines = [
    `### Gap ${index + 1}: ${gap.category}`,
    '',
    `- **Impact / downstream relevance:** ${escapeTableCell(gap.impact)}`,
    `- **Message:** ${escapeTableCell(gap.message)}`,
    '',
    '| Field | Legacy | TS |',
    '| --- | --- | --- |',
    `| Context | ${escapeTableCell(contextParts.join(' · '))} | ${escapeTableCell(contextParts.join(' · '))} |`,
    `| ABC position | ${escapeTableCell(gap.legacyAbcPosition ?? '-')} | ${escapeTableCell(gap.tsAbcPosition ?? '-')} |`,
    `| Match quality | ${escapeTableCell(gap.matchQuality ?? '-')} | ${escapeTableCell(gap.matchQuality ?? '-')} |`,
    `| Stable key | ${escapeTableCell(gap.stableKey ?? '-')} | ${escapeTableCell(gap.stableKey ?? '-')} |`,
    `| Path | ${escapeTableCell(gap.legacyJsonPath ?? '-')} | ${escapeTableCell(gap.tsJsonPath ?? '-')} |`,
    `| Value | ${renderGapValue(gap.legacyValue)} | ${renderGapValue(gap.tsValue)} |`,
  ]
  if (gap.abcExcerpt !== undefined) {
    lines.push('')
    lines.push(`ABC excerpt: \`${escapeTableCell(gap.abcExcerpt).replace(/`/g, '\\`')}\``)
  }
  return lines.join('\n')
}

function renderCaseReport(caseReport: SongParityCaseReport): string {
  const result = caseReport.result
  const lines = [
    `# Song Parity Report - ${caseReport.caseId}`,
    '',
    `Case: ${caseReport.caseId}`,
    `Stage: song`,
    '',
    '## Summary',
    '',
    `- Required gaps: ${result.requiredGapCount}`,
    `- Warnings: ${result.warningCount}`,
    `- Matched events: ${result.matchedEvents.length}`,
    `- Unmatched legacy events: ${result.unmatchedLegacyEvents.length}`,
    `- Unmatched TS events: ${result.unmatchedTsEvents.length}`,
    '',
    '## Gap Type Overview',
    '',
    result.gaps.length === 0 ? 'No gaps detected.' : renderGapOverviewTable(result.gaps),
    '',
    '## Gaps',
    '',
  ]

  if (result.gaps.length === 0) {
    lines.push('No gaps detected.', '')
  } else {
    for (const [index, gap] of result.gaps.entries()) {
      lines.push(renderGap(gap, index))
      lines.push('')
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function renderCaseReportJson(caseReport: SongParityCaseReport): string {
  return `${JSON.stringify(caseReport.result, null, 2)}\n`
}

function renderNormalizedSongJson(song: NormalizedSong): string {
  return `${JSON.stringify(song, null, 2)}\n`
}

function renderGlobalReport(summary: SongParityRunSummary): string {
  const allGaps = summary.cases.flatMap((caseReport) => caseReport.result.gaps)
  const lines = [
    '# Song Gap Report',
    '',
    'Global overview for case-based song parity.',
    'The per-case artifacts live under `fixtures/cases/<case>/_parity/song/`.',
    '',
    '## Summary',
    '',
    `- Cases with reports: ${summary.cases.length}`,
    `- Required gaps: ${summary.requiredGapCount}`,
    `- Warnings: ${summary.warningCount}`,
    '',
    '## Gap Type Overview',
    '',
    allGaps.length === 0 ? 'No gaps detected.' : renderGapOverviewTable(allGaps),
    '',
    '## Case Reports',
    '',
  ]

  if (summary.cases.length === 0) {
    lines.push('No case reports generated.', '')
  } else {
    for (const caseReport of summary.cases) {
      const relativeReportPath = resolve(caseReport.caseDir, '_parity/song/reports/song-gap-report.md').replace(`${REPO_ROOT}/`, '')
      lines.push(`- [${caseReport.caseId}](${relativeReportPath})`)
      lines.push(`  - Required gaps: ${caseReport.result.requiredGapCount}`)
      lines.push(`  - Warnings: ${caseReport.result.warningCount}`)
      lines.push(`  - Matched events: ${caseReport.result.matchedEvents.length}`)
      lines.push(`  - Unmatched legacy events: ${caseReport.result.unmatchedLegacyEvents.length}`)
      lines.push(`  - Unmatched TS events: ${caseReport.result.unmatchedTsEvents.length}`)
      lines.push('')
    }
  }

  lines.push('## Manual Registry', '')
  lines.push('`fixtures/openImplementations.ts` remains the manually curated list for systematic gaps.')
  lines.push('')
  return `${lines.join('\n').trimEnd()}\n`
}

// ---------------------------------------------------------------------------
// Artifact writing
// ---------------------------------------------------------------------------

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true })
}

function writeText(path: string, content: string): void {
  ensureDir(dirname(path))
  writeFileSync(path, content, 'utf-8')
}

function caseDirFor(caseId: string): string {
  return resolve(CASES_ROOT, caseId)
}

function normalizedDirFor(caseId: string): string {
  return resolve(caseDirFor(caseId), '_parity/song/normalized')
}

function reportDirFor(caseId: string): string {
  return resolve(caseDirFor(caseId), '_parity/song/reports')
}

function debugDirFor(caseId: string): string {
  return resolve(caseDirFor(caseId), '_parity/song/debug')
}

function loadTsSongDump(caseId: string): unknown {
  const fixture = loadFixture(caseId)
  const song = transformFixtureToSong(fixture)
  return song as unknown
}

export function runSongParityForCase(caseId: string): SongParityCaseReport {
  const contract = loadContract()
  const caseDir = caseDirFor(caseId)
  const fixture = loadFixture(caseId)
  const rawLegacy = fixture.song
  if (rawLegacy === null || rawLegacy === undefined) {
    throw new Error(`Missing legacy song fixture for case ${caseId}`)
  }
  const tsSong = loadTsSongDump(caseId)
  const context: SongParityContext = {
    caseId,
    abcText: fixture.input.abc,
  }

  const legacyNormalized = normalizeLegacySong(rawLegacy, context)
  const tsNormalized = normalizeTsSong(tsSong, context)
  const result = compareNormalizedSongs(legacyNormalized, tsNormalized, contract, caseId)

  const normalizedDir = normalizedDirFor(caseId)
  const reportDir = reportDirFor(caseId)
  const debugDir = debugDirFor(caseId)
  ensureDir(normalizedDir)
  ensureDir(reportDir)
  ensureDir(debugDir)

  writeText(resolve(normalizedDir, 'legacy.normalized-song.json'), renderNormalizedSongJson(legacyNormalized))
  writeText(resolve(normalizedDir, 'ts.normalized-song.json'), renderNormalizedSongJson(tsNormalized))

  const caseReport: SongParityCaseReport = {
    caseId,
    caseDir,
    normalizedDir,
    reportDir,
    debugDir,
    result,
  }

  writeText(resolve(reportDir, 'song-gap-report.md'), renderCaseReport(caseReport))
  writeText(resolve(reportDir, 'song-gap-report.json'), renderCaseReportJson(caseReport))
  writeText(resolve(debugDir, 'matched-events.json'), `${JSON.stringify(result.matchedEvents, null, 2)}\n`)
  writeText(resolve(debugDir, 'unmatched-legacy-events.json'), `${JSON.stringify(result.unmatchedLegacyEvents, null, 2)}\n`)
  writeText(resolve(debugDir, 'unmatched-ts-events.json'), `${JSON.stringify(result.unmatchedTsEvents, null, 2)}\n`)
  writeText(resolve(debugDir, 'matching-trace.json'), `${JSON.stringify(result.trace, null, 2)}\n`)

  writeText(resolve(caseDir, '_ts_output/song.json'), `${JSON.stringify(tsSong, null, 2)}\n`)

  return caseReport
}

export function runSongParity(caseIds: string[]): SongParityRunSummary {
  const cases = caseIds.map((caseId) => runSongParityForCase(caseId))
  const summary: SongParityRunSummary = {
    cases,
    requiredGapCount: cases.reduce((sum, item) => sum + item.result.requiredGapCount, 0),
    warningCount: cases.reduce((sum, item) => sum + item.result.warningCount, 0),
  }
  writeText(resolve(REPORTS_ROOT, 'song-gap-report.md'), renderGlobalReport(summary))
  writeText(resolve(REPORTS_ROOT, 'song-gap-report.json'), `${JSON.stringify(summary, null, 2)}\n`)
  return summary
}

export function getSongParityCaseIds(all: boolean, requestedCaseId?: string): string[] {
  if (all) {
    return scanFixtureCases()
      .filter((fixture) => fixture.hasSongFixture)
      .map((fixture) => fixture.id)
  }
  if (requestedCaseId !== undefined && requestedCaseId.trim().length > 0) {
    return [requestedCaseId.trim()]
  }
  return []
}

export function hasRequiredSongGaps(result: SongParityComparisonResult): boolean {
  return result.requiredGapCount > 0
}
