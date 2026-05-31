/**
 * Semantic comparison helpers for legacy regression tests.
 *
 * Rather than exact JSON equality, only domain-relevant fields are checked.
 * Floating-point positions are compared with configurable tolerances.
 */

// ---------------------------------------------------------------------------
// Tolerances (in mm, matching the spec)
// ---------------------------------------------------------------------------

const POSITION_TOLERANCE = 0.1  // center, from, to
const SIZE_TOLERANCE = 0.05     // size
const CREATED_FOOTER_PATTERN = /^(.*) - created(?: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})? by Zupfnoter(?: .*)?$/

// ---------------------------------------------------------------------------
// Fixture types (shape of the JSON files in fixtures/cases/<name>/)
// ---------------------------------------------------------------------------

export interface EntityFixture {
  type: 'Note' | 'Pause' | 'SynchPoint' | 'Goto' | 'MeasureStart' | 'NewPart' | string
  barDecorations?: string[]
  confKey?: string
  decorations?: string[]
  endPos?: [number, number]
  sourceOffsets?: [number, number]
  firstInPart?: boolean
  countNote?: string | null
  lyrics?: string | null
  pitch?: number
  duration?: number
  beat?: number
  text?: string
  position?: [number, number]
  style?: string
  measureCount?: number
  measureStart?: boolean
  nextPitch?: number
  prevPitch?: number
  slurStarts?: number[]
  slurEnds?: number[]
  startPos?: [number, number]
  time?: number
  jumpStarts?: string[]
  jumpEnds?: string[]
  variant?: 0 | 1 | 2
  visible?: boolean
  tieStart?: boolean
  tieEnd?: boolean
  znId?: string
  tuplet?: number
  tupletStart?: boolean | null
  tupletEnd?: boolean | null
  from?: number
  to?: number
  policy?: Record<string, unknown>
  /** Allow additional fields produced by the legacy raw exporter. */
  [extraField: string]: unknown
}

export interface VoiceFixture {
  entities: EntityFixture[]
}

export interface SongFixture {
  _comment?: string
  meta_data: Record<string, unknown>
  /** Optional harpnote-specific options block (lyrics text etc.) */
  harpnote_options?: Record<string, unknown>
  voices: VoiceFixture[]
  beat_maps: Record<string, number>[]
  /** Allow additional top-level fields exported by the legacy serializer. */
  [extraField: string]: unknown
}

export interface DrawableFixture {
  type: 'Ellipse' | 'FlowLine' | 'Glyph' | 'Annotation' | 'Path' | 'Image' | string
  // Ellipse
  center?: [number, number]
  size?: [number, number]
  fill?: boolean
  // Path
  path?: [number, number][]
  confKey?: string
  more_conf_keys?: unknown
  draginfo?: unknown
  lineWidth?: number
  visible?: boolean
  // FlowLine
  from?: [number, number]
  to?: [number, number]
  style?: 'solid' | 'dashed' | 'dotted' | string
  // Glyph
  glyphName?: string
  // Annotation
  text?: string
  // Common
  color?: string
  znId?: string
}

export interface SheetFixture {
  _comment?: string
  children: DrawableFixture[]
}

export interface SvgFixture {
  svg: string
}

// ---------------------------------------------------------------------------
// Mismatch reporting
// ---------------------------------------------------------------------------

export interface Mismatch {
  path: string
  expected: unknown
  actual: unknown
}

export interface MatchResult {
  passed: boolean
  mismatches: Mismatch[]
}

function fail(mismatches: Mismatch[], path: string, expected: unknown, actual: unknown): void {
  mismatches.push({ path, expected, actual })
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

function nearlyEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance
}

function comparePoint(
  actual: [number, number] | undefined,
  expected: [number, number] | undefined,
  path: string,
  tolerance: number,
  mismatches: Mismatch[],
): void {
  if (expected === undefined) return
  if (actual === undefined) {
    fail(mismatches, path, expected, undefined)
    return
  }
  if (!nearlyEqual(actual[0], expected[0], tolerance) || !nearlyEqual(actual[1], expected[1], tolerance)) {
    fail(mismatches, path, expected, actual)
  }
}

function parseIndexedPath(path: string, rootKey: string, childKey: string): { rootIndex: number; childIndex: number } | null {
  const match = path.match(new RegExp(`^${rootKey}\\[(\\d+)\\]\\.${childKey}\\[(\\d+)\\]`))
  if (!match) return null
  const rootIndex = Number.parseInt(match[1] ?? '', 10)
  const childIndex = Number.parseInt(match[2] ?? '', 10)
  if (!Number.isInteger(rootIndex) || !Number.isInteger(childIndex)) return null
  return { rootIndex, childIndex }
}

export function resolveSongFixtureZnId(song: SongFixture, path: string): string | undefined {
  const parsed = parseIndexedPath(path, 'voices', 'entities')
  if (!parsed) return undefined
  const entity = song.voices[parsed.rootIndex]?.entities[parsed.childIndex]
  return typeof entity?.znId === 'string' && entity.znId.length > 0 ? entity.znId : undefined
}

export function resolveSheetFixtureZnId(sheet: SheetFixture, path: string): string | undefined {
  const match = path.match(/^children\[(\d+)\]/)
  if (!match) return undefined
  const index = Number.parseInt(match[1] ?? '', 10)
  if (!Number.isInteger(index)) return undefined
  const child = sheet.children[index]
  return typeof child?.znId === 'string' && child.znId.length > 0 ? child.znId : undefined
}

// ---------------------------------------------------------------------------
// Song comparison (Stufe 2)
// ---------------------------------------------------------------------------

/** Top-level fixture fields handled by dedicated comparison logic in matchSong. */
const SONG_HANDLED_FIELDS = new Set(['_comment', 'voices', 'beat_maps'])

/**
 * Compares a Song output against a fixture.
 *
 * All fields present in the fixture are compared:
 *   - voices: per-entity comparison (all entity fields in the fixture)
 *   - beat_maps: normalized key→beat map comparison
 *   - meta_data, harpnote_options and any other top-level fields:
 *     deep recursive comparison via compareFixtureValue
 *
 * The comparison is one-sided: only fields present in the fixture are checked
 * against the actual output. Extra fields in the actual output are ignored.
 * The internal `_comment` fixture field is skipped.
 */
export function matchSong(actual: SongFixture, fixture: SongFixture): MatchResult {
  const mismatches: Mismatch[] = []

  // Reject placeholder fixtures — empty voices[] means the fixture was never populated
  if (fixture.voices.length === 0) {
    return {
      passed: false,
      mismatches: [{ path: 'fixture', expected: 'non-empty fixture', actual: 'placeholder (voices: [])' }],
    }
  }

  // Compare every top-level field in the fixture (meta_data, harpnote_options,
  // plus any additional legacy-exported fields) — voices and beat_maps are
  // handled by the dedicated logic below.
  const actualRecord = actual as unknown as Record<string, unknown>
  for (const [key, expectedValue] of Object.entries(fixture)) {
    if (SONG_HANDLED_FIELDS.has(key)) continue
    diffFixtureValue(actualRecord[key], expectedValue, key, mismatches)
  }

  // Voice count
  if (actual.voices.length !== fixture.voices.length) {
    fail(mismatches, 'voices.length', fixture.voices.length, actual.voices.length)
    return { passed: false, mismatches }
  }

  if (actual.beat_maps.length !== fixture.beat_maps.length) {
    fail(mismatches, 'beat_maps.length', fixture.beat_maps.length, actual.beat_maps.length)
    return { passed: false, mismatches }
  }

  for (let bi = 0; bi < fixture.beat_maps.length; bi++) {
    const actualBeatMap = actual.beat_maps[bi]
    const expectedBeatMap = fixture.beat_maps[bi]
    if (actualBeatMap === undefined || expectedBeatMap === undefined) continue

    const normalizedActualBeatMap = normalizeBeatMap(actualBeatMap)
    const normalizedExpectedBeatMap = normalizeBeatMap(expectedBeatMap)

    if (!compareFixtureValue(normalizedActualBeatMap, normalizedExpectedBeatMap)) {
      fail(
        mismatches,
        `beat_maps[${bi}]`,
        normalizedExpectedBeatMap,
        normalizedActualBeatMap,
      )
    }
  }

  for (let vi = 0; vi < fixture.voices.length; vi++) {
    const actualVoice = actual.voices[vi]
    const expectedVoice = fixture.voices[vi]
    if (actualVoice === undefined || expectedVoice === undefined) continue
    const vPath = `voices[${vi}]`

    if (actualVoice.entities.length !== expectedVoice.entities.length) {
      fail(mismatches, `${vPath}.entities.length`, expectedVoice.entities.length, actualVoice.entities.length)
      continue
    }

    const unmatchedActual = actualVoice.entities.map((entity, index) => ({ entity, index }))

    for (let ei = 0; ei < expectedVoice.entities.length; ei++) {
      const fe = expectedVoice.entities[ei]
      if (fe === undefined) continue

      const matchIndex = unmatchedActual.findIndex(({ entity: ae }) => compareSongEntity(ae, fe))

      if (matchIndex === -1) {
        fail(mismatches, `${vPath}.entities[${ei}]`, fe, 'no matching entity')
        continue
      }

      unmatchedActual.splice(matchIndex, 1)
    }
  }

  return { passed: mismatches.length === 0, mismatches }
}

function normalizeBeatMap(beatMap: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(beatMap).filter(([key, value]) => key !== 'entries' && typeof value === 'number'),
  )
}

function compareSongEntity(actual: EntityFixture, expected: EntityFixture): boolean {
  if (expected.type !== 'Note' && expected.type !== 'Pause' && expected.type !== 'SynchPoint') {
    return actual.type === expected.type
  }

  const comparableFields = new Set([
    'type',
    'beat',
    'variant',
    'visible',
    'znId',
    'pitch',
    'duration',
    'tieStart',
    'tieEnd',
    'measureStart',
    'measureCount',
    'countNote',
    'firstInPart',
    'from',
    'to',
    'confKey',
    'policy',
    'text',
    'position',
    'style',
  ])
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!comparableFields.has(key)) continue
    const actualValue = actual[key as keyof EntityFixture]
    if (!compareFixtureValue(actualValue, expectedValue)) {
      return false
    }
  }

  return true
}

/**
 * Recursive comparison that records mismatches with their precise path.
 * Used for top-level Song fields like `meta_data` so failures point to the
 * specific nested key (e.g. `meta_data.tempo.bpm`) instead of the whole object.
 */
function diffFixtureValue(
  actual: unknown,
  expected: unknown,
  path: string,
  mismatches: Mismatch[],
): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      fail(mismatches, path, expected, actual)
      return
    }
    for (let i = 0; i < expected.length; i++) {
      diffFixtureValue(actual[i], expected[i], `${path}[${i}]`, mismatches)
    }
    return
  }

  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
      fail(mismatches, path, expected, actual)
      return
    }
    const actualObject = actual as Record<string, unknown>
    for (const [key, value] of Object.entries(expected)) {
      diffFixtureValue(actualObject[key], value, `${path}.${key}`, mismatches)
    }
    return
  }

  if (actual !== expected) {
    fail(mismatches, path, expected, actual)
  }
}

function compareFixtureValue(actual: unknown, expected: unknown): boolean {
  if (typeof actual === 'number' && typeof expected === 'number') {
    return Math.abs(actual - expected) <= 1e-9
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false
    return expected.every((item, index) => compareFixtureValue(actual[index], item))
  }

  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object') return false
    for (const [key, value] of Object.entries(expected)) {
      if (key.startsWith('$$')) continue
      const actualObject = actual as Record<string, unknown>
      if (!compareFixtureValue(actualObject[key], value)) return false
    }
    return true
  }

  return actual === expected
}

function normalizeSheetText(text: string | undefined): string | undefined {
  if (text === undefined) return undefined
  const createdMatch = text.match(CREATED_FOOTER_PATTERN)
  if (createdMatch) {
    const filename = createdMatch[1] ?? ''
    return `${filename} - created by Zupfnoter`
  }
  return text
}

// ---------------------------------------------------------------------------
// Sheet comparison (Stufe 3)
// ---------------------------------------------------------------------------

/**
 * Compares a Sheet output against a fixture.
 *
 * Positions (center, from, to) are compared with ±0.1 mm tolerance.
 * Sizes are compared with ±0.05 mm tolerance.
 * type, fill, color, style, glyphName, text are compared exactly.
 * The number of children must match exactly.
 *
 * Skipped: draginfo, internal references.
 */
export function matchSheet(actual: SheetFixture, fixture: SheetFixture): MatchResult {
  const mismatches: Mismatch[] = []

  // Reject placeholder fixtures — empty children[] means the fixture was never populated
  if (fixture.children.length === 0) {
    return {
      passed: false,
      mismatches: [{ path: 'fixture', expected: 'non-empty fixture', actual: 'placeholder (children: [])' }],
    }
  }

  // Child count — any deviation is always an error
  if (actual.children.length !== fixture.children.length) {
    fail(mismatches, 'children.length', fixture.children.length, actual.children.length)
    return { passed: false, mismatches }
  }

  for (let i = 0; i < fixture.children.length; i++) {
    const ac = actual.children[i]
    const fc = fixture.children[i]
    if (ac === undefined || fc === undefined) continue
    const cPath = `children[${i}]`

    // type (exact)
    if (ac.type !== fc.type) {
      fail(mismatches, `${cPath}.type`, fc.type, ac.type)
    }

    // color (exact)
    if (fc.color !== undefined && ac.color !== fc.color) {
      fail(mismatches, `${cPath}.color`, fc.color, ac.color)
    }

    // lineWidth / znId (exact when present)
    if (fc.lineWidth !== undefined && ac.lineWidth !== fc.lineWidth) {
      fail(mismatches, `${cPath}.lineWidth`, fc.lineWidth, ac.lineWidth)
    }
    if (fc.znId !== undefined && ac.znId !== fc.znId) {
      fail(mismatches, `${cPath}.znId`, fc.znId, ac.znId)
    }

    // fill (exact)
    if (fc.fill !== undefined && ac.fill !== fc.fill) {
      fail(mismatches, `${cPath}.fill`, fc.fill, ac.fill)
    }

    // style (exact)
    if (fc.style !== undefined && ac.style !== fc.style) {
      fail(mismatches, `${cPath}.style`, fc.style, ac.style)
    }

    // confKey / editor metadata (exact when present)
    if (fc.confKey !== undefined && ac.confKey !== fc.confKey) {
      fail(mismatches, `${cPath}.confKey`, fc.confKey, ac.confKey)
    }
    if (fc.more_conf_keys !== undefined && !compareFixtureValue(ac.more_conf_keys, fc.more_conf_keys)) {
      fail(mismatches, `${cPath}.more_conf_keys`, fc.more_conf_keys, ac.more_conf_keys)
    }
    if (fc.draginfo !== undefined && !compareFixtureValue(ac.draginfo, fc.draginfo)) {
      fail(mismatches, `${cPath}.draginfo`, fc.draginfo, ac.draginfo)
    }

    // glyphName (exact)
    if (fc.glyphName !== undefined && ac.glyphName !== fc.glyphName) {
      fail(mismatches, `${cPath}.glyphName`, fc.glyphName, ac.glyphName)
    }

    // text (exact, except normalized created-footer timestamps)
    if (fc.text !== undefined) {
      const normalizedExpectedText = normalizeSheetText(fc.text)
      const normalizedActualText = normalizeSheetText(ac.text)
      if (normalizedActualText !== normalizedExpectedText) {
        fail(mismatches, `${cPath}.text`, normalizedExpectedText, normalizedActualText)
      }
    }

    // center (±0.1 mm)
    comparePoint(ac.center, fc.center, `${cPath}.center`, POSITION_TOLERANCE, mismatches)

    // from / to (±0.1 mm)
    comparePoint(ac.from, fc.from, `${cPath}.from`, POSITION_TOLERANCE, mismatches)
    comparePoint(ac.to, fc.to, `${cPath}.to`, POSITION_TOLERANCE, mismatches)

    // size (±0.05 mm)
    if (fc.size !== undefined) {
      if (ac.size === undefined) {
        fail(mismatches, `${cPath}.size`, fc.size, undefined)
      } else {
        const [acW, acH] = ac.size
        const [fcW, fcH] = fc.size
        if (
          acW === undefined || acH === undefined ||
          fcW === undefined || fcH === undefined ||
          !nearlyEqual(acW, fcW, SIZE_TOLERANCE) ||
          !nearlyEqual(acH, fcH, SIZE_TOLERANCE)
        ) {
          fail(mismatches, `${cPath}.size`, fc.size, ac.size)
        }
      }
    }
  }

  return { passed: mismatches.length === 0, mismatches }
}

// ---------------------------------------------------------------------------
// SVG comparison (Stufe 4)
//
// Structural comparison intentionally drops TS-only `data-*` metadata.
// Those attributes are preserved in the rendered SVG for runtime lookup and
// interaction diagnostics, but they do not exist in the legacy output and
// must not be reported as structural gaps.
// ---------------------------------------------------------------------------

const SVG_NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g
const SVG_TAG_PATTERN = /<[^>]+>/g
const SVG_ATTRIBUTE_PATTERN = /([^\s=/>]+)\s*=\s*"([^"]*)"/g
const SVG_DATA_ATTRIBUTE_PREFIX = 'data-'

function normalizeSvgNumber(value: string): string {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return value
  return parsed.toFixed(3).replace(/\.?0+$/, '')
}

function normalizeSvgTag(tag: string): string {
  if (tag.startsWith('</') || tag.startsWith('<?') || tag.startsWith('<!--')) {
    return tag
  }

  const isSelfClosing = tag.endsWith('/>')
  const nameMatch = tag.match(/^<([^\s/>]+)/)
  const tagName = nameMatch?.[1]
  if (tagName === undefined) return tag

  const attributes: Array<[string, string]> = []
  let attributeMatch: RegExpExecArray | null
  const attributePattern = new RegExp(SVG_ATTRIBUTE_PATTERN)

  while ((attributeMatch = attributePattern.exec(tag)) !== null) {
    const key = attributeMatch[1]
    const rawValue = attributeMatch[2]
    if (key === undefined || rawValue === undefined) continue
    if (key.startsWith(SVG_DATA_ATTRIBUTE_PREFIX)) continue

    const normalizedValue = rawValue.replace(SVG_NUMBER_PATTERN, normalizeSvgNumber)
    attributes.push([key, normalizedValue])
  }

  attributes.sort(([left], [right]) => left.localeCompare(right))
  const renderedAttributes = attributes.map(([key, value]) => `${key}="${value}"`).join(' ')
  const closing = isSelfClosing ? ' />' : '>'
  return renderedAttributes.length > 0
    ? `<${tagName} ${renderedAttributes}${closing}`
    : `<${tagName}${closing}`
}

export function normalizeSvgFixture(svg: string): SvgFixture {
  const withoutLineEndings = svg.replace(/\r\n?/g, '\n').trim()
  const normalizedTags = withoutLineEndings.replace(SVG_TAG_PATTERN, normalizeSvgTag)
  const collapsedWhitespace = normalizedTags
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim()

  return { svg: collapsedWhitespace }
}

export function matchSvg(actual: string, fixture: string): MatchResult {
  const normalizedActual = normalizeSvgFixture(actual)
  const normalizedFixture = normalizeSvgFixture(fixture)

  if (normalizedActual.svg === normalizedFixture.svg) {
    return { passed: true, mismatches: [] }
  }

  return {
    passed: false,
    mismatches: [
      {
        path: 'svg',
        expected: normalizedFixture.svg,
        actual: normalizedActual.svg,
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Vitest custom matcher (optional convenience)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Raw legacy fixture support
//
// The legacy CLI exports `song.legacy-raw.json` from `@music_model.to_json`,
// which uses Ruby instance-variable names ("@pitch", "@duration", …) and
// `class: "Harpnotes::Music::Note"` for the entity type. Voices are arrays
// whose first element is an abc2svg tune header (no `class`), followed by
// the actual music entities. Beat-map values are full entity objects.
//
// `normalizeRawSongFixture` rewrites the raw shape into the SongFixture
// shape consumed by `matchSong`, so the comparator does not need to know
// about raw at all.
// ---------------------------------------------------------------------------

const RAW_CLASS_TO_TYPE: Record<string, EntityFixture['type']> = {
  'Harpnotes::Music::Note':                'Note',
  'Harpnotes::Music::Pause':               'Pause',
  'Harpnotes::Music::SynchPoint':          'SynchPoint',
  'Harpnotes::Music::Goto':                'Goto',
  'Harpnotes::Music::Chordsymbol':         'Chordsymbol',
  'Harpnotes::Music::NoteBoundAnnotation': 'NoteBoundAnnotation',
  'Harpnotes::Music::MeasureStart':        'MeasureStart',
  'Harpnotes::Music::NewPart':             'NewPart',
}

function isRawEntity(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).class === 'string'
  )
}

function normalizeRawEntity(entity: Record<string, unknown>): EntityFixture {
  const cls = entity.class as string
  const out: EntityFixture = { type: RAW_CLASS_TO_TYPE[cls] ?? cls }
  if ('@bardecorations' in entity) out.barDecorations = entity['@bardecorations'] as string[]
  if ('@barDecorations' in entity) out.barDecorations = entity['@barDecorations'] as string[]
  if ('@bar_decorations' in entity) out.barDecorations = entity['@bar_decorations'] as string[]
  if ('@beat'      in entity) out.beat     = entity['@beat']      as number
  if ('@conf_key'  in entity) out.confKey  = entity['@conf_key']  as string
  if ('@count_note' in entity) out.countNote = entity['@count_note'] as string | null
  if ('@end_pos'   in entity) out.endPos   = entity['@end_pos']   as [number, number]
  if ('@first_in_part' in entity) out.firstInPart = entity['@first_in_part'] as boolean
  if ('@jump_starts' in entity) out.jumpStarts = entity['@jump_starts'] as string[]
  if ('@jump_ends'   in entity) out.jumpEnds   = entity['@jump_ends']   as string[]
  if ('@lyrics'    in entity) out.lyrics    = entity['@lyrics']    as string | null
  if ('@measure_count' in entity) out.measureCount = entity['@measure_count'] as number
  if ('@measure_start' in entity) out.measureStart = entity['@measure_start'] as boolean
  if ('@next_pitch' in entity) out.nextPitch = entity['@next_pitch'] as number
  if ('@prev_pitch' in entity) out.prevPitch = entity['@prev_pitch'] as number
  if ('@slur_starts' in entity) out.slurStarts = entity['@slur_starts'] as number[]
  if ('@slur_ends'   in entity) out.slurEnds   = entity['@slur_ends']   as number[]
  if ('@start_pos'   in entity) out.startPos   = entity['@start_pos']   as [number, number]
  if ('@time'        in entity) out.time      = entity['@time']        as number
  if ('@tuplet'      in entity) out.tuplet    = entity['@tuplet']      as number
  if ('@tuplet_start' in entity) out.tupletStart = entity['@tuplet_start'] as boolean
  if ('@tuplet_end'   in entity) out.tupletEnd   = entity['@tuplet_end']   as boolean
  if ('@variant'   in entity) out.variant  = entity['@variant']   as 0 | 1 | 2
  if ('@visible'   in entity) out.visible  = entity['@visible']   as boolean
  if ('@pitch'     in entity) out.pitch    = entity['@pitch']     as number
  if ('@duration'  in entity) out.duration = entity['@duration']  as number
  if (out.type === 'SynchPoint') {
    const proxyNote = getRawSynchPointProxyNote(entity)
    if (proxyNote !== undefined) {
      if (out.pitch === undefined && '@pitch' in proxyNote) out.pitch = proxyNote['@pitch'] as number
      if (out.variant === undefined && '@variant' in proxyNote) out.variant = proxyNote['@variant'] as 0 | 1 | 2
      if (out.measureStart === undefined && '@measure_start' in proxyNote) {
        out.measureStart = proxyNote['@measure_start'] as boolean
      }
    }
  }
  if ('@annotations' in entity && entity['@annotations'] && typeof entity['@annotations'] === 'object' && !Array.isArray(entity['@annotations'])) {
    const annotations = entity['@annotations'] as Record<string, unknown>
    if (typeof annotations.text === 'string') out.text = annotations.text
    if (Array.isArray(annotations.pos) && annotations.pos.length === 2 && typeof annotations.pos[0] === 'number' && typeof annotations.pos[1] === 'number') {
      out.position = [annotations.pos[0], annotations.pos[1]]
    }
    if (typeof annotations.style === 'string') out.style = annotations.style
  }
  if ('@tie_start' in entity) out.tieStart = entity['@tie_start'] as boolean
  if ('@tie_end'   in entity) out.tieEnd   = entity['@tie_end']   as boolean
  if ('@znid'      in entity) out.znId     = entity['@znid']      as string
  if (Array.isArray(entity['@decorations']) && entity['@decorations'].length > 0) {
    out.decorations = entity['@decorations']
  }
  if (out.type === 'Goto') {
    const from = entity['@from']
    const to   = entity['@to']
    if (isRawEntity(from) && '@beat' in from) out.from = from['@beat'] as number
    if (isRawEntity(to)   && '@beat' in to)   out.to   = to['@beat']   as number
    const policy = entity['@policy']
    if (policy && typeof policy === 'object' && !Array.isArray(policy)) {
      const policyObject = policy as Record<string, unknown>
      out.policy = {
        ...(policyObject.conf_key !== undefined ? { confKey: policyObject.conf_key } : {}),
        ...(policyObject.distance !== undefined ? { distance: policyObject.distance } : {}),
        ...(policyObject.from_anchor !== undefined ? { fromAnchor: policyObject.from_anchor } : {}),
        ...(policyObject.is_repeat !== undefined ? { isRepeat: policyObject.is_repeat } : {}),
        ...(policyObject.level !== undefined ? { level: policyObject.level } : {}),
        ...(policyObject.padding !== undefined ? { padding: policyObject.padding } : {}),
        ...(policyObject.to_anchor !== undefined ? { toAnchor: policyObject.to_anchor } : {}),
        ...(policyObject.vertical_anchor !== undefined ? { verticalAnchor: policyObject.vertical_anchor } : {}),
      }
    }
  }
  return out
}

function getRawSynchPointProxyNote(entity: Record<string, unknown>): Record<string, unknown> | undefined {
  const notes = entity['@notes']
  if (!Array.isArray(notes) || notes.length === 0) return undefined
  const proxy = notes[notes.length - 1]
  if (typeof proxy !== 'object' || proxy === null) return undefined
  return proxy as Record<string, unknown>
}

function normalizeRawVoice(voice: unknown): VoiceFixture {
  if (!Array.isArray(voice)) return { entities: [] }
  return { entities: voice.filter(isRawEntity).map(normalizeRawEntity) }
}

function normalizeRawBeatMap(beatMap: unknown): Record<string, number> {
  if (typeof beatMap !== 'object' || beatMap === null) return {}
  return Object.fromEntries(
    Object.entries(beatMap as Record<string, unknown>).flatMap(([key, value]) => {
      if (isRawEntity(value) && '@beat' in value) return [[key, (value as Record<string, unknown>)['@beat'] as number]]
      if (typeof value === 'number') return [[key, value]]
      return []
    }),
  )
}

function normalizeRawMetaData(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {}
  // Drop the abc2svg `sym` block under `tempo` — it is the internal abc parser
  // node that the TS pipeline must never carry through, so comparing it would
  // be pure noise.
  const tempo = meta.tempo
  if (tempo && typeof tempo === 'object' && 'sym' in tempo) {
    const { sym: _sym, ...tempoRest } = tempo as Record<string, unknown>
    return { ...meta, tempo: tempoRest }
  }
  return meta
}

/**
 * Converts a raw legacy song JSON (`song.legacy-raw.json`) into the
 * SongFixture shape consumed by `matchSong`. Top-level fields that the TS
 * pipeline does not yet emit (`harpnote_options`, abc2svg tune headers,
 * `tempo.sym` …) are intentionally dropped to keep the comparator focused on
 * the fields that are in scope for parity today.
 */
export function normalizeRawSongFixture(raw: unknown): SongFixture {
  const r = raw as {
    voices?: unknown[]
    beat_maps?: unknown[]
    meta_data?: Record<string, unknown>
  }
  return {
    meta_data: normalizeRawMetaData(r.meta_data),
    voices:    (r.voices    ?? []).map(normalizeRawVoice),
    beat_maps: (r.beat_maps ?? []).map(normalizeRawBeatMap),
  }
}

/**
 * Formats a MatchResult into a readable error message for test output.
 */
export function formatMismatches(result: MatchResult): string {
  if (result.passed) return 'OK'
  return result.mismatches
    .map((m) => `  ${m.path}:\n    expected: ${JSON.stringify(m.expected)}\n    actual:   ${JSON.stringify(m.actual)}`)
    .join('\n')
}
