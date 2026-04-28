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
  pitch?: number
  duration?: number
  beat?: number
  variant?: 0 | 1 | 2
  visible?: boolean
  tieStart?: boolean
  tieEnd?: boolean
  from?: number
  to?: number
}

export interface VoiceFixture {
  entities: EntityFixture[]
}

export interface SongFixture {
  _comment?: string
  meta_data: Record<string, unknown>
  voices: VoiceFixture[]
  beat_maps: Record<string, number>[]
}

export interface DrawableFixture {
  type: 'Ellipse' | 'FlowLine' | 'Glyph' | 'Annotation' | 'Path' | 'Image' | string
  // Ellipse
  center?: [number, number]
  size?: [number, number]
  fill?: boolean
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
}

export interface SheetFixture {
  _comment?: string
  children: DrawableFixture[]
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

// ---------------------------------------------------------------------------
// Song comparison (Stufe 2)
// ---------------------------------------------------------------------------

/**
 * Compares a Song output against a fixture.
 *
 * Checked per entity: all serialized fixture fields.
 * Skipped: fields not present in the fixture plus internal runtime-only fields
 * that are never serialized into fixtures.
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
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key as keyof EntityFixture]
    if (!compareFixtureValue(actualValue, expectedValue)) {
      return false
    }
  }

  return true
}

function compareFixtureValue(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false
    return expected.every((item, index) => compareFixtureValue(actual[index], item))
  }

  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object') return false
    for (const [key, value] of Object.entries(expected)) {
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
 * Skipped: confKey, draginfo, internal references.
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

    // fill (exact)
    if (fc.fill !== undefined && ac.fill !== fc.fill) {
      fail(mismatches, `${cPath}.fill`, fc.fill, ac.fill)
    }

    // style (exact)
    if (fc.style !== undefined && ac.style !== fc.style) {
      fail(mismatches, `${cPath}.style`, fc.style, ac.style)
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
// Vitest custom matcher (optional convenience)
// ---------------------------------------------------------------------------

/**
 * Formats a MatchResult into a readable error message for test output.
 */
export function formatMismatches(result: MatchResult): string {
  if (result.passed) return 'OK'
  return result.mismatches
    .map((m) => `  ${m.path}:\n    expected: ${JSON.stringify(m.expected)}\n    actual:   ${JSON.stringify(m.actual)}`)
    .join('\n')
}
