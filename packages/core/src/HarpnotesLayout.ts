/**
 * HarpnotesLayout – transforms a Song into a Sheet (Drawing model).
 *
 * Port of `Harpnotes::Layout::Default` from `harpnotes.rb` (line 1302).
 * This is Stufe 2 of the Zupfnoter transformation pipeline.
 *
 * Reference:
 *   docs/phase-0/architektur_zupfnoter.md
 *   docs/phase-3/konzept_json_serialisierung.md
 */

import type {
  Song,
  Voice,
  PlayableEntity,
  Note,
  Pause,
  SynchPoint,
  Goto,
  SongMetaData,
  NoteBoundAnnotation,
  NewPart,
} from '@zupfnoter/types'
import { makeJumplinePathData } from './jumplinePath.js'
import type {
  Sheet,
  DrawableElement,
  Ellipse,
  FlowLine,
  Path,
  Annotation,
  Glyph,
  Image,
} from '@zupfnoter/types'
import type {
  ZupfnoterConfig,
  ExtractConfig,
  DurationKey,
  BeamStyle,
  DurationStyle,
  LayoutConfig,
  PrinterConfig,
} from '@zupfnoter/types'
import { buildPrintOptions } from './buildConfstack.js'
import { computeBeatCompression, type BeatCompressionMap } from './BeatPacker.js'
import type { Confstack } from './Confstack.js'
import { requireDefined } from './requireDefined.js'
import { isPracticeQrImageName } from './imageResources.js'
import { getSongVoiceByVoiceNumber } from './voiceIdentity.js'
import {
  createDefaultAnnotationTextMetrics,
  type AnnotationTextMetrics,
  type HarpnotesLayoutOptions,
} from './TextMetrics.js'

// ---------------------------------------------------------------------------
// Coordinate helpers (module-level pure functions)
// ---------------------------------------------------------------------------

/**
 * MIDI pitch → X position in mm.
 * Corresponds to legacy: `(pitch + PITCH_OFFSET) * X_SPACING + X_OFFSET`
 * where PITCH_OFFSET is negative (e.g. -43 for 37-string harp),
 * equivalent to `(pitch - |PITCH_OFFSET|) * X_SPACING + X_OFFSET`.
 *
 * Legacy sheetmarks formula: `(-start_scale + pitch) * x_spacing + x_offset`
 * where `start_scale = -PITCH_OFFSET`, so `(pitch + PITCH_OFFSET) * X_SPACING + X_OFFSET`.
 */
function pitchToX(pitch: number, layout: LayoutConfig): number {
  return (pitch + layout.PITCH_OFFSET) * layout.X_SPACING + layout.X_OFFSET
}

/** Beat → Y position in mm via BeatCompressionMap. Legacy uses Y_SCALE / BEAT_RESOLUTION. */
function beatToY(beat: number, beatMap: BeatCompressionMap, layout: LayoutConfig, startpos: number): number {
  const compressed = beatMap[beat] ?? beat
  return compressed * (layout.Y_SCALE / layout.BEAT_RESOLUTION) + startpos
}

function applyLegacyBeatSpread(beatMap: BeatCompressionMap, layout: LayoutConfig, startpos: number): BeatCompressionMap {
  const maximalBeat = Math.max(0, ...Object.values(beatMap))
  if (maximalBeat === 0) return beatMap

  const baseBeatSpacing = layout.Y_SCALE / layout.BEAT_RESOLUTION
  if (baseBeatSpacing === 0) return beatMap

  const fullBeatSpacing = (layout.DRAWING_AREA_SIZE[1] - startpos) / maximalBeat
  const maxSpreadFactor = layout.packer.pack_max_spreadfactor ?? 1
  const effectiveBeatSpacing = Math.min(fullBeatSpacing, maxSpreadFactor * baseBeatSpacing)
  const factor = effectiveBeatSpacing / baseBeatSpacing

  if (factor === 1) return beatMap

  return Object.fromEntries(
    Object.entries(beatMap).map(([beat, compressed]) => [beat, compressed * factor]),
  ) as BeatCompressionMap
}

function convertBeamStylesToDurationStyles(
  durationToBeams: Record<DurationKey, BeamStyle>,
): Record<DurationKey, DurationStyle> {
  const result = {} as Record<DurationKey, DurationStyle>
  for (const [duration, [sizeFactor, fill, dotted]] of Object.entries(durationToBeams) as Array<[DurationKey, BeamStyle]>) {
    result[duration] = { sizeFactor, fill, dotted }
  }
  return result
}

/** Duration (SHORTEST_NOTE scale) → DurationKey. Duration is already on the correct scale. */
function durationToKey(duration: number): DurationKey {
  const key = `d${duration}` as DurationKey
  const valid: DurationKey[] = ['d96','d64','d48','d32','d24','d16','d12','d8','d6','d4','d3','d2','d1']
  return valid.includes(key) ? key : 'err'
}

function formatCreationTimestamp(value: Date): string {
  const pad = (part: number): string => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
}

/** Variant number → color string */
function variantToColor(variant: 0 | 1 | 2, layout: LayoutConfig): string {
  if (variant === 1) return layout.color.color_variant1
  if (variant === 2) return layout.color.color_variant2
  return layout.color.color_default
}

/** Erzeugt den vollständigen fachlichen Key des aktiven Extrakts. */
function activeExtractConfKey(extractNr: number | string, key: string): string {
  const suffix = key.replace(/^extract\.(?:\d+\.)?/, '')
  return `extract.${extractNr}.${suffix}`
}

function playableCenter(
  playable: PlayableEntity,
  beatMap: BeatCompressionMap,
  layout: LayoutConfig,
  startpos: number,
  context?: { conf: Confstack; voiceNr: number; extractNr: number | string },
): [number, number] {
  const proxy = playableLayoutProxy(playable)
  return [
    playableX(proxy, layout) + configuredNoteShift(proxy, layout, context),
    beatToY(proxy.beat, beatMap, layout, startpos),
  ]
}

function configuredNoteShift(
  playable: PlayableEntity,
  layout: LayoutConfig,
  context: { conf: Confstack; voiceNr: number; extractNr: number | string } | undefined,
): number {
  if (context === undefined || (playable.type !== 'Note' && playable.type !== 'Pause')) return 0
  const configured = context.conf.get(
    `notebound.nconf.v_${context.voiceNr}.t_${playable.time}.n_0.nshift`,
  )
  if (typeof configured !== 'number') return 0
  return playableSize(playable, layout)[0] * 2 * configured
}

function playableX(playable: PlayableEntity, layout: LayoutConfig): number {
  const proxy = playableLayoutProxy(playable)
  const x = pitchToX(proxy.pitch, layout)
  return x + playableHorizontalShift(proxy, layout, x)
}

function playableSize(playable: PlayableEntity, layout: LayoutConfig): [number, number] {
  const proxy = playableLayoutProxy(playable)
  if (proxy.type === 'Pause') {
    const dKey = durationToKey(proxy.duration)
    const restStyle = layout.REST_TO_GLYPH[dKey] ?? layout.REST_TO_GLYPH['err']
    if (!restStyle) return layout.REST_SIZE
    return [layout.REST_SIZE[0] * restStyle.scale[0], layout.REST_SIZE[1] * restStyle.scale[1]]
  }

  const dKey = durationToKey(proxy.duration)
  const style = layout.DURATION_TO_STYLE[dKey] ?? requireDefined(
    layout.DURATION_TO_STYLE['err'],
    'HarpnotesLayout.playableSize(): missing fallback duration style "err"',
  )
  return [layout.ELLIPSE_SIZE[0] * style.sizeFactor, layout.ELLIPSE_SIZE[1] * style.sizeFactor]
}

function playableDotted(playable: PlayableEntity, layout: LayoutConfig): boolean {
  const proxy = playableLayoutProxy(playable)
  const dKey = durationToKey(proxy.duration)
  if (proxy.type === 'Pause') {
    return (layout.REST_TO_GLYPH[dKey] ?? layout.REST_TO_GLYPH['err'])?.dotted ?? false
  }

  const style = layout.DURATION_TO_STYLE[dKey] ?? layout.DURATION_TO_STYLE['err']
  return style?.dotted ?? false
}

function playableLayoutProxy(playable: PlayableEntity): PlayableEntity {
  if (playable.type !== 'SynchPoint') return playable
  return playable.notes[playable.notes.length - 1] ?? playable
}

function playableHorizontalShift(playable: PlayableEntity, layout: LayoutConfig, x: number): number {
  if (!layout.limit_a3) return 0

  const size = playableSize(playable, layout)
  let shift = 0
  if (x < 5) {
    shift += size[0]
  }
  if (x > 415) {
    shift -= size[0]
    if (playableDotted(playable, layout)) {
      shift -= 1.5
    }
  }
  return shift
}

function addPoint(point: [number, number], offset: [number, number]): [number, number] {
  return [point[0] + offset[0], point[1] + offset[1]]
}

function subtractPoint(a: [number, number], b: [number, number]): [number, number] {
  return [a[0] - b[0], a[1] - b[1]]
}

function orientationX(delta: number): -1 | 0 | 1 {
  if (delta < 0) return -1
  if (delta > 0) return 1
  return 0
}

function orientationY(delta: number): -1 | 0 | 1 {
  if (delta < 0) return -1
  if (delta > 0) return 1
  return 0
}

function swapJumplineAnchor(anchor: 'before' | 'after'): 'before' | 'after' {
  return anchor === 'before' ? 'after' : 'before'
}

function comparePosition(a: number, b: number): 1 | 2 | 3 {
  if (a < b) return 1
  if (a > b) return 3
  return 2
}

function computeNotePosition(
  previousX: number,
  currentX: number,
  nextX: number,
): ['l' | 'r', 'l' | 'r'] {
  if (currentX < 10) return ['r', 'r']
  if (currentX > 410) return ['l', 'l']

  const key = `${comparePosition(previousX, currentX)}${comparePosition(nextX, currentX)}`
  const lookup: Record<string, ['l' | 'r', 'l' | 'r']> = {
    '11': ['r', 'r'],
    '12': ['r', 'l'],
    '13': ['r', 'l'],
    '21': ['r', 'r'],
    '22': ['r', 'l'],
    '23': ['l', 'l'],
    '31': ['l', 'r'],
    '32': ['l', 'r'],
    '33': ['l', 'l'],
  }
  return lookup[key] ?? ['r', 'l']
}

function playablesByBeat(voice: Voice): Map<number, PlayableEntity> {
  const result = new Map<number, PlayableEntity>()
  for (const entity of voice.entities) {
    if (entity.type === 'Note' || entity.type === 'Pause' || entity.type === 'SynchPoint') {
      result.set(entity.beat, entity as PlayableEntity)
    }
  }
  return result
}

function addSynchedPlayable(result: Set<PlayableEntity>, playable: PlayableEntity): void {
  result.add(playable)
  if (playable.type === 'SynchPoint') {
    for (const note of playable.notes) {
      result.add(note)
    }
    for (const note of playable.synchedNotes) {
      result.add(note)
    }
  }
}

function computeCountnoteText(playable: PlayableEntity, measureStartBeat: number): string {
  const beatUnit = 48
  const start = (playable.beat - measureStartBeat) / beatUnit
  const length = playable.duration / 16
  const startIndex = Math.floor(start)
  const end = start + length
  const endIndex = Math.ceil(end)

  if (Number.isInteger(start) && Number.isInteger(end) && length >= 1) {
    const beats = Array.from(
      { length: Math.max(1, endIndex - startIndex) },
      (_, index) => String(startIndex + index + 1),
    )
    return beats.join('-')
  }

  const quarter = Math.floor(start)
  const subdivision = Math.round((start - quarter) * 4)
  if (subdivision === 2) return 'u'
  if (subdivision === 3) return 'e'
  return String(quarter + 1)
}

function parseStringNamesText(text: string | undefined): string[] {
  return (text ?? '')
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function makeSheetmarkPath(center: [number, number]): { path: [number, number][]; pathData: string } {
  const [x, y] = center
  const start: [number, number] = [x - 0.5, y - 2.5]
  const segments: [number, number][] = [
    [0.5, -1],
    [0.5, 1],
    [0, 5],
    [-0.5, 1],
    [-0.5, -1],
    [0, -5],
  ]
  const path: [number, number][] = [start]

  for (const [dx, dy] of segments) {
    const previous = path[path.length - 1]
    if (previous === undefined) throw new Error('Sheetmark path has no start point')
    path.push([previous[0] + dx, previous[1] + dy])
  }

  return {
    path,
    pathData: `M${start[0]} ${start[1]}${segments.map(([dx, dy]) => `l${dx} ${dy}`).join('')}`,
  }
}

function rotatePoint(point: [number, number], angle: number): [number, number] {
  const [x, y] = point
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [x * cos - y * sin, x * sin + y * cos]
}

interface AnnotatedBezierOptions {
  cp1: [number, number]
  cp2: [number, number]
  pos: [number, number]
  shape: string[]
  show: boolean
}

const DEFAULT_TUPLET_OPTIONS: AnnotatedBezierOptions = {
  cp1: [5, 2],
  cp2: [5, -2],
  pos: [0, 0],
  shape: ['c'],
  show: true,
}

const DEFAULT_FLOWLINE_OPTIONS: AnnotatedBezierOptions = {
  cp1: [0, 10],
  cp2: [0, -10],
  pos: [0, 0],
  shape: ['c'],
  show: true,
}

function getAnnotatedBezierDefaults(
  conf: Confstack,
  kind: 'flowline' | 'tuplet',
): AnnotatedBezierOptions {
  const fallback = kind === 'flowline' ? DEFAULT_FLOWLINE_OPTIONS : DEFAULT_TUPLET_OPTIONS
  return mergeAnnotatedBezierOptions(fallback, conf.get(`defaults.notebound.${kind}`))
}

function normalizePoint(value: unknown, fallback: [number, number]): [number, number] {
  if (
    Array.isArray(value) &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    return [value[0], value[1]]
  }
  return fallback
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
    return value
  }
  return fallback
}

function mergeAnnotatedBezierOptions(
  defaults: AnnotatedBezierOptions,
  override: unknown,
): AnnotatedBezierOptions {
  if (override === undefined || override === null || typeof override !== 'object') return defaults
  const values = override as Record<string, unknown>
  return {
    cp1: normalizePoint(values['cp1'], defaults.cp1),
    cp2: normalizePoint(values['cp2'], defaults.cp2),
    pos: normalizePoint(values['pos'], defaults.pos),
    shape: normalizeStringArray(values['shape'], defaults.shape),
    show: typeof values['show'] === 'boolean' ? values['show'] : defaults.show,
  }
}

function midpoint(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

function scalePoint(point: [number, number], factor: number): [number, number] {
  return [point[0] * factor, point[1] * factor]
}

function normalizeVector(point: [number, number]): [number, number] {
  const length = Math.hypot(point[0], point[1])
  if (length === 0) return [0, 0]
  return [point[0] / length, point[1] / length]
}

function cubicPoint(
  p1: [number, number],
  cp1: [number, number],
  cp2: [number, number],
  delta: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t
  return [
    p1[0] + 3 * u * u * t * cp1[0] + 3 * u * t * t * cp2[0] + t * t * t * delta[0],
    p1[1] + 3 * u * u * t * cp1[1] + 3 * u * t * t * cp2[1] + t * t * t * delta[1],
  ]
}

function makeAnnotatedBezierPath(
  p1: [number, number],
  p2: [number, number],
  options: AnnotatedBezierOptions,
): { path: [number, number][]; pathData: string; anchor: [number, number]; baseAnchor: [number, number]; cp1: [number, number]; cp2: [number, number] } {
  const delta = subtractPoint(p2, p1)
  const angle = Math.atan2(delta[1], delta[0])
  const cp1 = rotatePoint(rotatePoint(options.cp1, angle), -Math.PI * 0.5)
  const cp2 = addPoint(delta, rotatePoint(rotatePoint(options.cp2, angle), -Math.PI * 0.5))

  const cpa1 = addPoint(p1, cp1)
  const cpa2 = addPoint(p1, cp2)
  const cpm1 = midpoint(p1, cpa1)
  const cpm2 = midpoint(p2, cpa2)
  const cpmm = midpoint(cpa1, cpa2)
  const cpmm1 = midpoint(cpm1, cpmm)
  const cpmm2 = midpoint(cpm2, cpmm)
  const tangent = subtractPoint(cpmm1, cpmm2)
  const normal = tangent[0] === 0 && tangent[1] === 0
    ? [0, 0] as [number, number]
    : normalizeVector([-tangent[1], tangent[0]])
  const baseAnchor = cpa1[0] <= p1[0] && p1[0] <= p2[0]
    ? addPoint(midpoint(cpmm1, cpmm2), addPoint(scalePoint(normal, -2), [-2, -2]))
    : addPoint(midpoint(cpmm1, cpmm2), addPoint(scalePoint(normal, 2), [0, -2]))
  const anchor = addPoint(baseAnchor, options.pos)

  const path: [number, number][] = []
  const pathDataParts: string[] = [`M${p1[0]} ${p1[1]}`]
  if (options.shape.includes('c')) {
    for (let i = 0; i <= 12; i++) {
      path.push(cubicPoint(p1, cp1, cp2, delta, i / 12))
    }
    pathDataParts.push(`c${cp1[0]} ${cp1[1]} ${cp2[0]} ${cp2[1]} ${delta[0]} ${delta[1]}`)
  }
  if (options.shape.includes('l')) {
    path.push(p1, cpa1, cpa2, p2)
    pathDataParts.push(`l${cp1[0]} ${cp1[1]}L${cpa2[0]} ${cpa2[1]}L${p2[0]} ${p2[1]}`)
  }

  return { path, pathData: pathDataParts.join(''), anchor, baseAnchor, cp1, cp2 }
}

function makeLegacySlurPath(p1: [number, number], p2: [number, number]): { path: [number, number][]; pathData: string } {
  const delta = subtractPoint(p2, p1)
  const length = Math.hypot(delta[0], delta[1])
  const angle = Math.atan2(delta[1], delta[0])
  const cpTemplate = rotatePoint([0.3 * length, 0], angle)
  const cp1 = rotatePoint(cpTemplate, -0.4)
  const cp2 = addPoint(delta, rotatePoint([-cpTemplate[0], -cpTemplate[1]], 0.4))
  const points: [number, number][] = []

  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const u = 1 - t
    points.push([
      p1[0] + 3 * u * u * t * cp1[0] + 3 * u * t * t * cp2[0] + t * t * t * delta[0],
      p1[1] + 3 * u * u * t * cp1[1] + 3 * u * t * t * cp2[1] + t * t * t * delta[1],
    ])
  }

  return {
    path: points,
    pathData: `M${p1[0]} ${p1[1]}c${cp1[0]} ${cp1[1]} ${cp2[0]} ${cp2[1]} ${delta[0]} ${delta[1]}`,
  }
}

// ---------------------------------------------------------------------------
// HarpnotesLayout
// ---------------------------------------------------------------------------

export class HarpnotesLayout {
  private readonly _imageResolver: HarpnotesLayoutOptions['imageResolver']
  private readonly _flowconf: boolean
  private readonly _interactive: boolean
  private _config: ZupfnoterConfig
  private _annotationTextMetrics: AnnotationTextMetrics
  private _createdAt: Date

  constructor(config: ZupfnoterConfig, options: HarpnotesLayoutOptions = {}) {
    this._imageResolver = options.imageResolver
    this._flowconf = options.flowconf === true
    this._interactive = options.interactive === true
    this._config = config
    this._annotationTextMetrics = options.annotationTextMetrics ?? createDefaultAnnotationTextMetrics()
    this._createdAt = options.createdAt ?? new Date()
  }

  /**
   * Main entry point: Song → Sheet.
   * Corresponds to Layout::Default#layout in harpnotes.rb.
  */
  layout(song: Song, extractNr: number | string = 0, pageFormat: 'A3' | 'A4' = 'A4'): Sheet {
    const conf = this._layoutPrepareOptions(extractNr)
    const renderLayout = requireDefined(
      conf.get('layout') as LayoutConfig | undefined,
      'HarpnotesLayout.layout(): missing layout configuration',
    )
    const renderPrinter = conf.get('printer') as PrinterConfig | undefined
    const useBeams = renderLayout.beams === true

    conf.push({
      layout: { ...renderLayout },
      printer: { ...(renderPrinter ?? {}) },
    })
    if (useBeams) {
      conf.push({
        layout: {
          DURATION_TO_STYLE: convertBeamStylesToDurationStyles(renderLayout.DURATION_TO_BEAMS),
        },
      })
    }

    try {
      // 1. Images
      const resImages = this._layoutImages(conf, extractNr)

      // 2. Voices (notes, pauses, flowlines, gotos, tuplets, barnumbers)
      const { activeVoices, voiceElements, beatMaps } = this._layoutVoices(song, extractNr, conf)

      // 3. Synchlines
      const resSynchLines = this._layoutSynchLines(song, beatMaps, conf, activeVoices, extractNr)

      // 4. Legend
      const resLegend = this._layoutLegend(song.metaData, conf, extractNr)

      // 5. System annotations
      const resZnAnnotations = this._layoutZnAnnotations(song.metaData, conf)

      // 6. Lyrics
      const resLyrics = this._layoutLyrics(song, conf, extractNr)

      // 7. Sheet annotations
      const resAnnotations = this._layoutAnnotations(song.metaData, conf, extractNr)

      // 8. Sheetmarks
      const resSheetmarks = this._layoutSheetmarks(conf, extractNr)

      // 9. Cutmarks
      const resCutmarks = this._layoutCutmarks(pageFormat, conf)

      // 10. Instrument shape
      const resInstrument = this._layoutInstrument(conf, extractNr)
      const resLegendBackgrounds = this._annotationBackgrounds(resLegend, renderLayout, 0.5)
      const resAnnotationBackgrounds = this._annotationBackgrounds(resAnnotations, renderLayout, 0.5)
      const resLyricsBackgrounds = this._annotationBackgrounds(resLyrics, renderLayout, 0.5)
      const children: DrawableElement[] = [
        ...resImages,
        ...resSynchLines,
        ...voiceElements,
        ...resLegendBackgrounds,
        ...resLegend,
        ...resAnnotationBackgrounds,
        ...resAnnotations,
        ...resZnAnnotations,
        ...resLyricsBackgrounds,
        ...resLyrics,
        ...resSheetmarks,
        ...resCutmarks,
        ...resInstrument,
      ]

      return {
        children: children.map((child) => (
          child.more_conf_keys === undefined
            ? { ...child, more_conf_keys: [] }
            : child
        )),
        activeVoices,
        printerConfig: renderPrinter,
        layoutConfig: {
          FONT_STYLE_DEF: renderLayout.FONT_STYLE_DEF,
          MM_PER_POINT: renderLayout.MM_PER_POINT,
        },
      }
    } finally {
      if (useBeams) {
        conf.pop()
      }
      conf.pop()
      conf.pop()
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  private _layoutPrepareOptions(extractNr: number | string): Confstack {
    return buildPrintOptions(this._config, extractNr)
  }

  private _resolveExtractOptions(conf: Confstack, extractNr: number | string): ExtractConfig {
    return requireDefined(
      conf.get('print_options') as ExtractConfig | undefined,
      'HarpnotesLayout._resolveExtractOptions(): missing extract options',
    )
  }

  // ---------------------------------------------------------------------------
  // Voices
  // ---------------------------------------------------------------------------

  private _layoutVoices(
    song: Song,
    extractNr: number | string,
    conf: Confstack,
  ): { activeVoices: number[]; voiceElements: DrawableElement[]; beatMaps: Map<number, BeatCompressionMap> } {
    const extractOptions = this._resolveExtractOptions(conf, extractNr)
    const layout = conf.get('layout') as LayoutConfig
    const activeVoiceNrs = extractOptions.voices ?? [1]
    const flowlineVoices = new Set(extractOptions.flowlines ?? [])
    const subflowlineVoices = new Set(extractOptions.subflowlines ?? [])
    const jumplineVoices = new Set(extractOptions.jumplines ?? [])
    const layoutlineVoices = extractOptions.layoutlines ?? []
    const startpos = extractOptions.startpos ?? 15

    // Compute beat compression for all layout voices.
    // layoutlineVoices contains the fachliche voice numbers from config.
    const layoutlineIndices = Array.from(new Set([...activeVoiceNrs, ...layoutlineVoices]))
    const beatCompressionMap = applyLegacyBeatSpread(
      computeBeatCompression(song, layoutlineIndices, conf, extractNr),
      layout,
      startpos,
    )

    const beatMaps = new Map<number, BeatCompressionMap>()
    const voiceElements: DrawableElement[] = []
    const activeVoices: number[] = []

    // Legacy walks the song's voice array and uses the extract voice list only
    // as a membership filter. The configured list is not a render-order list.
    for (const voice of song.voices) {
      const voiceNr = voice.index
      if (voiceNr <= 0 || !activeVoiceNrs.includes(voiceNr)) continue

      activeVoices.push(voiceNr)
      beatMaps.set(voiceNr, beatCompressionMap)

      const showFlowlines = flowlineVoices.has(voiceNr)
      const showSubflowlines = subflowlineVoices.has(voiceNr)
      const showJumplines = jumplineVoices.has(voiceNr)
      const nonflowrest = extractOptions.nonflowrest ?? false
      const synchedPlayables = this._buildSynchedPlayableSet(song, activeVoiceNrs, extractOptions)

      const elements = this._layoutVoice(
        voice,
        beatCompressionMap,
        voiceNr,
        extractNr,
        conf,
        layout,
        startpos,
        showFlowlines,
        showSubflowlines,
        showJumplines,
        nonflowrest,
        synchedPlayables,
      )
      voiceElements.push(...elements)
    }

    return { activeVoices, voiceElements, beatMaps }
  }

  private _computePlayableVisibility(
    voice: Voice,
    showFlowlines: boolean,
    showSubflowlines: boolean,
    nonflowrest: boolean,
    synchedPlayables: Set<PlayableEntity>,
  ): Map<PlayableEntity, boolean> {
    const playables = voice.entities.filter(
      (e): e is PlayableEntity => e.type === 'Note' || e.type === 'Pause' || e.type === 'SynchPoint',
    )
    const visibleByPlayable = new Map<PlayableEntity, boolean>()

    for (const playable of playables) {
      visibleByPlayable.set(playable, playable.visible)
    }

    if (nonflowrest) return visibleByPlayable

    let previous: PlayableEntity | null = null
    for (const playable of playables) {
      let visible = visibleByPlayable.get(playable) ?? playable.visible

      if (playable.type === 'Pause' && !showFlowlines) {
        visible = false
      }
      if (playable.type === 'Pause' && !showSubflowlines && !showFlowlines) {
        visible = false
      }
      visibleByPlayable.set(playable, visible)

      if (!showFlowlines && visible && !synchedPlayables.has(playable) && previous) {
        visibleByPlayable.set(previous, true)
      }

      previous = playable
    }

    return visibleByPlayable
  }

  private _buildSynchedPlayableSet(
    song: Song,
    activeVoiceNrs: number[],
    extractOptions: ExtractConfig,
  ): Set<PlayableEntity> {
    const result = new Set<PlayableEntity>()
    const activeVoices = new Set(activeVoiceNrs)
    const synchlinePairs = extractOptions.synchlines ?? []

    for (const [leftVoiceNr, rightVoiceNr] of synchlinePairs) {
      if (leftVoiceNr === undefined || rightVoiceNr === undefined) continue
      if (!activeVoices.has(leftVoiceNr) || !activeVoices.has(rightVoiceNr)) continue

      const leftVoice = getSongVoiceByVoiceNumber(song, leftVoiceNr)
      const rightVoice = getSongVoiceByVoiceNumber(song, rightVoiceNr)
      if (!leftVoice || !rightVoice) continue

      const leftByBeat = playablesByBeat(leftVoice)
      const rightByBeat = playablesByBeat(rightVoice)
      for (const [beat, leftPlayable] of leftByBeat) {
        const rightPlayable = rightByBeat.get(beat)
        if (!rightPlayable || !leftPlayable.visible || !rightPlayable.visible) continue
        addSynchedPlayable(result, leftPlayable)
        addSynchedPlayable(result, rightPlayable)
      }
    }

    return result
  }

  private _layoutVoice(
    voice: Voice,
    beatMap: BeatCompressionMap,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
    layout: LayoutConfig,
    startpos: number,
    showFlowlines: boolean,
    showSubflowlines: boolean,
    showJumplines: boolean,
    nonflowrest: boolean,
    synchedPlayables: Set<PlayableEntity>,
  ): DrawableElement[] {
    const playableElements: DrawableElement[] = []
    const decorationBackgrounds: Ellipse[] = []
    const decorations: DrawableElement[] = []
    const repeatSignVoices = new Set((conf.get('repeatsigns.voices') as number[] | undefined) ?? [])
    const visibleByPlayable = this._computePlayableVisibility(
      voice,
      showFlowlines,
      showSubflowlines,
      nonflowrest,
      synchedPlayables,
    )

    // Layout all playables
    for (const entity of voice.entities) {
      if (entity.type === 'Note') {
        const note = entity as Note
        const drawable = this._layoutNote(note, beatMap, layout, startpos, visibleByPlayable.get(note), voiceNr, extractNr, 0, true, conf)
        playableElements.push(drawable)
        if (note.measureStart) {
          playableElements.push(this._layoutMeasureBarover(drawable, layout))
        }
        const noteDecorations = this._layoutDecorations(note, drawable, layout, voiceNr, extractNr, conf)
        decorationBackgrounds.push(...noteDecorations.backgrounds)
        decorations.push(...noteDecorations.decorations)
      } else if (entity.type === 'Pause') {
        const pause = entity as Pause
        const glyph = this._layoutPause(pause, beatMap, layout, startpos, visibleByPlayable.get(pause), voiceNr, extractNr, 0, true, conf)
        if (glyph) {
          playableElements.push(glyph)
          if (pause.measureStart) {
            playableElements.push(this._layoutMeasureBarover(glyph, layout))
          }
          const pauseDecorations = this._layoutDecorations(pause, glyph, layout, voiceNr, extractNr, conf)
          decorationBackgrounds.push(...pauseDecorations.backgrounds)
          decorations.push(...pauseDecorations.decorations)
        }
      } else if (entity.type === 'SynchPoint') {
        const sp = entity as SynchPoint
        let decorationRoot: Ellipse | null = null
        const synchLine = this._layoutSynchPointLine(
          sp,
          beatMap,
          layout,
          startpos,
          visibleByPlayable.get(sp),
          voiceNr,
          extractNr,
          conf,
        )
        if (synchLine) playableElements.push(synchLine)
        for (const [noteIndex, note] of sp.notes.entries()) {
          const legacyNoteIndex = sp.notes.length - 1 - noteIndex
          const drawable = this._layoutNote(
            note,
            beatMap,
            layout,
            startpos,
            visibleByPlayable.get(sp),
            voiceNr,
            extractNr,
            legacyNoteIndex,
            legacyNoteIndex === 0,
            conf,
          )
          playableElements.push(drawable)
          if (
            note.measureStart &&
            note.measureStart
          ) {
            playableElements.push(this._layoutMeasureBarover(drawable, layout))
          }
          if (legacyNoteIndex === 0) {
            decorationRoot = drawable
          }
        }
        if (decorationRoot) {
          const spDecorations = this._layoutDecorations(sp, decorationRoot, layout, voiceNr, extractNr, conf)
          decorationBackgrounds.push(...spDecorations.backgrounds)
          decorations.push(...spDecorations.decorations)
        }
      }
    }

    const result: DrawableElement[] = []

    // Flowlines
    if (showFlowlines) {
      result.push(...this._layoutVoiceFlowlines(
        voice,
        beatMap,
        layout,
        startpos,
        voiceNr,
        extractNr,
        conf,
        'solid',
        visibleByPlayable,
      ))
    }
    if (showSubflowlines) {
      result.push(...this._layoutVoiceFlowlines(
        voice,
        beatMap,
        layout,
        startpos,
        voiceNr,
        extractNr,
        conf,
        'dotted',
        visibleByPlayable,
        synchedPlayables,
      ))
    }
    result.push(...this._layoutVoiceSlurs(voice, beatMap, layout, startpos, conf))

    // Gotos (jumplines)
    const gotos = showJumplines
      ? this._layoutVoiceGotos(voice, beatMap, layout, startpos, repeatSignVoices.has(voiceNr), extractNr, conf)
      : []

    // Tuplets
    result.push(...this._layoutVoiceTuplets(voice, beatMap, layout, startpos, voiceNr, extractNr, conf))
    result.push(...playableElements)

    const { barnumberBackgrounds, barnumbers, countnoteBackgrounds, countnotes } = this._layoutBarnumbersCountnotes(
      voice,
      beatMap,
      layout,
      startpos,
      voiceNr,
      extractNr,
      conf,
      visibleByPlayable,
    )
    result.push(...countnoteBackgrounds, ...countnotes, ...barnumberBackgrounds, ...barnumbers)
    result.push(...decorationBackgrounds, ...decorations)

    if (showJumplines) {
      result.push(...gotos)
    }

    const repeatSigns = this._layoutVoiceRepeatSigns(voice, beatMap, layout, startpos, voiceNr, extractNr, conf)
    const noteboundAnnotations = this._layoutVoiceNoteboundAnnotations(
      voice,
      beatMap,
      layout,
      startpos,
      voiceNr,
      extractNr,
      conf,
      showJumplines,
    )
    const orderedAnnotations = [...noteboundAnnotations, ...repeatSigns]
    const annotationBackgrounds = orderedAnnotations.map((annotation) => (
      this._annotationBackground(annotation, 'left', layout, 0.5)
    ))
    result.push(...annotationBackgrounds, ...orderedAnnotations)

    return result.map((child) => (
      child.more_conf_keys === undefined
        ? { ...child, more_conf_keys: [] }
        : child
    ))
  }

  private _layoutVoiceSlurs(
    voice: Voice,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    conf: Confstack,
  ): Path[] {
    const result: Path[] = []
    const playables = voice.entities.filter(
      (e): e is PlayableEntity => e.type === 'Note' || e.type === 'Pause' || e.type === 'SynchPoint',
    )
    const firstPlayable = playables[0]
    if (!firstPlayable) return result

    const bottomup = (conf.get('layout.bottomup') as boolean | undefined) ?? layout.bottomup ?? false
    const showSlur = (conf.get('layout.SHOW_SLUR') as boolean | undefined) ?? false
    const slurIndex = new Map<number, PlayableEntity>()
    let tieStart: PlayableEntity = firstPlayable

    for (const playable of playables) {
      if (playable.tieEnd) {
        result.push(...this._layoutTiePaths(tieStart, playable, beatMap, layout, startpos, bottomup))
      }

      if (playable.tieStart) {
        tieStart = playable
      }

      for (const id of playable.slurStarts) {
        slurIndex.set(id, playable)
      }
      const firstSlurStart = playable.slurStarts[0]
      if (firstSlurStart !== undefined) {
        slurIndex.set(firstSlurStart, playable)
      }

      if (showSlur) {
        for (const id of playable.slurEnds) {
          const beginSlur = slurIndex.get(id) ?? firstPlayable
          const p1 = addPoint(playableCenter(beginSlur, beatMap, layout, startpos), [3, 0])
          const p2 = addPoint(playableCenter(playable, beatMap, layout, startpos), [3, 0])
          result.push({
            type: 'Path',
            ...makeLegacySlurPath(p1, p2),
            fill: false,
            color: layout.color.color_default,
            lineWidth: layout.LINE_MEDIUM,
            visible: true,
            more_conf_keys: [],
          })
        }
      }
    }

    return result
  }

  private _layoutTiePaths(
    tieStart: PlayableEntity,
    playable: PlayableEntity,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    bottomup: boolean,
  ): Path[] {
    if (playable.type === 'SynchPoint' && tieStart.type === 'SynchPoint') {
      return playable.notes.flatMap((note, index) => {
        const startNote = tieStart.notes[index]
        if (!startNote) return []
        return [
          this._layoutSingleTiePath(startNote, note, beatMap, layout, startpos, bottomup, playable.variant),
        ]
      })
    }

    return [
      this._layoutSingleTiePath(tieStart, playable, beatMap, layout, startpos, bottomup, playable.variant),
    ]
  }

  private _layoutSingleTiePath(
    from: PlayableEntity,
    to: PlayableEntity,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    bottomup: boolean,
    variant: 0 | 1 | 2,
  ): Path {
    const fromCenter = playableCenter(from, beatMap, layout, startpos)
    const toCenter = playableCenter(to, beatMap, layout, startpos)
    const fromSize = playableSize(from, layout)
    const toSize = playableSize(to, layout)
    const dx = Math.max(fromSize[0], toSize[0]) + 0.5
    const p1 = addPoint(fromCenter, [dx, -0.5])
    const p2 = addPoint(toCenter, [dx, 0.5])

    return {
      type: 'Path',
      ...(bottomup ? makeLegacySlurPath(p2, p1) : makeLegacySlurPath(p1, p2)),
      fill: false,
      color: variantToColor(variant, layout),
      lineWidth: layout.LINE_THICK,
      visible: true,
      more_conf_keys: [],
    }
  }

  // ---------------------------------------------------------------------------
  // Note / Pause
  // ---------------------------------------------------------------------------

  private _noteShift(
    playable: PlayableEntity,
    size: [number, number],
    voiceNr: number | undefined,
    extractNr: number | string | undefined,
    noteIndex: number,
    conf: Confstack | undefined,
  ): number {
    if (voiceNr === undefined || extractNr === undefined || conf === undefined) return 0
    const configured = conf.get(
      `notebound.nconf.v_${voiceNr}.t_${playable.time}.n_${noteIndex}.nshift`,
    )
    return typeof configured === 'number' ? size[0] * 2 * configured : 0
  }

  private _layoutNote(
    note: Note,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    visible = note.visible,
    voiceNr?: number,
    extractNr?: number | string,
    noteIndex = 0,
    enableEditorMeta = true,
    conf?: Confstack,
  ): Ellipse {
    const dKey = durationToKey(note.duration)
    const style = layout.DURATION_TO_STYLE[dKey]
    const effectiveStyle = style !== undefined
      ? style
      : requireDefined(
        layout.DURATION_TO_STYLE['err'],
        'HarpnotesLayout._layoutNote(): missing fallback duration style "err"',
      )
    const color = variantToColor(note.variant, layout)
    const size: [number, number] = [
      layout.ELLIPSE_SIZE[0] * effectiveStyle.sizeFactor,
      layout.ELLIPSE_SIZE[1] * effectiveStyle.sizeFactor,
    ]
    const x = playableX(note, layout) + this._noteShift(note, size, voiceNr, extractNr, noteIndex, conf)
    const y = beatToY(note.beat, beatMap, layout, startpos)
    const confBase = voiceNr !== undefined && extractNr !== undefined
      ? `extract.${extractNr}.notebound.nconf.v_${voiceNr}.t_${note.time}.n_${noteIndex}`
      : undefined

    return {
      type: 'Ellipse',
      center: [x, y],
      size,
      fill: effectiveStyle.fill,
      dotted: effectiveStyle.dotted,
      rect: false,
      hasbarover: false,
      color,
      lineWidth: layout.LINE_THICK,
      visible,
      confKey: enableEditorMeta && confBase !== undefined ? `${confBase}.***` : undefined,
      more_conf_keys: enableEditorMeta
        ? this._buildPlayableMoreConfKeys(
          confBase !== undefined ? `${confBase}.***` : undefined,
          note.time,
          extractNr ?? 0,
        )
        : [],
      znId: note.znId,
      origin: note,
    }
  }

  private _layoutPause(
    pause: Pause,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    visible = pause.visible,
    voiceNr?: number,
    extractNr?: number | string,
    noteIndex = 0,
    enableEditorMeta = true,
    conf?: Confstack,
  ): Glyph | null {
    if (pause.invisible) return null

    const dKey = durationToKey(pause.duration)
    const restStyle = layout.REST_TO_GLYPH?.[dKey] ?? layout.REST_TO_GLYPH?.['err']
    if (!restStyle) return null
    const restSize: [number, number] = [
      layout.REST_SIZE[0] * restStyle.scale[0],
      layout.REST_SIZE[1] * restStyle.scale[1],
    ]
    const x = playableX(pause, layout) + this._noteShift(pause, restSize, voiceNr, extractNr, noteIndex, conf)
    const y = beatToY(pause.beat, beatMap, layout, startpos)
    const confBase = voiceNr !== undefined && extractNr !== undefined
      ? `extract.${extractNr}.notebound.nconf.v_${voiceNr}.t_${pause.time}.n_${noteIndex}`
      : undefined

    const color = variantToColor(pause.variant, layout)

    return {
      type: 'Glyph',
      center: [x, y],
      size: restSize,
      glyphName: restStyle.glyphName,
      dotted: restStyle.dotted,
      fill: 'filled',
      color,
      lineWidth: layout.LINE_THICK,
      visible,
      confKey: enableEditorMeta && confBase !== undefined ? `${confBase}.***` : undefined,
      more_conf_keys: enableEditorMeta
        ? this._buildPlayableMoreConfKeys(
          confBase !== undefined ? `${confBase}.***` : undefined,
          pause.time,
          extractNr ?? 0,
        )
        : [],
      znId: pause.znId,
      origin: pause,
    }
  }

  private _layoutDecorations(
    playable: PlayableEntity,
    root: Ellipse | Glyph,
    layout: LayoutConfig,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
  ): { backgrounds: Ellipse[]; decorations: DrawableElement[] } {
    const backgrounds: Ellipse[] = []
    const result: DrawableElement[] = []
    const annotationDecorations = layout.DECORATIIONS_AS_ANNOTATIONS ?? {}
    const decorationSize: [number, number] = [root.size[0] * 0.8, root.size[1] * 0.8]
    const defaultOffset: [number, number] = [
      0,
      Math.round(-root.size[1] / 0.8 - (playable.measureStart ? 2 : 1)),
    ]
    const decorations = [
      ...playable.decorations,
      ...playable.barDecorations,
    ].filter((decoration) => decoration !== '')

    for (const [index, decoration] of decorations.entries()) {
      const overrideKey = `notebound.decoration.v_${voiceNr}.t_${playable.time}.${index}`
      const legacyZnIdOverrideKey = `notebound.decoration.v_${voiceNr}.t_${playable.znId}.${index}`
      const objectConfKey = `extract.${extractNr}.notebound.decoration.v_${voiceNr}.t_${playable.time}.${index}`
      const configuredOffset = (conf.get(`${overrideKey}.pos`) as [number, number] | undefined)
        ?? (conf.get(`${legacyZnIdOverrideKey}.pos`) as [number, number] | undefined)
      const offset = configuredOffset ?? defaultOffset
      const visible = (conf.get(`${overrideKey}.show`) as boolean | undefined)
        ?? (conf.get(`${legacyZnIdOverrideKey}.show`) as boolean | undefined)
        ?? true
      if (!visible) continue

      const center: [number, number] = [root.center[0] + offset[0], root.center[1] + offset[1]]
      const annotation = annotationDecorations[decoration] as
        | {
          pos: [number, number]
          style: string
          text: string
          align?: 'left' | 'right' | 'center'
        }
        | undefined

      if (annotation) {
        const annotationCenter: [number, number] = [
          center[0] + annotation.pos[0],
          center[1] + annotation.pos[1],
        ]
        const style = (conf.get(`${overrideKey}.style`) as string | undefined)
          ?? (conf.get(`${legacyZnIdOverrideKey}.style`) as string | undefined)
          ?? annotation.style
        const drawable: Annotation = {
          type: 'Annotation',
          center: annotationCenter,
          text: annotation.text,
          style,
          align: annotation.align,
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: true,
          confKey: `${objectConfKey}.pos`,
          more_conf_keys: [],
          draginfo: this._annotationDraginfo(offset, `${objectConfKey}.pos`),
          znId: playable.znId,
          origin: playable,
        }
        backgrounds.push(this._annotationBackground(drawable, annotation.align ?? 'left', layout, 0.2))
        result.push(drawable)
      } else {
        result.push({
          type: 'Glyph',
          center,
          size: decorationSize,
          glyphName: decoration,
          dotted: false,
          fill: 'filled',
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: true,
          confKey: `${objectConfKey}.pos`,
          more_conf_keys: [],
          draginfo: this._annotationDraginfo(offset, `${objectConfKey}.pos`),
          znId: playable.znId,
        })
      }
    }

    return { backgrounds, decorations: result }
  }

  private _buildPlayableMoreConfKeys(
    rootConfKey: string | undefined,
    playableTime: number,
    extractNr: number | string,
  ): Array<Record<string, unknown>> {
    if (rootConfKey === undefined) return []

    const shiftConfKey = `${rootConfKey.replace(/\.[^.]+$/, '')}.nshift`
    const mincConfKey = `extract.${extractNr}.notebound.minc.${playableTime}.minc_f`

    return [
      {
        conf_key: shiftConfKey,
        text: 'shift left',
        icon: 'fa fa-arrow-left',
        value: -0.5,
      },
      {
        conf_key: shiftConfKey,
        text: 'shift right',
        icon: 'fa fa-arrow-right',
        value: 0.5,
      },
      {
        text: '---',
        icon: 'fa fa-arrows-v',
        value: 0.5,
      },
      {
        conf_key: mincConfKey,
        text: 'Edit Minc',
        icon: 'fa fa-arrows-v',
      },
      {
        conf_key: mincConfKey,
        text: 'increase Minc',
        icon: 'fa fa-arrow-down',
        value: 0.5,
      },
      {
        conf_key: mincConfKey,
        text: 'decrease Minc',
        icon: 'fa fa-arrow-up',
        value: -0.5,
      },
    ]
  }

  private _annotationDraginfo(value?: [number, number], confKey?: string): Record<string, unknown> {
    return {
      handler: 'annotation',
      ...(value === undefined ? {} : { value }),
      ...(confKey === undefined ? {} : { conf_key: confKey }),
    }
  }

  private _layoutMeasureBarover(root: Ellipse | Glyph, layout: LayoutConfig): Ellipse {
    const baroverY = root.size[1] + layout.LINE_THICK
    return {
      type: 'Ellipse',
      center: [root.center[0], root.center[1] - baroverY],
      size: [root.size[0], layout.LINE_THICK / 2],
      fill: 'filled',
      dotted: false,
      rect: true,
      hasbarover: false,
      color: root.color,
      lineWidth: layout.LINE_THIN,
      visible: root.visible,
      znId: root.znId,
      more_conf_keys: [],
    }
  }

  private _annotationBackground(
    annotation: Annotation,
    align: 'left' | 'right' | 'center',
    layout: LayoutConfig,
    padding: number,
    shiftEu = false,
  ): Ellipse {
    if (annotation.text === '') {
      return {
        type: 'Ellipse',
        center: [annotation.center[0], annotation.center[1] - 0.25],
        size: [0.5, 0.35],
        fill: 'filled',
        dotted: false,
        rect: true,
        ...(annotation.selectionBackground === false ? { hitboxOnly: true } : {}),
        hasbarover: false,
        color: 'white',
        lineWidth: layout.LINE_THIN,
        confKey: annotation.confKey,
        more_conf_keys: annotation.more_conf_keys,
        znId: annotation.znId,
        draginfo: annotation.draginfo,
        visible: true,
      }
    }
    const size = this._annotationSize(annotation.text, annotation.style, layout)
    const halfSize: [number, number] = [size[0] * 0.5, size[1] * 0.5]
    const paddedSize: [number, number] = [halfSize[0] + padding, halfSize[1] + padding]
    const backgroundX = align === 'left'
      ? halfSize[0]
      : align === 'right'
        ? -halfSize[0]
        : 0
    const backgroundSize: [number, number] = [...paddedSize]
    let backgroundY = halfSize[1]
    if (shiftEu) {
      // Legacy shortens the background for countnote text whose baseline is
      // shifted upward (for example u, a, o, v and e).
      backgroundY = halfSize[1] - padding * 0.7
      backgroundSize[1] *= 0.5
    } else if (!/[|gyqp]/.test(annotation.text)) {
      // Legacy leaves descenders at full height and shortens all other text.
      backgroundY = halfSize[1] - padding * 0.5
      backgroundSize[1] *= 0.7
    }

    return {
      type: 'Ellipse',
      center: [annotation.center[0] + backgroundX, annotation.center[1] + backgroundY],
      size: backgroundSize,
      fill: 'filled',
      dotted: false,
      rect: true,
      ...(annotation.selectionBackground === false ? { hitboxOnly: true } : {}),
      hasbarover: false,
      color: 'white',
      lineWidth: layout.LINE_THIN,
      confKey: annotation.confKey,
      more_conf_keys: annotation.more_conf_keys,
      znId: annotation.znId,
      draginfo: annotation.draginfo,
      visible: true,
    }
  }

  private _annotationBackgrounds(
    annotations: Annotation[],
    layout: LayoutConfig,
    padding: number,
  ): Ellipse[] {
    return annotations
      .filter((annotation) => annotation.confKey !== undefined && this._interactive)
      .map((annotation) => this._annotationBackground(annotation, annotation.align ?? 'left', layout, padding))
  }

  private _annotationSize(text: string, style: string, layout: LayoutConfig): [number, number] {
    return this._annotationTextMetrics.measureAnnotation(text, style, layout)
  }

  // ---------------------------------------------------------------------------
  // Flowlines
  // ---------------------------------------------------------------------------

  private _layoutVoiceFlowlines(
    voice: Voice,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
    style: 'solid' | 'dotted',
    visibleByPlayable: Map<PlayableEntity, boolean>,
    synchedPlayables?: Set<PlayableEntity>,
  ): DrawableElement[] {
    const result: DrawableElement[] = []
    const playables = voice.entities.filter(
      (e): e is PlayableEntity => e.type === 'Note' || e.type === 'Pause' || e.type === 'SynchPoint',
    )
    let prev: PlayableEntity | null = null
    for (const curr of playables) {
      if (prev && !curr.firstInPart && !synchedPlayables?.has(curr)) {
        if (this._skipLegacyFlowline(prev, curr)) {
          prev = curr
          continue
        }

        const context = { conf, voiceNr, extractNr }
        const from = playableCenter(prev, beatMap, layout, startpos, context)
        const to = playableCenter(curr, beatMap, layout, startpos, context)
        const visible = (visibleByPlayable.get(curr) ?? curr.visible) && (visibleByPlayable.get(prev) ?? prev.visible)
        const override = conf.get(`notebound.flowline.v_${voiceNr}.${curr.znId}`)
          ?? conf.get(`notebound.flowline.v_${voiceNr}.${curr.time}`)
        const flowlineConfKey = `extract.${extractNr}.notebound.flowline.v_${voiceNr}.${curr.znId}`

        if (override !== undefined || this._flowconf) {
          const options = mergeAnnotatedBezierOptions(getAnnotatedBezierDefaults(conf, 'flowline'), override)
          if (options.show) {
            const pathData = makeAnnotatedBezierPath(from, to, options)
            const draginfo = this._flowconf
              ? {
                handler: 'bezier',
                conf_key: flowlineConfKey,
                bezier: {
                  from,
                  to,
                  cp1: addPoint(from, pathData.cp1),
                  cp2: addPoint(from, pathData.cp2),
                },
              }
              : undefined
            result.push({
              type: 'Path',
              ...pathData,
              fill: false,
              color: layout.color.color_default,
              lineWidth: style === 'solid' ? layout.LINE_MEDIUM : layout.LINE_THIN,
              // The drawable key is the Legacy context-menu parent. The
              // draginfo keeps the concrete key for cp1/cp2 updates.
              confKey: `${flowlineConfKey}.*`,
              visible,
              more_conf_keys: [],
              ...(draginfo === undefined ? {} : { draginfo }),
              znId: curr.znId,
            })
          }
        } else {
          result.push({
            type: 'FlowLine',
            from,
            to,
            style,
            color: layout.color.color_default,
            lineWidth: style === 'solid' ? layout.LINE_MEDIUM : layout.LINE_THIN,
            confKey: `${flowlineConfKey}.*`,
            visible,
            znId: curr.znId,
          })
        }
      }
      prev = curr
    }
    return result
  }

  private _skipLegacyFlowline(
    prev: PlayableEntity,
    curr: PlayableEntity,
  ): boolean {
    if (curr.measureStart === true && prev.variant !== curr.variant) return true
    return false
  }

  private _layoutSynchPointLine(
    synchPoint: SynchPoint,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    visible: boolean | undefined,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
  ): FlowLine | null {
    const context = { conf, voiceNr, extractNr }
    const noteCenters = synchPoint.notes.map((note) => ({
      note,
      center: playableCenter(note, beatMap, layout, startpos, context),
    }))
    if (noteCenters.length < 2) return null

    const leftmost = noteCenters.reduce((left, current) => (
      current.center[0] < left.center[0] ? current : left
    ))
    const rightmost = noteCenters.reduce((right, current) => (
      current.center[0] > right.center[0] ? current : right
    ))
    if (leftmost.note === rightmost.note) return null

    return {
      type: 'FlowLine',
      from: leftmost.center,
      to: rightmost.center,
      style: 'dashed',
      color: variantToColor(leftmost.note.variant, layout),
      lineWidth: layout.LINE_THIN,
      confKey: `extract.${extractNr}.synchlines.*`,
      visible: visible === true,
      znId: synchPoint.znId,
    }
  }

  // ---------------------------------------------------------------------------
  // Gotos (Jumplines)
  // ---------------------------------------------------------------------------

  private _layoutVoiceGotos(
    voice: Voice,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    hideRepeatGotos: boolean,
    extractNr: number | string,
    conf: Confstack,
  ): Path[] {
    const result: Path[] = []

    for (const entity of voice.entities) {
      if (entity.type !== 'Goto') continue
      const goto = entity as Goto
      if (hideRepeatGotos && goto.policy?.isRepeat) continue

      const fromNote = goto.from
      const toNote = goto.to
      if (!fromNote || !toNote) continue

      const paths = this._makeLegacyJumplinePaths(goto, fromNote, toNote, beatMap, layout, startpos, extractNr, conf)
      result.push(...paths)
    }

    return result
  }

  private _makeLegacyJumplinePaths(
    goto: Goto,
    fromNote: PlayableEntity,
    toNote: PlayableEntity,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    extractNr: number | string,
    conf: Confstack,
  ): Path[] {
    let distance = this._resolveJumplineDistance(goto, conf, extractNr)
    if (distance === 0) return []
    if (distance > 0) distance -= 1

    let fromAnchor = goto.policy?.fromAnchor ?? 'after'
    let toAnchor = goto.policy?.toAnchor ?? 'before'
    const verticalAnchor = goto.policy?.verticalAnchor ?? 'from'

    const bottomup = (conf.get('layout.bottomup') as boolean | undefined) ?? layout.bottomup ?? false
    if (bottomup) {
      fromAnchor = swapJumplineAnchor(fromAnchor)
      toAnchor = swapJumplineAnchor(toAnchor)
    }

    const anchor = (
      conf.get('layout.jumpline_anchor') as [number, number] | undefined
    ) ?? layout.jumpline_anchor
    const configuredVerticalCut = (
      conf.get('layout.jumpline_vcut') as number | undefined
    ) ?? layout.jumpline_vcut ?? 0
    const verticalCut = this._computeJumplineVerticalCut(fromNote, toNote, configuredVerticalCut)
    const fromCenter = playableCenter(fromNote, beatMap, layout, startpos)
    const toCenter = playableCenter(toNote, beatMap, layout, startpos)
    const fromSize = playableSize(fromNote, layout)
    const toSize = playableSize(toNote, layout)
    // Keep the signed distance. Legacy uses this value directly; in
    // particular, a negative p_end moves the vertical segment to the other
    // side of the target anchor instead of being mirrored to the positive
    // side.
    const verticalOffset = (distance + 0.5) * layout.X_SPACING
    const verticalBase = verticalAnchor === 'to' ? toCenter : fromCenter
    const verticalX = verticalBase[0] + verticalOffset
    const startOrientation = orientationX(verticalX - fromCenter[0])
    const endOrientation = orientationX(verticalX - toCenter[0])
    const fromAnchorSign = fromAnchor === 'before' ? -1 : 1
    const toAnchorSign = toAnchor === 'before' ? -1 : 1

    const startOffset: [number, number] = [
      (fromSize[0] + anchor[0]) * startOrientation,
      (fromSize[1] + anchor[1]) * fromAnchorSign,
    ]
    const endOffset: [number, number] = [
      (toSize[0] + anchor[0]) * endOrientation,
      (toSize[1] + anchor[1]) * toAnchorSign,
    ]

    const p1 = addPoint(fromCenter, startOffset)
    const p2: [number, number] = [verticalX, fromCenter[1] + startOffset[1]]
    const p3: [number, number] = [verticalX, toCenter[1] + endOffset[1]]
    const p4 = addPoint(toCenter, endOffset)
    const p4Line = addPoint(p4, [2 * endOrientation, 0])
    const dy = p3[1] - p2[1]
    const verticalCutY = verticalCut === 0 ? dy : (dy > 0 ? verticalCut : -verticalCut)
    const vcp2 = addPoint(p2, [0, verticalCutY])
    const vcp3 = addPoint(p3, [0, -verticalCutY])
    const verticalOrientation = orientationY(p2[1] - p3[1])
    const lineCutEnd = addPoint(vcp2, [0, verticalOrientation])
    const arrow1 = addPoint(p4, [2.5 * endOrientation, 1])
    const arrow2 = addPoint(p4, [2.5 * endOrientation, -1])
    const vcutArrow1 = addPoint(vcp2, [0.5, 1.5 * verticalOrientation])
    const vcutArrow2 = addPoint(vcp2, [-0.5, 1.5 * verticalOrientation])
    const outlinePathData = makeJumplinePathData({
      from: { center: fromCenter, size: fromSize, anchor: fromAnchor },
      to: { center: toCenter, size: toSize, anchor: toAnchor },
      vertical: verticalOffset,
      vertical_anchor: verticalAnchor,
      jumpline_anchor: anchor,
      verticalcut: verticalCut,
    }).outlinePathData
    const arrowPathData = [
      `M${p4[0]} ${p4[1]}`,
      `l${arrow1[0] - p4[0]} ${arrow1[1] - p4[1]}`,
      `l${arrow2[0] - arrow1[0]} ${arrow2[1] - arrow1[1]}`,
      `l${p4[0] - arrow2[0]} ${p4[1] - arrow2[1]}`,
      'z',
    ].join('')
    const vcutArrowPathData = verticalCut === 0
      ? undefined
      : [
        `M${vcp2[0]} ${vcp2[1]}`,
        `l${vcutArrow1[0] - vcp2[0]} ${vcutArrow1[1] - vcp2[1]}`,
        `l${vcutArrow2[0] - vcutArrow1[0]} ${vcutArrow2[1] - vcutArrow1[1]}`,
        `l${vcp2[0] - vcutArrow2[0]} ${vcp2[1] - vcutArrow2[1]}`,
        'z',
      ].join('')
    const confKey = this._buildJumplineConfKey(extractNr, goto.confKey ?? goto.policy?.confKey)

    return [
      {
        type: 'Path',
        path: [p1, p2, lineCutEnd, vcp3, p3, p4Line],
        pathData: outlinePathData,
        fill: false,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THICK,
        confKey,
        visible: true,
        more_conf_keys: [],
        draginfo: {
          handler: 'jumpline',
          jumpline: {
            from: {
              center: fromCenter,
              size: fromSize,
              anchor: fromAnchor,
            },
            to: {
              center: toCenter,
              size: toSize,
              anchor: toAnchor,
            },
            vertical: verticalOffset,
            vertical_anchor: verticalAnchor,
            padding: null,
            xspacing: layout.X_SPACING,
            jumpline_anchor: anchor,
            verticalcut: verticalCut,
          },
          xspacing: layout.X_SPACING,
        },
        znId: goto.znId,
      },
      {
        type: 'Path',
        path: [
          p4,
          arrow1,
          arrow2,
        ],
        pathData: arrowPathData,
        fill: true,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        confKey,
        visible: true,
        more_conf_keys: [],
        znId: goto.znId,
      },
      {
        type: 'Path',
        path: verticalCut === 0
          ? []
          : [
            vcp2,
            vcutArrow1,
            vcutArrow2,
          ],
        pathData: vcutArrowPathData,
        fill: true,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        confKey,
        visible: true,
        more_conf_keys: [],
        znId: goto.znId,
      },
    ]
  }

  private _resolveJumplineDistance(goto: Goto, conf: Confstack, extractNr: number | string): number {
    const confKey = goto.confKey ?? goto.policy?.confKey
    if (confKey) {
      const localConfKey = confKey.replace(/^extract\.\d+\./, '')
      const configuredDistance = conf.get(localConfKey)
      if (typeof configuredDistance === 'number') return configuredDistance
    }

    return goto.policy?.distance ?? 1
  }

  private _buildJumplineConfKey(extractNr: number | string, confKey: string | undefined): string | undefined {
    if (confKey === undefined) return undefined
    return activeExtractConfKey(extractNr, confKey)
  }

  private _computeJumplineVerticalCut(
    fromNote: PlayableEntity,
    toNote: PlayableEntity,
    configuredVerticalCut: number,
  ): number {
    // Legacy checks adjacency on the underlying note origins. A jump between
    // chord proxy SynchPoints is therefore considered open even when the
    // proxy objects are consecutive in the TS playable list.
    if (fromNote.type === 'SynchPoint' && toNote.type === 'SynchPoint') {
      return configuredVerticalCut
    }
    const adjacentToFrom = fromNote.prevPlayable === toNote || fromNote.nextPlayable === toNote
    const adjacentToTarget = toNote.prevPlayable === fromNote || toNote.nextPlayable === fromNote
    return adjacentToFrom || adjacentToTarget ? 0 : configuredVerticalCut
  }

  // ---------------------------------------------------------------------------
  // Tuplets
  // ---------------------------------------------------------------------------

  private _layoutVoiceTuplets(
    voice: Voice,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
  ): DrawableElement[] {
    const result: DrawableElement[] = []
    const playables = voice.entities.filter(
      (e): e is PlayableEntity => e.type === 'Note' || e.type === 'Pause' || e.type === 'SynchPoint',
    )

    let tupletStart: PlayableEntity | null = null
    let tupletNum = 1

    for (const p of playables) {
      if (p.tupletStart) {
        tupletStart = p
        tupletNum = p.tuplet
      }
      if (p.tupletEnd && tupletStart) {
        const override = conf.get(`notebound.tuplet.v_${voiceNr}.${tupletStart.znId}`)
          ?? conf.get(`notebound.tuplet.v_${voiceNr}.${tupletStart.time}`)
        const options = mergeAnnotatedBezierOptions(getAnnotatedBezierDefaults(conf, 'tuplet'), override)

        if (options.show) {
          const p1 = playableCenter(tupletStart, beatMap, layout, startpos)
          const p2 = playableCenter(p, beatMap, layout, startpos)
          const { path, pathData, anchor, baseAnchor, cp1, cp2 } = makeAnnotatedBezierPath(p1, p2, options)
          const configuredText = conf.get('tuplets.text')
          const text = (
            typeof configuredText === 'string'
              ? configuredText
              : String(tupletNum)
          ).replaceAll('{{tuplet}}', String(tupletNum))
          const configuredStyle = conf.get('tuplets.style')

          result.push({
            type: 'Path',
            path,
            pathData,
            fill: false,
            color: layout.color.color_default,
            lineWidth: layout.LINE_THIN,
            confKey: `extract.${extractNr}.notebound.tuplet.v_${voiceNr}.${tupletStart.znId}.*`,
            visible: true,
            more_conf_keys: [],
            draginfo: {
              handler: 'tuplet',
              p1,
              p2,
              cp1: addPoint(p1, cp1),
              cp2: addPoint(p1, cp2),
              // Legacy's drag handle stays at the unconfigured curve anchor;
              // the configured offset applies only to the visible annotation.
              mp: { x: baseAnchor[0], y: baseAnchor[1] },
              tuplet_options: options,
              conf_key: `extract.${extractNr}.notebound.tuplet.v_${voiceNr}.${tupletStart.znId}`,
              callback: null,
            },
            znId: tupletStart.znId,
          })
          result.push({
            type: 'Annotation',
            center: anchor,
            text,
            style: typeof configuredStyle === 'string' ? configuredStyle : 'small',
            color: layout.color.color_default,
            lineWidth: layout.LINE_THIN,
            confKey: `extract.${extractNr}.notebound.tuplet.v_${voiceNr}.${tupletStart.znId}.*`,
            visible: true,
            more_conf_keys: [],
            draginfo: this._annotationDraginfo(
              options.pos,
              `extract.${extractNr}.notebound.tuplet.v_${voiceNr}.${tupletStart.znId}.pos`,
            ),
            znId: tupletStart.znId,
          })
        }

        tupletStart = null
      }
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Synchlines
  // ---------------------------------------------------------------------------

  private _layoutSynchLines(
    song: Song,
    beatMaps: Map<number, BeatCompressionMap>,
    conf: Confstack,
    activeVoiceNrs: number[],
    extractNr: number | string,
  ): FlowLine[] {
    const result: FlowLine[] = []
    const layout = conf.get('layout') as LayoutConfig
    const startpos = (conf.get('startpos') as number | undefined) ?? 15
    const synchlinePairs = (conf.get('synchlines') as number[][] | undefined) ?? []
    const activeVoices = new Set(activeVoiceNrs)

    for (const [v1Nr, v2Nr] of synchlinePairs) {
      if (v1Nr === undefined || v2Nr === undefined) continue
      if (!activeVoices.has(v1Nr) || !activeVoices.has(v2Nr)) continue
      const voice1 = getSongVoiceByVoiceNumber(song, v1Nr)
      const voice2 = getSongVoiceByVoiceNumber(song, v2Nr)
      if (!voice1 || !voice2) continue

      const beatMap1 = beatMaps.get(v1Nr) ?? beatMaps.values().next().value
      const beatMap2 = beatMaps.get(v2Nr) ?? beatMaps.values().next().value
      if (!beatMap1 || !beatMap2) continue

      // Build beat → playable maps for both voices
      const v1ByBeat = new Map<number, PlayableEntity>()
      const v2ByBeat = new Map<number, PlayableEntity>()

      for (const e of voice1.entities) {
        if (e.type === 'Note' || e.type === 'Pause' || e.type === 'SynchPoint') {
          v1ByBeat.set(e.beat, e as PlayableEntity)
        }
      }
      for (const e of voice2.entities) {
        if (e.type === 'Note' || e.type === 'Pause' || e.type === 'SynchPoint') {
          v2ByBeat.set(e.beat, e as PlayableEntity)
        }
      }

      // Connect notes at the same beat
      for (const [beat, p1] of v1ByBeat) {
        const p2 = v2ByBeat.get(beat)
        if (!p2) continue

        result.push({
          type: 'FlowLine',
          from: playableCenter(p1, beatMap1, layout, startpos),
          to: playableCenter(p2, beatMap2, layout, startpos),
          style: 'dashed',
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          confKey: `extract.${extractNr}.synchlines.*`,
          visible: p1.visible && p2.visible,
          more_conf_keys: [],
        })
      }
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Sheetmarks
  // ---------------------------------------------------------------------------

  private _layoutSheetmarks(conf: Confstack, extractNr: number | string): DrawableElement[] {
    const result: DrawableElement[] = []
    const layout = conf.get('layout') as LayoutConfig
    const vpos = (conf.get('stringnames.vpos') as number[] | undefined) ?? []
    const style = (conf.get('stringnames.style') as string | undefined) ?? 'small'
    const labels = parseStringNamesText(conf.get('stringnames.text') as string | undefined)
    const marks = (conf.get('stringnames.marks.hpos') as number[] | undefined) ?? []
    const markVpos = (conf.get('stringnames.marks.vpos') as number[] | undefined) ?? []

    for (const pitch of marks) {
      const x = pitchToX(pitch, layout)
      for (const y of markVpos) {
        const sheetmarkPath = makeSheetmarkPath([x, y])
        result.push({
          type: 'Path',
          path: sheetmarkPath.path,
          pathData: sheetmarkPath.pathData,
          fill: true,
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: true,
          confKey: `extract.${extractNr}.stringnames.marks.hpos`,
          more_conf_keys: [],
        })
      }
    }

    if (vpos.length > 0 && labels.length > 0) {
      const startScale = -layout.PITCH_OFFSET
      for (let index = 0; index < 37; index++) {
        const pitch = startScale + index
        const x = pitchToX(pitch, layout)
        const text = labels[index % labels.length] ?? '~'
        for (const y of vpos) {
        result.push({
          type: 'Annotation',
          center: [x, y],
          text,
          style,
          align: 'center',
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: true,
          confKey: `extract.${extractNr}.stringnames.text`,
          more_conf_keys: [],
          draginfo: this._annotationDraginfo(),
        })
        }
      }
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Legend
  // ---------------------------------------------------------------------------

  private _layoutLegend(
    metaData: SongMetaData,
    conf: Confstack,
    extractNr: number | string,
  ): Annotation[] {
    const result: Annotation[] = []
    const layout = conf.get('layout') as LayoutConfig
    const extractOptions = this._resolveExtractOptions(conf, extractNr)
    const legendConf = extractOptions.legend as Record<string, unknown> | undefined

    const titlePos = (legendConf?.['pos'] as [number, number] | undefined) ?? [320, 7]
    const titleStyle = (legendConf?.['tstyle'] as string | undefined) ?? 'large'
    const secondaryPos = (legendConf?.['spos'] as [number, number] | undefined) ?? [320, 27]
    const secondaryStyle = (legendConf?.['style'] as string | undefined) ?? 'regular'
    const extractTitle = extractOptions.title ?? String(extractNr)
    const legendAlign = legendConf?.['align'] as string | undefined
    const align: 'left' | 'right' | 'center' = legendAlign === 'l'
      ? 'right'
      : legendAlign === 'center'
        ? 'center'
        : 'left'

    result.push({
      type: 'Annotation',
      center: titlePos,
      text: metaData.title ?? '',
      style: titleStyle,
      align,
      confKey: `extract.${extractNr}.legend.pos`,
      color: layout.color.color_default,
      lineWidth: layout.LINE_THIN,
      visible: true,
      more_conf_keys: [],
      draginfo: this._annotationDraginfo(titlePos),
    })

    const meter = metaData.meter ? `Takt: ${metaData.meter}${metaData.tempoDisplay ? ` (${metaData.tempoDisplay})` : ''}` : undefined
    const key = metaData.key ? `Tonart: ${metaData.key}` : undefined
    const secondaryText = [extractTitle, metaData.composer ?? '', meter, key]
      .filter((entry) => entry !== undefined)
      .join('\n')

    if (secondaryText && extractOptions.notes?.T06_legend === undefined) {
      result.push({
        type: 'Annotation',
        center: secondaryPos,
        text: secondaryText,
        style: secondaryStyle,
        align,
        confKey: `extract.${extractNr}.legend.spos`,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        visible: true,
        more_conf_keys: [],
        draginfo: this._annotationDraginfo(),
      })
    }

    return result
  }

  private _layoutZnAnnotations(metaData: SongMetaData, conf: Confstack): Annotation[] {
    const filename = metaData.filename ?? ''
    const checksum = metaData.checksum ?? ''
    const layout = conf.get('layout') as LayoutConfig

    return [
      {
        type: 'Annotation',
        center: [150, 289],
        text: `${filename} - created ${formatCreationTimestamp(this._createdAt)} by Zupfnoter-TS`,
        style: 'smaller',
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        visible: true,
        more_conf_keys: [],
        draginfo: this._annotationDraginfo(),
      },
      {
        type: 'Annotation',
        center: [325, 289],
        text: 'Zupfnoter: https://www.zupfnoter.de',
        style: 'smaller',
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        visible: true,
        more_conf_keys: [],
        draginfo: this._annotationDraginfo(),
      },
      {
        type: 'Annotation',
        center: [380, 289],
        text: checksum,
        style: 'smaller',
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        visible: true,
      },
    ]
  }

  // ---------------------------------------------------------------------------
  // Lyrics
  // ---------------------------------------------------------------------------

  private _layoutLyrics(
    song: Song,
    conf: Confstack,
    extractNr: number | string,
  ): Annotation[] {
    const result: Annotation[] = []
    const layout = conf.get('layout') as LayoutConfig
    const lyricsConf = (conf.get('lyrics') as Record<string, { verses?: number[]; pos?: [number, number]; style?: string }> | undefined) ?? {}
    const rawLyrics = song.harpnoteOptions?.['lyrics']

    if (rawLyrics && Object.keys(lyricsConf).length > 0) {
      const lyricsText = (rawLyrics as { text?: string[] }).text ?? []
      const normalizedLyrics = lyricsText.join('\n').replace(/\t/g, ' ').replace(/ +/g, ' ')
      if (normalizedLyrics.trim().length === 0) return result
      const verses = this._normalizeAnnotationText(normalizedLyrics)
        .split(/\n\n+/)
        .map((entry) => entry.trim())

      for (const [key, entry] of Object.entries(lyricsConf)) {
        if (key === 'versepos' || !entry.pos) continue

        const text = (entry.verses ?? [])
          .map((verseNo) => {
            if (verseNo === 0) return verses[9998]
            if (verseNo < 0) return verses[verseNo]
            return verses[verseNo - 1]
          })
          // Ruby's Array#join keeps separators for missing (nil) verses.
          // Preserve those empty slots instead of filtering them out.
          .map((verse) => verse ?? '')
          .join('\n\n')

        if (text.length === 0) continue
        result.push({
          type: 'Annotation',
          center: entry.pos,
          text,
          style: entry.style ?? 'regular',
          confKey: `extract.${extractNr}.lyrics.${key}.pos`,
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: true,
          selectionBackground: false,
          more_conf_keys: [],
          draginfo: this._annotationDraginfo(entry.pos),
        })
      }

      return result
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Sheet annotations
  // ---------------------------------------------------------------------------

  private _layoutAnnotations(
    metaData: SongMetaData,
    conf: Confstack,
    extractNr: number | string,
  ): Annotation[] {
    const result: Annotation[] = []
    const layout = conf.get('layout') as LayoutConfig
    const extractOptions = this._resolveExtractOptions(conf, extractNr)
    const notes = extractOptions.notes as Record<string, unknown> | undefined

    if (!notes) return result

    for (const [key, entry] of this._sortSheetAnnotationEntries(notes)) {
      const ann = entry as { pos?: [number, number]; text?: string; style?: string; align?: string }
      if (!ann.pos || ann.text === undefined) continue
      const align: 'left' | 'right' | 'center' = ann.align === 'l'
        ? 'right'
        : ann.align === 'center'
          ? 'center'
          : 'left'

      result.push({
        type: 'Annotation',
        center: ann.pos,
        text: this._normalizeAnnotationText(this._resolveAnnotationPlaceholders(ann.text, metaData, extractOptions, extractNr)),
        style: ann.style ?? 'regular',
        align,
        confKey: `extract.${extractNr}.notes.${key}.pos`,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        visible: true,
        more_conf_keys: [],
        draginfo: this._annotationDraginfo(ann.pos),
      })
    }

    return result
  }

  private _sortSheetAnnotationEntries(notes: Record<string, unknown>): Array<[string, unknown]> {
    const entries = Object.entries(notes)
    if (entries.some(([key]) => !key.startsWith('T'))) return entries

    const legacyOrder = new Map([
      ['T01_number', 0],
      ['T01_number_extract', 1],
    ])
    return entries.sort(([left], [right]) => {
      const leftOrder = legacyOrder.get(left) ?? 100
      const rightOrder = legacyOrder.get(right) ?? 100
      if (leftOrder !== rightOrder) return leftOrder - rightOrder
      return 0
    })
  }

  private _normalizeAnnotationText(text: string): string {
    return Array.from(text.replaceAll(/[„“‚’—–]/g, (char) => {
      const replacements: Record<string, string> = {
        '„': '"',
        '“': '"',
        '‚': "'",
        '’': "'",
        '—': '-',
        '–': '-',
      }
      return replacements[char] ?? char
    })).map((char) => char.charCodeAt(0) > 255 ? '¿' : char).join('')
  }

  private _resolveAnnotationPlaceholders(
    text: string,
    metaData: SongMetaData,
    extractOptions: ExtractConfig,
    extractNr: number | string,
  ): string {
    const produce = this._config.produce ?? []
    const printedExtracts = produce
      .map((nr) => this._config.extract[String(nr)]?.filenamepart)
      .filter((part): part is string => part !== undefined)
      .join(' ')
    const extractFilename = extractOptions.filenamepart ?? ''
    const extractTitle = extractOptions.title ?? String(extractNr)
    const partSequence = metaData.partSequence
    const partNameById = new Map<string, string>()
    for (const marker of partSequence?.markers ?? []) {
      if (!partNameById.has(marker.id)) partNameById.set(marker.id, marker.displayName)
    }
    const partKeys = partSequence?.order.join(' : ') ?? ''
    const partNames = partSequence?.order
      .map(id => partNameById.get(id) ?? id)
      .join(' : ') ?? ''
    const placeholders: Record<string, string> = {
      composer: metaData.composer ?? '',
      key: metaData.key ?? '',
      meter: Array.isArray(metaData.meter) ? metaData.meter.join(', ') : (metaData.meter ?? ''),
      number: metaData.number ?? '',
      tempo: metaData.tempoDisplay ?? '',
      title: metaData.title ?? '',
      extract_title: extractTitle,
      extract_filename: extractFilename,
      printed_extracts: printedExtracts,
      part_keys: partKeys,
      part_names: partNames,
      parts: partNames,
      watermark: '',
      current_year: String(new Date().getFullYear()),
    }

    return text.replaceAll(/\{\{([^}]+)\}\}/g, (match, key: string) => placeholders[key] ?? match)
  }

  // ---------------------------------------------------------------------------
  // Barnumbers
  // ---------------------------------------------------------------------------

  private _layoutBarnumbersCountnotes(
    voice: Voice,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
    visibleByPlayable: Map<PlayableEntity, boolean>,
  ): {
    barnumberBackgrounds: Ellipse[]
    barnumbers: Annotation[]
    countnoteBackgrounds: Ellipse[]
    countnotes: Annotation[]
  } {
    const barnumberBackgrounds: Ellipse[] = []
    const barnumbers: Annotation[] = []
    const countnoteBackgrounds: Ellipse[] = []
    const countnotes: Annotation[] = []
    const barnumberVoices = new Set((conf.get('barnumbers.voices') as number[] | undefined) ?? [])
    const countnoteVoices = new Set((conf.get('countnotes.voices') as number[] | undefined) ?? [])
    let measureStartBeat: number | null = null
    const visiblePlayables = voice.entities.filter(
      (entity): entity is PlayableEntity =>
        (entity.type === 'Note' || entity.type === 'Pause' || entity.type === 'SynchPoint') &&
        (visibleByPlayable.get(entity) ?? entity.visible),
    )

    for (const playable of visiblePlayables) {
      if (playable.measureStart || measureStartBeat === null) {
        measureStartBeat = playable.beat
      }

      const [baseX, y] = playableCenter(playable, beatMap, layout, startpos)
      const x = baseX + this._noteShift(
        playable,
        playableSize(playable, layout),
        voiceNr,
        extractNr,
        0,
        conf,
      )

      if (countnoteVoices.has(voiceNr)) {
        const countnoteText = this._countnoteText(playable, measureStartBeat, voiceNr, extractNr, conf)
        const offset = this._countnoteOffset(playable, layout, voiceNr, extractNr, conf)
        const style = (conf.get('countnotes.style') as string | undefined) ?? 'smaller'
        const side = this._countnoteSide(playable, voiceNr, extractNr, conf)
        const shiftEu = /^[aoveu]$/.test(countnoteText)
        const fontSize = layout.FONT_STYLE_DEF[style]?.fontSize ?? 10
        const shiftY = shiftEu ? fontSize * layout.MM_PER_POINT * 0.25 : 0
        const align: 'left' | 'right' = side === 'l' ? 'right' : 'left'
        const countnoteAlignKey = `extract.${extractNr}.notebound.countnote.v_${voiceNr}.t_${playable.time}.align`
        const countnotePosKey = `extract.${extractNr}.notebound.countnote.v_${voiceNr}.t_${playable.time}.pos`
        const countnoteConfKey = `extract.${extractNr}.notebound.countnote.v_${voiceNr}.t_${playable.time}.*`
        const annotation: Annotation = {
          type: 'Annotation',
          center: [x + offset[0], y + offset[1] - shiftY],
          text: countnoteText,
          style,
          align,
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          confKey: countnoteConfKey,
          visible: playable.visible,
          more_conf_keys: [
            {
              conf_key: countnoteAlignKey,
              text: 'countnote left',
              icon: 'fa fa-arrow-left',
              value: 'l',
            },
            {
              conf_key: countnoteAlignKey,
              text: 'countnote right',
              icon: 'fa fa-arrow-right',
              value: 'r',
            },
          ],
          draginfo: this._annotationDraginfo(undefined, countnotePosKey),
        }
        countnoteBackgrounds.push(
          this._annotationBackground(annotation, side === 'l' ? 'right' : 'left', layout, -0.05, shiftEu),
        )
        countnotes.push(annotation)
      }

      if (
        barnumberVoices.has(voiceNr) &&
        playable.measureStart &&
        playable.measureCount !== undefined
      ) {
        const offset = this._barnumberOffset(playable, layout, voiceNr, extractNr, conf)
        const side = this._barnumberSide(playable, voiceNr, extractNr, conf)
        const barnumber = playable.measureCount
        const barnumberAlignKey = `extract.${extractNr}.notebound.barnumber.v_${voiceNr}.t_${playable.time}.align`
        const barnumberPosKey = `extract.${extractNr}.notebound.barnumber.v_${voiceNr}.t_${playable.time}.pos`
        const barnumberConfKey = `extract.${extractNr}.notebound.barnumber.v_${voiceNr}.t_${playable.time}.*`

        const annotation: Annotation = {
          type: 'Annotation',
          center: [x + offset[0], y + offset[1]],
          text: `${(conf.get('barnumbers.prefix') as string | undefined) ?? ''}${barnumber}`,
          style: (conf.get('barnumbers.style') as string | undefined) ?? 'small_bold',
          align: side === 'l' ? 'right' : 'left',
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          confKey: barnumberConfKey,
          visible: playable.visible,
          more_conf_keys: [
            {
              conf_key: barnumberAlignKey,
              text: 'barnumber left',
              icon: 'fa fa-arrow-left',
              value: 'l',
            },
            {
              conf_key: barnumberAlignKey,
              text: 'barnumber right',
              icon: 'fa fa-arrow-right',
              value: 'r',
            },
          ],
          draginfo: this._annotationDraginfo(undefined, barnumberPosKey),
        }
        barnumberBackgrounds.push(this._annotationBackground(annotation, side === 'l' ? 'right' : 'left', layout, 0.2))
        barnumbers.push(annotation)
      }
    }

    return { barnumberBackgrounds, barnumbers, countnoteBackgrounds, countnotes }
  }

  private _countnoteText(
    playable: PlayableEntity,
    measureStartBeat: number,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
  ): string {
    const fallback = playable.countNote ?? computeCountnoteText(playable, measureStartBeat)
    const leftPattern = conf.get('countnotes.cntextleft') as string | undefined
    const rightPattern = conf.get('countnotes.cntextright') as string | undefined
    const patterns = [leftPattern, rightPattern].filter((pattern): pattern is string => pattern !== undefined)
    if (patterns.length === 0) return fallback

    const side = this._countnoteSide(playable, voiceNr, extractNr, conf)
    const pattern = side === 'l'
      ? (patterns[0] ?? fallback)
      : (patterns[patterns.length - 1] ?? fallback)
    const text = pattern
      .replaceAll('{lyrics}', playable.lyrics ?? '')
      .replaceAll('{countnote}', fallback)
    return text === '' ? '~' : text
  }

  private _countnoteOffset(
    playable: PlayableEntity,
    layout: LayoutConfig,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
  ): [number, number] {
    const overrideKey = `notebound.countnote.v_${voiceNr}.t_${playable.time}`
    const overridePos = conf.get(`${overrideKey}.pos`) as [number, number] | undefined
    if (overridePos) return overridePos

    const fixedPos = (conf.get('countnotes.pos') as [number, number] | undefined) ?? [3, -2]
    const autoPos = (conf.get('countnotes.autopos') as boolean | undefined) ?? true
    if (!autoPos) return fixedPos

    const side = this._countnoteSide(playable, voiceNr, extractNr, conf)
    const bottomup = (conf.get('layout.bottomup') as boolean | undefined) ?? layout.bottomup ?? false
    const apanchor = (conf.get('countnotes.apanchor') as string | undefined) ?? 'box'
    const apbase = (conf.get('countnotes.apbase') as [number, number] | undefined) ?? [1, -0.5]
    const size = playableSize(playable, layout)
    const proxy = playableLayoutProxy(playable)
    const sizeWithDot: [number, number] = [
      size[0] + (playableDotted(playable, layout) ? 1 : 0),
      size[1],
    ]
    const tieOffset = side === 'r' && (playable.tieStart || playable.tieEnd) ? 1 : 0
    const dsizeY = apanchor === 'center' ? 0 : size[1]
    const x = tieOffset + (side === 'l' ? -(size[0] + apbase[0]) : sizeWithDot[0] + apbase[0])
    const y = bottomup ? -(dsizeY + apbase[1] + 2) : dsizeY + apbase[1]
    return [x, y]
  }

  private _countnoteSide(
    playable: PlayableEntity,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
  ): 'l' | 'r' {
    const overrideKey = `notebound.countnote.v_${voiceNr}.t_${playable.time}`
    const overrideAlign = conf.get(`${overrideKey}.align`) as 'l' | 'r' | 'auto' | undefined
    if (overrideAlign && overrideAlign !== 'auto') return overrideAlign

    const layout = conf.get('layout') as LayoutConfig
    const bottomup = (conf.get('layout.bottomup') as boolean | undefined) ?? layout.bottomup ?? false
    const previous = playable.prevPlayable ?? playable
    const next = playable.nextPlayable ?? playable
    const previousX = playableX(previous, layout)
    const currentX = playableX(playable, layout)
    const nextX = playableX(next, layout)
    const sides = bottomup
      ? computeNotePosition(nextX, currentX, previousX).reverse() as ['l' | 'r', 'l' | 'r']
      : computeNotePosition(previousX, currentX, nextX)
    return sides[1]
  }

  private _barnumberOffset(
    playable: PlayableEntity,
    layout: LayoutConfig,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
  ): [number, number] {
    const overrideKey = `notebound.barnumber.v_${voiceNr}.t_${playable.time}`
    const overridePos = conf.get(`${overrideKey}.pos`) as [number, number] | undefined
    if (overridePos) return overridePos

    const fixedPos = (conf.get('barnumbers.pos') as [number, number] | undefined) ?? [6, -4]
    const autoPos = (conf.get('barnumbers.autopos') as boolean | undefined) ?? true
    if (!autoPos) return fixedPos

    const side = this._barnumberSide(playable, voiceNr, extractNr, conf)
    const bottomup = (conf.get('layout.bottomup') as boolean | undefined) ?? layout.bottomup ?? false
    const apanchor = (conf.get('barnumbers.apanchor') as string | undefined) ?? 'box'
    const apbase = (conf.get('barnumbers.apbase') as [number, number] | undefined) ?? [1, 1]
    const size = playableSize(playable, layout)
    const sizeWithDot: [number, number] = [
      size[0] + (playableDotted(playable, layout) ? 1 : 0),
      size[1],
    ]
    const previous = playable.prevPlayable ?? playable
    const next = playable.nextPlayable ?? playable
    const previousX = playableX(previous, layout)
    const currentX = playableX(playable, layout)
    const nextX = playableX(next, layout)
    const tieOffset = side === 'r' && (playable.tieStart || playable.tieEnd) ? 1 : 0
    const dsizeY = apanchor === 'center' ? 0 : size[1]
    const x = tieOffset + (side === 'l' ? -(size[0] + apbase[0]) : sizeWithDot[0] + apbase[0])
    const y = bottomup ? dsizeY + apbase[1] : -(dsizeY + apbase[1] + 2.7)
    return [x, y]
  }

  private _barnumberSide(
    playable: PlayableEntity,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
  ): 'l' | 'r' {
    const overrideKey = `notebound.barnumber.v_${voiceNr}.t_${playable.time}`
    const overrideAlign = conf.get(`${overrideKey}.align`) as 'l' | 'r' | 'auto' | undefined
    if (overrideAlign && overrideAlign !== 'auto') return overrideAlign

    const layout = conf.get('layout') as LayoutConfig
    const bottomup = (conf.get('layout.bottomup') as boolean | undefined) ?? layout.bottomup ?? false
    const previous = playable.prevPlayable ?? playable
    const next = playable.nextPlayable ?? playable
    const previousX = playableX(previous, layout)
    const currentX = playableX(playable, layout)
    const nextX = playableX(next, layout)
    const [defaultSide] = bottomup
      ? computeNotePosition(nextX, currentX, previousX).reverse() as ['l' | 'r', 'l' | 'r']
      : computeNotePosition(previousX, currentX, nextX)
    return defaultSide
  }

  // ---------------------------------------------------------------------------
  // Images
  // ---------------------------------------------------------------------------

  private _layoutImages(conf: Confstack, extractNr: number | string): Image[] {
    const result: Image[] = []
    const images = conf.get('images') as Record<string, unknown> | undefined

    if (!images) return result

    for (const [nr, entry] of Object.entries(images)) {
      const img = entry as { show?: boolean; imagename?: string; pos?: [number, number]; height?: number }
      if (!img.show || !img.imagename || !img.pos || !img.height) continue
      const imageUrl = this._imageResolver?.(img.imagename)
        ?? (isPracticeQrImageName(img.imagename) ? undefined : img.imagename)
      if (imageUrl === undefined) continue

      result.push({
        type: 'Image',
        url: imageUrl,
        position: img.pos,
        height: img.height,
        color: 'black',
        lineWidth: 0,
        visible: true,
        confKey: `extract.${extractNr}.images.${nr}.pos`,
        more_conf_keys: [],
        draginfo: {
          handler: 'annotation',
          conf_key: `extract.${extractNr}.images.${nr}.pos`,
          height_conf_key: `extract.${extractNr}.images.${nr}.height`,
          height: img.height,
        },
      })
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Instrument shape (stub — instrument-specific logic post-migration)
  // ---------------------------------------------------------------------------

  private _layoutInstrument(conf: Confstack, extractNr: number | string): DrawableElement[] {
    const shape = conf.get('instrument_shape') as string | undefined
    const layout = conf.get('layout') as LayoutConfig

    if (!shape) return []

    // Parse JSON path data and return as Path drawable
    try {
      const pathData = JSON.parse(shape) as [number, number][]
      return [{
        type: 'Path',
        path: pathData,
        fill: false,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        visible: true,
        more_conf_keys: [],
      }]
    } catch {
      return []
    }
  }

  // ---------------------------------------------------------------------------
  // Cutmarks
  // ---------------------------------------------------------------------------

  private _layoutCutmarks(pageFormat: 'A3' | 'A4', conf: Confstack): Annotation[] {
    if (pageFormat === 'A3') return []

    const result: Annotation[] = []
    const layout = conf.get('layout') as LayoutConfig
    const a4Pages = (conf.get('printer.a4_pages') as number[] | undefined) ?? []
    const xSpacing = layout.X_SPACING
    const pageBreaks = a4Pages.filter((page) => page > 0)
    if (pageBreaks.length === 0) return result

    for (const page of pageBreaks) {
      const x = 0.25 * xSpacing + layout.X_OFFSET + 12 * xSpacing * page

      result.push({
        type: 'Annotation',
        center: [x, 4],
        text: 'x',
        style: 'small',
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        visible: true,
      })
      result.push({
        type: 'Annotation',
        center: [x, 290],
        text: 'x',
        style: 'small',
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        visible: true,
      })
    }

    return result
  }

  private _layoutVoiceRepeatSigns(
    voice: Voice,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
  ): Annotation[] {
    const repeatVoices = new Set((conf.get('repeatsigns.voices') as number[] | undefined) ?? [])
    if (!repeatVoices.has(voiceNr)) return []

    const result: Annotation[] = []

    for (const entity of voice.entities) {
      if (entity.type !== 'Goto') continue
      const goto = entity as Goto
      if (!goto.from || !goto.to) continue

      const begin = this._makeRepeatSignAnnotation(
        goto,
        'begin',
        beatMap,
        layout,
        startpos,
        voiceNr,
        extractNr,
        conf,
      )
      const end = this._makeRepeatSignAnnotation(
        goto,
        'end',
        beatMap,
        layout,
        startpos,
        voiceNr,
        extractNr,
        conf,
      )

      result.push(end, begin)
    }

    return result
  }

  private _makeRepeatSignAnnotation(
    goto: Goto,
    pointRole: 'begin' | 'end',
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
  ): Annotation {
    const companion = pointRole === 'begin' ? goto.to : goto.from
    const attachSide = this._repeatSignAttachSide(goto, pointRole)
    const pos = (
      conf.get(`repeatsigns.${attachSide}.pos`) as [number, number] | undefined
    ) ?? (attachSide === 'left' ? [-7, -2] : [5, -2])
    const text = (
      conf.get(`repeatsigns.${attachSide}.text`) as string | undefined
    ) ?? (attachSide === 'left' ? '|:' : ':|')
    const style = (
      conf.get(`repeatsigns.${attachSide}.style`) as string | undefined
    ) ?? 'bold'
    const confBase = `extract.${extractNr}.notebound.repeat_${pointRole}.v_${voiceNr}.${companion.time}`

    return {
      type: 'Annotation',
      center: [
        playableCenter(companion, beatMap, layout, startpos)[0] + pos[0],
        playableCenter(companion, beatMap, layout, startpos)[1] + pos[1],
      ],
      text,
      style,
      color: layout.color.color_default,
      lineWidth: layout.LINE_THIN,
      confKey: `${confBase}.pos`,
      visible: goto.visible,
      more_conf_keys: [],
      draginfo: this._annotationDraginfo(),
    }
  }

  private _repeatSignAttachSide(goto: Goto, pointRole: 'begin' | 'end'): 'left' | 'right' {
    if (pointRole === 'begin') {
      const companion = goto.to
      if (goto.to === goto.from) return 'left'
      const nextPitch = companion.nextPitch ?? companion.pitch
      return companion.pitch <= nextPitch ? 'left' : 'right'
    }

    const companion = goto.from
    if (goto.to === goto.from) return 'right'
    const prevPitch = companion.prevPitch ?? companion.pitch
    return prevPitch <= companion.pitch ? 'right' : 'left'
  }

  private _layoutVoiceNoteboundAnnotations(
    voice: Voice,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    voiceNr: number,
    extractNr: number | string,
    conf: Confstack,
    showJumplines: boolean,
  ): Annotation[] {
    const result: Annotation[] = []

    const annotationEntities = voice.entities
      .filter((entity): entity is NoteBoundAnnotation | NewPart =>
        entity.type === 'NoteBoundAnnotation' || entity.type === 'NewPart',
      )

    const existingVariantEndTimes = new Set(
      annotationEntities
        .filter((entity): entity is NoteBoundAnnotation =>
          entity.type === 'NoteBoundAnnotation' && entity.policy === 'Goto',
        )
        .map((entity) => entity.companion.time),
    )

    for (const entity of voice.entities) {
      if (entity.type !== 'Goto' || entity.policy.isRepeat !== true || entity.to.variant !== 2) continue
      if (existingVariantEndTimes.has(entity.to.time)) continue
      annotationEntities.push({
        type: 'NoteBoundAnnotation' as const,
        beat: entity.to.beat,
        time: entity.to.time,
        startPos: entity.startPos,
        endPos: entity.endPos,
        decorations: [],
        barDecorations: [],
        visible: true,
        variant: 0,
        znId: `layout-variantend-${voiceNr}-${entity.to.time}`,
        companion: entity.to,
        text: String(entity.to.variant),
        position: [-4, -7],
        style: 'regular',
        policy: 'Goto',
        confKey: `notebound.variantend.v_${voiceNr}.${entity.to.time}`,
      })
      existingVariantEndTimes.add(entity.to.time)
    }

    annotationEntities.sort((a, b) => {
      const aIsPartname = a.type === 'NewPart' || (a.type === 'NoteBoundAnnotation' && a.confKey?.includes('notebound.partname') === true)
      const bIsPartname = b.type === 'NewPart' || (b.type === 'NoteBoundAnnotation' && b.confKey?.includes('notebound.partname') === true)
      if (aIsPartname !== bIsPartname) return aIsPartname ? -1 : 1
      if (a.type !== b.type) return a.type === 'NewPart' ? -1 : 1
      if (a.type !== 'NoteBoundAnnotation' || b.type !== 'NoteBoundAnnotation') return 0
      if (a.policy === b.policy) return 0
      return a.policy === 'Goto' ? -1 : 1
    })

    for (const entity of annotationEntities) {
      if (entity.type !== 'NoteBoundAnnotation' && entity.type !== 'NewPart') continue
      if (entity.type === 'NoteBoundAnnotation' && entity.policy === 'Goto' && !showJumplines) continue

      const companion = entity.companion
      const center: [number, number] = [
        ...playableCenter(companion, beatMap, layout, startpos),
      ]

      let text = ''
      let style = 'regular'
      let offset: [number, number] = [5, -7]
      let confBase = ''

      if (entity.type === 'NoteBoundAnnotation') {
        const annotation = entity as NoteBoundAnnotation
        // Legacy keeps empty [P:] markers as drawable annotations. Retain the
        // empty text so its annotation/background remains non-visible while
        // still interrupting the flowline.
        text = annotation.text
        style = annotation.style
        offset = annotation.position
        const annotationConfKey = annotation.confKey ?? `notebound.annotation.v_${voiceNr}.${companion.time}`
        confBase = activeExtractConfKey(extractNr, annotationConfKey)
      } else {
        const part = entity as NewPart
        text = part.name
        style = 'bold'
        offset = [-4, -7]
        confBase = `extract.${extractNr}.notebound.partname.v_${voiceNr}.${companion.time}`
      }

      const localConfBase = confBase.replace(/^extract\.\d+\./, '')
      const configuredOffset = conf.get(`${localConfBase}.pos`) as [number, number] | undefined
      const configuredStyle = conf.get(`${localConfBase}.style`) as string | undefined
      const show = conf.get(`${localConfBase}.show`) as boolean | undefined
      if (show === false) continue

      result.push({
        type: 'Annotation',
        center: [center[0] + (configuredOffset ?? offset)[0], center[1] + (configuredOffset ?? offset)[1]],
        text,
        style: configuredStyle ?? style,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        // Legacy keeps note-bound annotations drawable even when their
        // companion is an invisible pause.
        visible: true,
        confKey: `${confBase}.pos`,
        draginfo: this._annotationDraginfo(configuredOffset ?? offset, `${confBase}.pos`),
        more_conf_keys: [],
      })
    }

    return result
  }
}
