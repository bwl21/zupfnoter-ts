/**
 * HarpnotesLayout unit tests (Phase 3.3).
 *
 * Tests use Vitest snapshots for regression detection.
 * Each test runs the full pipeline: ABC → Song → Sheet.
 */

import { describe, it, expect } from 'vitest'
import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import { HarpnotesLayout } from '../../HarpnotesLayout.js'
import { defaultTestConfig } from '../defaultConfig.js'
import { loadFixture, transformFixtureToSheet } from '../fixtureLoader.js'
import type { Ellipse, Glyph, FlowLine, Path, Annotation } from '@zupfnoter/types'
import type { ZupfnoterConfig } from '@zupfnoter/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pipeline(abcText: string) {
  return pipelineWithConfig(abcText, defaultTestConfig)
}

function pipelineWithConfig(abcText: string, config: ZupfnoterConfig) {
  const parser = new AbcParser()
  const model = parser.parse(abcText)
  const song = new AbcToSong().transform(model, config)
  const sheet = new HarpnotesLayout(config).layout(song, 0, 'A4')
  return { song, sheet }
}

function clonedDefaultConfig(): ZupfnoterConfig {
  return {
    ...defaultTestConfig,
    extract: Object.fromEntries(
      Object.entries(defaultTestConfig.extract).map(([key, value]) => [key, { ...value }]),
    ),
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ABC_SINGLE_NOTE = `X:1
T:Single Note Test
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] C |]`

const ABC_TWO_VOICES = `X:1
T:Two Voices Test
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1) (V2)
V:V1 clef=treble-8
V:V2 clef=treble-8
[V:V1] C D E F |]
[V:V2] G, A, B, C |]`

const ABC_PAUSE = `X:1
T:Pause Test
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] C z E F |]`

const ABC_TRAILING_PAUSE = `X:1
T:Trailing Pause Test
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] C z |]`

const ABC_REPEAT = `X:1
T:Repeat Test
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] |: C D E F :|`

const ABC_BARNUMBERS = `X:1
T:Barnumber Test
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] C D E F | G A B c |]`

const ABC_LEGEND = `X:1
T:Legend Test
C:Test Composer
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] C |]`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HarpnotesLayout', () => {
  describe('layout() returns a Sheet', () => {
    it('returns a Sheet with children and activeVoices', () => {
      const { sheet } = pipeline(ABC_SINGLE_NOTE)
      expect(sheet).toHaveProperty('children')
      expect(sheet).toHaveProperty('activeVoices')
      expect(Array.isArray(sheet.children)).toBe(true)
      expect(Array.isArray(sheet.activeVoices)).toBe(true)
    })
  })

  describe('single_note', () => {
    it('produces at least one Ellipse', () => {
      const { sheet } = pipeline(ABC_SINGLE_NOTE)
      const ellipses = sheet.children.filter((c): c is Ellipse => c.type === 'Ellipse')
      expect(ellipses.length).toBeGreaterThanOrEqual(1)
    })

    it('Ellipse has correct X position for middle C (abc2svg pitch 48)', () => {
      const { sheet } = pipeline(ABC_SINGLE_NOTE)
      const ellipses = sheet.children.filter((c): c is Ellipse => c.type === 'Ellipse')
      const layout = defaultTestConfig.layout
      // abc2svg middle C = pitch 48, PITCH_OFFSET=-43
      // x = (48 + (-43)) * 11.5 + 2.8 = 5 * 11.5 + 2.8 = 60.3
      const expectedX = (48 + layout.PITCH_OFFSET) * layout.X_SPACING + layout.X_OFFSET
      expect(ellipses[0]!.center[0]).toBeCloseTo(expectedX, 1)
    })

    it('Ellipse Y position is above startpos', () => {
      const { sheet } = pipeline(ABC_SINGLE_NOTE)
      const ellipses = sheet.children.filter((c): c is Ellipse => c.type === 'Ellipse')
      expect(ellipses[0]!.center[1]).toBeGreaterThanOrEqual(15) // startpos = 15
    })

    it('matches snapshot', () => {
      const { sheet } = pipeline(ABC_SINGLE_NOTE)
      const ellipses = sheet.children.filter((c): c is Ellipse => c.type === 'Ellipse')
      expect(ellipses).toMatchSnapshot()
    })
  })

  describe('two_voices', () => {
    it('produces Ellipses for both voices', () => {
      const { sheet } = pipeline(ABC_TWO_VOICES)
      const ellipses = sheet.children.filter((c): c is Ellipse => c.type === 'Ellipse')
      // 4 notes in V1 + 4 notes in V2 = 8 ellipses
      expect(ellipses.length).toBeGreaterThanOrEqual(8)
    })

    it('produces FlowLines for voice 1 (flowlines: [1,3])', () => {
      const { sheet } = pipeline(ABC_TWO_VOICES)
      const flowlines = sheet.children.filter((c): c is FlowLine => c.type === 'FlowLine')
      expect(flowlines.length).toBeGreaterThan(0)
    })

    it('activeVoices contains voice numbers', () => {
      const { sheet } = pipeline(ABC_TWO_VOICES)
      expect(sheet.activeVoices).toContain(1)
      expect(sheet.activeVoices).toContain(2)
    })
  })

  describe('pause', () => {
    it('produces a Glyph for the pause', () => {
      const { sheet } = pipeline(ABC_PAUSE)
      const glyphs = sheet.children.filter((c): c is Glyph => c.type === 'Glyph')
      expect(glyphs.length).toBeGreaterThanOrEqual(1)
    })

    it('pause Glyph has a valid glyphName', () => {
      const { sheet } = pipeline(ABC_PAUSE)
      const glyphs = sheet.children.filter((c): c is Glyph => c.type === 'Glyph')
      expect(glyphs[0]!.glyphName).toMatch(/^rest_/)
    })

    it('pause X position is not hardcoded to pitch=60 (restposition=center)', () => {
      const { sheet } = pipeline(ABC_PAUSE)
      const glyphs = sheet.children.filter((c): c is Glyph => c.type === 'Glyph')
      const layout = defaultTestConfig.layout
      // abc2svg: C=48, E=52. restposition=center → pitch = (48+52)/2 = 50
      // hardcoded pitch=60 (old default) would give different X
      const hardcodedX = (60 + layout.PITCH_OFFSET) * layout.X_SPACING + layout.X_OFFSET
      const centeredX  = (50 + layout.PITCH_OFFSET) * layout.X_SPACING + layout.X_OFFSET
      expect(glyphs[0]!.center[0]).toBeCloseTo(centeredX, 0)
      expect(glyphs[0]!.center[0]).not.toBeCloseTo(hardcodedX, 0)
    })

    it('hides rests without flowlines unless nonflowrest is enabled', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.voices = [1]
      extract0.flowlines = []
      extract0.subflowlines = []
      extract0.jumplines = []
      extract0.layoutlines = [1]
      extract0.synchlines = []
      extract0.nonflowrest = false

      const hiddenSheet = pipelineWithConfig(ABC_TRAILING_PAUSE, config).sheet
      const hiddenRests = hiddenSheet.children.filter((c): c is Glyph => c.type === 'Glyph')
      expect(hiddenRests[0]?.visible).toBe(false)

      extract0.nonflowrest = true
      const visibleSheet = pipelineWithConfig(ABC_TRAILING_PAUSE, config).sheet
      const visibleRests = visibleSheet.children.filter((c): c is Glyph => c.type === 'Glyph')
      expect(visibleRests[0]?.visible).toBe(true)
    })
  })

  describe('repeat / goto', () => {
    it('produces Path elements for jumplines', () => {
      const { sheet } = pipeline(ABC_REPEAT)
      const paths = sheet.children.filter((c): c is Path => c.type === 'Path')
      // Sheetmarks also produce paths, so just check there are some
      expect(paths.length).toBeGreaterThan(0)
    })
  })

  describe('barnumbers', () => {
    it('produces Annotation elements for bar numbers', () => {
      const fixture = loadFixture('3015_reference_sheet')
      const sheet = transformFixtureToSheet(fixture, 0)
      const annotations = sheet.children.filter(
        (c): c is Annotation => c.type === 'Annotation' && /^\d+$/.test(c.text ?? ''),
      )
      expect(annotations.length).toBeGreaterThanOrEqual(3)
    })

    it('renders configured countnotes for each counted playable', () => {
      const fixture = loadFixture('3015_reference_sheet')
      const sheet = transformFixtureToSheet(fixture, 0)
      const countnotes = sheet.children.filter(
        (c): c is Annotation => c.type === 'Annotation' && c.style === 'smaller' && c.center[0] < 170 && c.center[1] < 200,
      )
      expect(countnotes.map((entry) => entry.text)).toEqual([
        '1-2-3-4',
        '1-2',
        '3',
        '4',
        'u',
        'e',
        '1-2-3',
        '4',
        '1',
        '2-3-4',
        '1',
        '2',
        '3',
      ])
    })
  })

  describe('legend', () => {
    it('produces an Annotation with title and composer', () => {
      const { sheet } = pipeline(ABC_LEGEND)
      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')
      const legend = annotations.find(a => a.text.includes('Legend Test'))
      expect(legend).toBeDefined()
      expect(annotations.some(a => a.text.includes('Test Composer'))).toBe(true)
    })
  })

  describe('sheetmarks', () => {
    it('renders configured string names and cutmarks from the reference sheet fixture', () => {
      const fixture = loadFixture('3015_reference_sheet')
      const sheet = transformFixtureToSheet(fixture, 0)
      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')
      expect(annotations.some((a) => a.text === 'G' && a.center[1] === 5)).toBe(true)
      expect(annotations.some((a) => a.text === 'x' && a.center[1] === 4)).toBe(true)
      expect(annotations.some((a) => a.text === 'x' && a.center[1] === 290)).toBe(true)
    })

    it('renders grouped lyric blocks from extract.lyrics config', () => {
      const fixture = loadFixture('3015_reference_sheet')
      const sheet = transformFixtureToSheet(fixture, 0)
      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')
      expect(annotations.some((a) => a.center[0] === 50 && a.center[1] === 30 && a.text.includes('Notes'))).toBe(true)
      expect(annotations.some((a) => a.center[0] === 110 && a.center[1] === 225 && a.text.includes('Variant ending'))).toBe(true)
    })

    it('renders repeat signs and overridden notebound annotations from the reference sheet fixture', () => {
      const fixture = loadFixture('3015_reference_sheet')
      const sheet = transformFixtureToSheet(fixture, 0)
      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')
      expect(annotations.some((a) => a.text === '|:' && a.style === 'bold')).toBe(true)
      expect(annotations.some((a) => a.text === ':|' && a.style === 'bold')).toBe(true)
      expect(annotations.some((a) => a.text === '(26) Mehrklang mit \nSynchronisationslinie')).toBe(true)
      expect(annotations.some((a) => a.text === '(27) Abschnittsname')).toBe(true)
    })

    it('uses the legacy repeat-sign side selection based on neighbouring pitches', () => {
      const config: ZupfnoterConfig = {
        ...defaultTestConfig,
        extract: {
          ...defaultTestConfig.extract,
          '0': {
            ...defaultTestConfig.extract['0'],
          },
        },
      }
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')

      extract0.repeatsigns = {
        voices: [1],
        left: { pos: [-7, -2], text: '|:', style: 'bold' },
        right: { pos: [5, -2], text: ':|', style: 'bold' },
      }

      const { sheet } = pipelineWithConfig(
        `X:1
T:Repeat Attach Side
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] |: G E D C :|`,
        config,
      )

      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')
      const beginRepeat = annotations.find((a) => a.text === ':|')
      const endRepeat = annotations.find((a) => a.text === '|:')

      expect(beginRepeat).toBeDefined()
      expect(endRepeat).toBeDefined()
      expect(beginRepeat?.style).toBe('bold')
      expect(endRepeat?.style).toBe('bold')
      expect((beginRepeat?.center[0] ?? 0) > (endRepeat?.center[0] ?? 0)).toBe(true)
    })

    it('renders the split legend positions from the reference sheet fixture', () => {
      const fixture = loadFixture('3015_reference_sheet')
      const sheet = transformFixtureToSheet(fixture, 0)
      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')
      expect(annotations.some((a) => a.center[0] === 325 && a.center[1] === 8 && a.text === 'Zupfnoter Reference Sheet')).toBe(true)
      expect(annotations.some((a) => a.center[0] === 344 && a.center[1] === 28 && a.text.includes('alle Stimmen'))).toBe(true)
    })
  })

  describe('full sheet snapshot', () => {
    it('single_note sheet matches snapshot', () => {
      const { sheet } = pipeline(ABC_SINGLE_NOTE)
      // Only snapshot the types and counts, not exact positions (floating point)
      const summary = sheet.children.reduce<Record<string, number>>((acc, c) => {
        acc[c.type] = (acc[c.type] ?? 0) + 1
        return acc
      }, {})
      expect(summary).toMatchSnapshot()
    })

    it('two_voices sheet matches snapshot', () => {
      const { sheet } = pipeline(ABC_TWO_VOICES)
      const summary = sheet.children.reduce<Record<string, number>>((acc, c) => {
        acc[c.type] = (acc[c.type] ?? 0) + 1
        return acc
      }, {})
      expect(summary).toMatchSnapshot()
    })
  })
})
