/**
 * HarpnotesLayout unit tests (Phase 3.3).
 *
 * Tests use Vitest snapshots for regression detection.
 * Each test runs the full pipeline: ABC → Song → Sheet.
 */

import { describe, it, expect } from 'vitest'
import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import { extractSongConfig, mergeSongConfig } from '../../extractSongConfig.js'
import { HarpnotesLayout } from '../../HarpnotesLayout.js'
import type { AnnotationTextMetrics } from '../../TextMetrics.js'
import { defaultTestConfig } from '../defaultConfig.js'
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

function pipelineWithLayout(abcText: string, layout: HarpnotesLayout) {
  const parser = new AbcParser()
  const model = parser.parse(abcText)
  const song = new AbcToSong().transform(model, defaultTestConfig)
  const sheet = layout.layout(song, 0, 'A4')
  return { song, sheet }
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

const ABC_ANNOTATED_TRAILING_RESTS = `X:1
T:Annotated Trailing Rests Test
M:4/4
L:1/8
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] "^#tail" z3 z |]`

const ABC_NOTEBOUND_ANNOTATION = `X:1
T:Notebound Annotation Test
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] "^#override target" C |]`

const ABC_SYNCHPOINT_TRIAD = `X:1
T:SynchPoint Triad Test
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] [ECG] |]`

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

const ABC_DOTTED_SYNCHPOINT_BARNUMBER = `X:1
T:Dotted SynchPoint Barnumber Test
M:3/4
L:1/8
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] C3 D3 | [G,B]3 C3 |]`

const ABC_COUNTNOTES = `X:1
T:Countnote Test
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] C D E F |]`

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

const ABC_DECORATIONS = `X:1
T:Decoration Test
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] !fermata!C D !f!E !p!F |]`

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

    it('uses beam duration styles when layout.beams is enabled', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.layout = {
        ...(extract0.layout ?? {}),
        beams: true,
      }

      const { sheet } = pipelineWithConfig(ABC_SINGLE_NOTE, config)
      const ellipses = sheet.children.filter((c): c is Ellipse => c.type === 'Ellipse')

      expect(ellipses[0]?.size[0]).toBeCloseTo(config.layout.ELLIPSE_SIZE[0], 1)
      expect(ellipses[0]?.size[1]).toBeCloseTo(config.layout.ELLIPSE_SIZE[1], 1)
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

  describe('synchpoint', () => {
    it('anchors the dashed line at the leftmost and rightmost note like legacy', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      expect(extract0).toBeDefined()
      if (!extract0) return
      extract0.voices = [1]
      extract0.flowlines = []
      extract0.subflowlines = []
      extract0.jumplines = []
      extract0.layoutlines = []
      extract0.synchlines = []

      const { sheet } = pipelineWithConfig(ABC_SYNCHPOINT_TRIAD, config)
      const ellipses = sheet.children.filter((child): child is Ellipse => child.type === 'Ellipse')
      const synchLine = sheet.children.find(
        (child): child is FlowLine => child.type === 'FlowLine' && child.style === 'dashed',
      )

      expect(ellipses.length).toBe(3)
      expect(synchLine).toBeDefined()
      const xs = ellipses.map((ellipse) => ellipse.center[0]).sort((left, right) => left - right)
      expect(synchLine?.from[0]).toBeCloseTo(xs[0] ?? 0)
      expect(synchLine?.to[0]).toBeCloseTo(xs[2] ?? 0)
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

    it('anchors a flowline after a chord at the legacy proxy note', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.voices = [1]
      extract0.flowlines = [1]
      extract0.subflowlines = []
      extract0.synchlines = []
      extract0.layoutlines = []

      const { song, sheet } = pipelineWithConfig(
        `X:1
T:Flowline SynchPoint Proxy Test
M:4/4
L:1/4
K:C
%%score (V1)
V:V1
[V:V1] [EG] A |]`,
        config,
      )
      const synchPoint = song.voices[0]?.entities.find((entity) => entity.type === 'SynchPoint')
      if (!synchPoint || synchPoint.type !== 'SynchPoint') throw new Error('Expected a SynchPoint')
      const proxyNote = synchPoint.notes[synchPoint.notes.length - 1]
      const nextNote = song.voices[0]?.entities.find((entity) => entity.type === 'Note')
      if (!proxyNote || !nextNote || nextNote.type !== 'Note') throw new Error('Expected chord and following note')

      const flowline = sheet.children.find((child): child is FlowLine => (
        child.type === 'FlowLine' && child.style === 'solid' && child.znId === nextNote.znId
      ))
      if (!flowline) throw new Error('Expected solid flowline after SynchPoint')

      const expectedProxyX = (proxyNote.pitch + config.layout.PITCH_OFFSET) * config.layout.X_SPACING + config.layout.X_OFFSET
      expect(flowline.from[0]).toBe(expectedProxyX)
    })

    it('keeps the solid flowline after an annotated longer rest', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.voices = [1]
      extract0.flowlines = [1]
      extract0.subflowlines = []
      extract0.jumplines = []
      extract0.layoutlines = []
      extract0.synchlines = []
      config.annotations = {
        ...(config.annotations ?? {}),
        tail: {
          text: 'tail',
          style: 'small',
        },
      }

      const { sheet } = pipelineWithConfig(ABC_ANNOTATED_TRAILING_RESTS, config)
      const flowlines = sheet.children.filter((child): child is FlowLine => child.type === 'FlowLine')

      expect(flowlines).toHaveLength(1)
      expect(flowlines[0]?.style).toBe('solid')
    })

    it('orders part annotations before regular note-bound annotations', () => {
      const config = clonedDefaultConfig()
      config.annotations = {
        ...(config.annotations ?? {}),
        note: {
          text: 'note',
          style: 'small',
        },
      }

      const { sheet } = pipelineWithConfig(
        `X:1
T:Part Ordering Test
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] "^#note" C [P:Rests] z |]`,
        config,
      )
      const annotations = sheet.children.filter(
        (child): child is Annotation => child.type === 'Annotation' && (child.text === 'Rests' || child.text === 'note'),
      )

      expect(annotations.map((annotation) => annotation.text)).toEqual(['Rests', 'note'])
    })

  })

  describe('decorations', () => {
    it('does not synthesize a barover for fermata decorations', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.voices = [1]
      extract0.flowlines = []
      extract0.subflowlines = []
      extract0.jumplines = []
      extract0.layoutlines = []
      extract0.synchlines = []

      const { sheet } = pipelineWithConfig(
        `X:1
T:Fermata Without Barover Test
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] !fermata!C |]`,
        config,
      )
      const blackEllipses = sheet.children.filter(
        (child): child is Ellipse => child.type === 'Ellipse' && child.color === 'black',
      )
      const fermatas = sheet.children.filter(
        (child): child is Glyph => child.type === 'Glyph' && child.glyphName === 'fermata',
      )

      expect(blackEllipses).toHaveLength(1)
      expect(fermatas).toHaveLength(1)
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
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.voices = [1]
      extract0.flowlines = []
      extract0.subflowlines = []
      extract0.jumplines = []
      extract0.layoutlines = []
      extract0.synchlines = []
      extract0.barnumbers = {
        voices: [1],
        autopos: false,
        pos: [0, 0],
        style: 'barnumber_probe',
      }

      const { sheet } = pipelineWithConfig(ABC_BARNUMBERS, config)
      const annotations = sheet.children.filter(
        (c): c is Annotation => c.type === 'Annotation' && c.style === 'barnumber_probe',
      )
      expect(annotations.length).toBeGreaterThanOrEqual(2)
      expect(annotations.every((entry) => /^\d+$/.test(entry.text))).toBe(true)
    })

    it('adds dotted width for SynchPoint barnumber autopositioning', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.voices = [1]
      extract0.flowlines = []
      extract0.subflowlines = []
      extract0.jumplines = []
      extract0.layoutlines = []
      extract0.synchlines = []
      extract0.barnumbers = {
        voices: [1],
        autopos: true,
        style: 'barnumber_probe',
      }

      const { song, sheet } = pipelineWithConfig(ABC_DOTTED_SYNCHPOINT_BARNUMBER, config)
      const synchPoint = song.voices[0]?.entities.find(
        (entity) => entity.type === 'SynchPoint' && entity.measureStart,
      )
      expect(synchPoint?.type).toBe('SynchPoint')
      if (!synchPoint || synchPoint.type !== 'SynchPoint') {
        throw new Error('Expected dotted measure-start SynchPoint')
      }

      const proxy = synchPoint.notes[synchPoint.notes.length - 1]
      expect(proxy).toBeDefined()
      if (!proxy) throw new Error('Expected proxy note for SynchPoint')

      const proxyEllipse = sheet.children
        .filter((child): child is Ellipse => child.type === 'Ellipse')
        .filter((child) => (
          child.origin?.time === proxy.time
          && child.origin?.pitch === proxy.pitch
          && child.size[1] > 0.2
        ))[0]
      expect(proxyEllipse).toBeDefined()
      if (!proxyEllipse) throw new Error('Expected proxy ellipse for SynchPoint')

      const barnumber = sheet.children.find(
        (child): child is Annotation => (
          child.type === 'Annotation'
          && child.style === 'barnumber_probe'
          && child.text === '2'
        ),
      )
      expect(barnumber).toBeDefined()
      if (!barnumber) throw new Error('Expected barnumber annotation for measure 2')

      expect(barnumber.center[0]).toBeCloseTo(proxyEllipse.center[0] + proxyEllipse.size[0] + 2, 5)
    })

    it('renders configured countnotes for each counted playable', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.voices = [1]
      extract0.flowlines = []
      extract0.subflowlines = []
      extract0.jumplines = []
      extract0.layoutlines = []
      extract0.synchlines = []
      extract0.countnotes = {
        voices: [1],
        autopos: false,
        pos: [2, 3],
        style: 'countnote_probe',
      }

      const { sheet } = pipelineWithConfig(ABC_COUNTNOTES, config)
      const notes = sheet.children.filter((c): c is Ellipse => (
        c.type === 'Ellipse' && c.origin !== undefined
      ))
      const countnotes = sheet.children.filter(
        (c): c is Annotation => c.type === 'Annotation' && c.style === 'countnote_probe',
      )

      expect(countnotes.map((entry) => entry.text)).toEqual(['1', '2', '3', '4'])
      expect(countnotes.length).toBe(notes.length)
      for (const [index, countnote] of countnotes.entries()) {
        const note = notes[index]
        expect(note).toBeDefined()
        expect(countnote.center[0]).toBeCloseTo((note?.center[0] ?? 0) + 2)
        expect(countnote.center[1]).toBeCloseTo((note?.center[1] ?? 0) + 3)
      }
    })

    it('adds dotted width for SynchPoint countnote autopositioning', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.voices = [1]
      extract0.flowlines = []
      extract0.subflowlines = []
      extract0.jumplines = []
      extract0.layoutlines = []
      extract0.synchlines = []
      extract0.countnotes = {
        voices: [1],
        autopos: true,
        style: 'countnote_probe',
      }

      const { song, sheet } = pipelineWithConfig(ABC_DOTTED_SYNCHPOINT_BARNUMBER, config)
      const synchPoint = song.voices[0]?.entities.find(
        (entity) => entity.type === 'SynchPoint' && entity.measureStart,
      )
      expect(synchPoint?.type).toBe('SynchPoint')
      if (!synchPoint || synchPoint.type !== 'SynchPoint') {
        throw new Error('Expected dotted measure-start SynchPoint')
      }

      const proxy = synchPoint.notes[synchPoint.notes.length - 1]
      expect(proxy).toBeDefined()
      if (!proxy) throw new Error('Expected proxy note for SynchPoint')

      const proxyEllipse = sheet.children
        .filter((child): child is Ellipse => child.type === 'Ellipse')
        .filter((child) => (
          child.origin?.time === proxy.time
          && child.origin?.pitch === proxy.pitch
          && child.size[1] > 0.2
        ))[0]
      expect(proxyEllipse).toBeDefined()
      if (!proxyEllipse) throw new Error('Expected proxy ellipse for SynchPoint')

      const countnote = sheet.children
        .filter((child): child is Annotation => child.type === 'Annotation' && child.style === 'countnote_probe')
        .sort((a, b) => (
          Math.abs(a.center[1] - proxyEllipse.center[1]) - Math.abs(b.center[1] - proxyEllipse.center[1])
        ))[0]
      expect(countnote).toBeDefined()
      if (!countnote) throw new Error('Expected countnote annotation for measure-start SynchPoint')

      expect(countnote.center[0]).toBeCloseTo(proxyEllipse.center[0] + proxyEllipse.size[0] + 2, 5)
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

    it('uses injected annotation text metrics for annotation backgrounds', () => {
      const metrics: AnnotationTextMetrics = {
        measureAnnotation: () => [10, 8],
      }

      const { sheet } = pipelineWithLayout(
        ABC_NOTEBOUND_ANNOTATION,
        new HarpnotesLayout(defaultTestConfig, { annotationTextMetrics: metrics }),
      )

      const background = sheet.children.find(
        (child): child is Ellipse => child.type === 'Ellipse' && child.color === 'white',
      )

      expect(background).toBeDefined()
      expect(background?.size[0]).toBeCloseTo(5.5)
      expect(background?.size[1]).toBeCloseTo(4.5)
    })

    it('renders the legacy sheet footer annotations', () => {
      const { song, sheet } = pipelineWithLayout(
        ABC_SINGLE_NOTE,
        new HarpnotesLayout(defaultTestConfig, { createdAt: new Date(2026, 6, 17, 11, 22, 33) }),
      )
      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')

      expect(
        annotations.some((a) => a.center[0] === 150 && a.center[1] === 289 && a.text === ' - created 2026-07-17 11:22:33 by Zupfnoter-TS'),
      ).toBe(true)
      expect(
        annotations.some((a) => a.center[0] === 325 && a.center[1] === 289 && a.text === 'Zupfnoter: https://www.zupfnoter.de'),
      ).toBe(true)
      expect(
        annotations.some((a) => a.center[0] === 380 && a.center[1] === 289 && a.text === song.metaData.checksum),
      ).toBe(true)
    })

    it('resolves sheet annotation placeholders and lets notes.T06_legend replace the secondary legend', () => {
      const config = clonedDefaultConfig()
      config.produce = [0]
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.title = 'Probe Extract'
      extract0.filenamepart = '-P'
      extract0.notes = {
        T06_legend: {
          pos: [90, 40],
          text: '{{extract_title}}\n{{composer}}\n{{number}}\n{{printed_extracts}}\n{{current_year}}',
          style: 'placeholder_probe',
        },
      }

      const { sheet } = pipelineWithConfig(ABC_LEGEND, config)
      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')
      const placeholderLegend = annotations.find((a) => a.style === 'placeholder_probe')

      expect(placeholderLegend?.center).toEqual([90, 40])
      expect(placeholderLegend?.text).toBe(`Probe Extract\nTest Composer\n1\n-P\n${new Date().getFullYear()}`)
      expect(annotations.some((a) => a.center[0] === 320 && a.center[1] === 27)).toBe(false)
    })

    it('keeps explicitly configured sheet annotations with empty text', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.notes = {
        T02_empty: {
          pos: [325, 280],
          text: '',
          style: 'small',
        },
      }

      const { sheet } = pipelineWithConfig(ABC_SINGLE_NOTE, config)
      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')
      const emptyAnnotation = annotations.find((a) => a.center[0] === 325 && a.center[1] === 280)

      expect(emptyAnnotation?.text).toBe('')
      expect(emptyAnnotation?.style).toBe('small')
    })
  })

  describe('decorations', () => {
    it('renders glyph and annotation decorations with annotation backgrounds', () => {
      const { sheet } = pipeline(ABC_DECORATIONS)
      const glyphs = sheet.children.filter((c): c is Glyph => c.type === 'Glyph')
      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')
      const backgrounds = sheet.children.filter(
        (c): c is Ellipse => c.type === 'Ellipse' && c.color === 'white',
      )

      expect(glyphs.some((glyph) => glyph.glyphName === 'fermata')).toBe(true)
      expect(annotations.some((annotation) => annotation.text === 'f' && annotation.style === 'small_italic')).toBe(true)
      expect(annotations.some((annotation) => annotation.text === 'p' && annotation.style === 'small_italic')).toBe(true)
      expect(backgrounds.length).toBe(2)
    })

    it('anchors SynchPoint decorations to the legacy proxy note', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.voices = [1]
      extract0.flowlines = []
      extract0.subflowlines = []
      extract0.jumplines = []
      extract0.layoutlines = []
      extract0.synchlines = []

      const { song, sheet } = pipelineWithConfig(
        `X:1
T:SynchPoint Decoration Anchor Test
M:4/4
L:1/4
Q:1/4=120
K:C
%%score (V1)
V:V1 clef=treble-8
[V:V1] !f![CE] !fermata![DF] |]`,
        config,
      )
      const synchPoints = song.voices[0]?.entities.filter(
        (entity) => entity.type === 'SynchPoint',
      )
      const fProxy = synchPoints?.[0]?.type === 'SynchPoint'
        ? synchPoints[0].notes[synchPoints[0].notes.length - 1]
        : undefined
      const fermataProxy = synchPoints?.[1]?.type === 'SynchPoint'
        ? synchPoints[1].notes[synchPoints[1].notes.length - 1]
        : undefined

      const decorationAnnotation = sheet.children.find(
        (child): child is Annotation => child.type === 'Annotation' && child.text === 'f',
      )
      const fermata = sheet.children.find(
        (child): child is Glyph => child.type === 'Glyph' && child.glyphName === 'fermata',
      )
      const fProxyEllipse = sheet.children.find(
        (child): child is Ellipse => (
          child.type === 'Ellipse'
          && child.origin?.time === fProxy?.time
          && child.origin?.pitch === fProxy?.pitch
        ),
      )
      const fermataProxyEllipse = sheet.children.find(
        (child): child is Ellipse => (
          child.type === 'Ellipse'
          && child.origin?.time === fermataProxy?.time
          && child.origin?.pitch === fermataProxy?.pitch
        ),
      )

      expect(decorationAnnotation).toBeDefined()
      expect(fermata).toBeDefined()
      expect(fProxyEllipse).toBeDefined()
      expect(fermataProxyEllipse).toBeDefined()
      if (!decorationAnnotation || !fermata || !fProxyEllipse || !fermataProxyEllipse) {
        throw new Error('Expected SynchPoint decorations to be rendered')
      }

      expect(decorationAnnotation.center[0]).toBeCloseTo(fProxyEllipse.center[0] + 3, 5)
      expect(fermata.center[0]).toBeCloseTo(fermataProxyEllipse.center[0], 5)
    })
  })

  describe('sheetmarks', () => {
    it('renders configured string names and cutmarks', () => {
      const config = clonedDefaultConfig()
      config.printer = { ...config.printer, a4_pages: [0, 1] }
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.stringnames = {
        vpos: [6],
        text: 'string_a string_b',
        style: 'stringname_probe',
        marks: {
          hpos: [48],
          vpos: [9],
        },
      }

      const { sheet } = pipelineWithConfig(ABC_SINGLE_NOTE, config)
      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')
      const stringNames = annotations.filter((a) => a.style === 'stringname_probe')
      const cutmarks = annotations.filter((a) => a.text === 'x' && a.style === 'small')
      const sheetmarks = sheet.children.filter((c): c is Path => c.type === 'Path' && c.fill)

      expect(stringNames.length).toBe(37)
      expect(new Set(stringNames.map((entry) => entry.text))).toEqual(new Set(['string_a', 'string_b']))
      expect(sheetmarks.length).toBe(1)
      const sheetmark = sheetmarks[0]
      if (sheetmark === undefined) throw new Error('Expected one sheetmark')
      const start = sheetmark.path[0]
      if (start === undefined) throw new Error('Expected sheetmark start point')
      expect(sheetmark.pathData).toBe(`M${start[0]} ${start[1]}l0.5 -1l0.5 1l0 5l-0.5 1l-0.5 -1l0 -5`)
      expect(cutmarks.some((entry) => entry.center[1] === 4)).toBe(true)
      expect(cutmarks.some((entry) => entry.center[1] === 290)).toBe(true)
    })

    it('uses legacy printer.a4_pages from embedded song configuration', () => {
      const abcText = `${ABC_SINGLE_NOTE}

%%%%zupfnoter.config
{
  "extract": {
    "0": {
      "printer": {
        "a4_pages": [1, 2]
      }
    }
  }
}`
      const config = mergeSongConfig(defaultTestConfig, extractSongConfig(abcText))
      const { sheet } = pipelineWithConfig(abcText, config)
      const cutmarks = sheet.children.filter((c): c is Annotation => (
        c.type === 'Annotation' && c.text === 'x' && c.style === 'small'
      ))

      expect(cutmarks.map((entry) => entry.center[0])).toEqual([143.675, 143.675, 281.675, 281.675])
      expect(cutmarks.some((entry) => entry.center[1] === 4)).toBe(true)
      expect(cutmarks.some((entry) => entry.center[1] === 290)).toBe(true)
    })

    it('renders configured sheet annotations', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.notes = {
        first: {
          pos: [50, 30],
          text: 'sheet_annotation_probe_a',
          style: 'sheet_annotation_probe',
        },
        second: {
          pos: [110, 225],
          text: 'sheet_annotation_probe_b',
          style: 'sheet_annotation_probe',
        },
      }

      const { sheet } = pipelineWithConfig(ABC_SINGLE_NOTE, config)
      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')
      const configured = annotations.filter((a) => a.style === 'sheet_annotation_probe')

      expect(configured.map((entry) => entry.center)).toEqual([[50, 30], [110, 225]])
      expect(configured.map((entry) => entry.text)).toEqual(['sheet_annotation_probe_a', 'sheet_annotation_probe_b'])
    })

    it('renders configured repeat signs', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.repeatsigns = {
        voices: [1],
        left: { pos: [-7, -2], text: '|:', style: 'repeat_probe' },
        right: { pos: [5, -2], text: ':|', style: 'repeat_probe' },
      }

      const { sheet } = pipelineWithConfig(ABC_REPEAT, config)
      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')
      const repeats = annotations.filter((a) => a.style === 'repeat_probe')
      expect(repeats.map((entry) => entry.text).sort()).toEqual([':|', '|:'])
    })

    it('applies extract.notebound.annotation overrides to note-bound annotations', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.voices = [1]
      extract0.flowlines = []
      extract0.subflowlines = []
      extract0.jumplines = []
      extract0.layoutlines = []
      extract0.synchlines = []
      extract0.notebound = {
        annotation: {
          v_1: {
            0: {
              pos: [11, 13],
              style: 'override_probe',
            },
          },
        },
      }

      const { sheet } = pipelineWithConfig(ABC_NOTEBOUND_ANNOTATION, config)
      const note = sheet.children.find((c): c is Ellipse => c.type === 'Ellipse')
      const annotation = sheet.children.find(
        (c): c is Annotation => c.type === 'Annotation' && c.style === 'override_probe',
      )

      expect(note).toBeDefined()
      expect(annotation?.center[0]).toBeCloseTo((note?.center[0] ?? 0) + 11)
      expect(annotation?.center[1]).toBeCloseTo((note?.center[1] ?? 0) + 13)
    })

    it('uses the legacy repeat-sign side selection based on neighbouring pitches', () => {
      const config = clonedDefaultConfig()
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

    it('renders configured split legend positions', () => {
      const config = clonedDefaultConfig()
      const extract0 = config.extract['0']
      if (!extract0) throw new Error('Missing extract 0 in default test config')
      extract0.title = 'legend_secondary_probe_text'
      extract0.legend = {
        pos: [325, 8],
        spos: [344, 28],
        tstyle: 'legend_title_probe',
        style: 'legend_secondary_probe',
      }

      const { sheet } = pipelineWithConfig(ABC_LEGEND, config)
      const annotations = sheet.children.filter((c): c is Annotation => c.type === 'Annotation')
      const title = annotations.find((a) => a.style === 'legend_title_probe')
      const secondary = annotations.find((a) => a.style === 'legend_secondary_probe')

      expect(title?.center).toEqual([325, 8])
      expect(secondary?.center).toEqual([344, 28])
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
