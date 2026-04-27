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
} from '@zupfnoter/types'
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
  DurationKey,
  LayoutConfig,
} from '@zupfnoter/types'
import { buildConfstack } from './buildConfstack.js'
import { computeBeatCompression, type BeatCompressionMap } from './BeatPacker.js'
import type { Confstack } from './Confstack.js'
import { requireDefined } from './requireDefined.js'

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

/** Beat → Y position in mm via BeatCompressionMap */
function beatToY(beat: number, beatMap: BeatCompressionMap, layout: LayoutConfig, startpos: number): number {
  const compressed = beatMap[beat] ?? beat
  return compressed * layout.Y_SCALE + startpos
}

/** Duration (SHORTEST_NOTE scale) → DurationKey. Duration is already on the correct scale. */
function durationToKey(duration: number): DurationKey {
  const key = `d${duration}` as DurationKey
  const valid: DurationKey[] = ['d64','d48','d32','d24','d16','d12','d8','d6','d4','d3','d2','d1']
  return valid.includes(key) ? key : 'err'
}

/** Variant number → color string */
function variantToColor(variant: 0 | 1 | 2, layout: LayoutConfig): string {
  if (variant === 1) return layout.color.color_variant1
  if (variant === 2) return layout.color.color_variant2
  return layout.color.color_default
}

// ---------------------------------------------------------------------------
// HarpnotesLayout
// ---------------------------------------------------------------------------

export class HarpnotesLayout {
  private _config: ZupfnoterConfig

  constructor(config: ZupfnoterConfig) {
    this._config = config
  }

  /**
   * Main entry point: Song → Sheet.
   * Corresponds to Layout::Default#layout in harpnotes.rb.
   */
  layout(song: Song, extractNr: number | string = 0, pageFormat: 'A3' | 'A4' = 'A4'): Sheet {
    const conf = this._layoutPrepareOptions(extractNr)
    const layout = this._config.layout

    // 1. Images
    const resImages = this._layoutImages(conf, extractNr)

    // 2. Voices (notes, pauses, flowlines, gotos, tuplets, barnumbers)
    const { activeVoices, voiceElements, beatMaps } = this._layoutVoices(song, conf)

    // 3. Synchlines
    const resSynchLines = this._layoutSynchLines(song, beatMaps, conf)

    // 4. Legend
    const resLegend = this._layoutLegend(song.metaData, conf, extractNr)

    // 5. Sheet annotations
    const resAnnotations = this._layoutAnnotations(conf, extractNr)

    // 6. Lyrics (collected from voice elements pass)
    const resLyrics = this._layoutLyrics(song, beatMaps, conf)

    // 7. Sheetmarks
    const resSheetmarks = this._layoutSheetmarks(layout)

    // 8. Cutmarks
    const resCutmarks = this._layoutCutmarks(pageFormat, conf)

    // 9. Instrument shape
    const resInstrument = this._layoutInstrument(conf, extractNr)

    const children: DrawableElement[] = [
      ...resImages,
      ...resSynchLines,
      ...voiceElements,
      ...resLegend,
      ...resAnnotations,
      ...resLyrics,
      ...resSheetmarks,
      ...resCutmarks,
      ...resInstrument,
    ]

    return { children, activeVoices }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  private _layoutPrepareOptions(extractNr: number | string): Confstack {
    return buildConfstack(this._config, extractNr)
  }

  // ---------------------------------------------------------------------------
  // Voices
  // ---------------------------------------------------------------------------

  private _layoutVoices(
    song: Song,
    conf: Confstack,
  ): { activeVoices: number[]; voiceElements: DrawableElement[]; beatMaps: Map<number, BeatCompressionMap> } {
    const layout = this._config.layout
    const activeVoiceNrs = (conf.get('extract.voices') as number[] | undefined) ?? [1]
    const flowlineVoices = new Set((conf.get('extract.flowlines') as number[] | undefined) ?? [])
    const subflowlineVoices = new Set((conf.get('extract.subflowlines') as number[] | undefined) ?? [])
    const jumplineVoices = new Set((conf.get('extract.jumplines') as number[] | undefined) ?? [])
    const layoutlineVoices = (conf.get('extract.layoutlines') as number[] | undefined) ?? activeVoiceNrs
    const startpos = (conf.get('extract.startpos') as number | undefined) ?? 15

    // Compute beat compression for all layout voices.
    // layoutlineVoices contains 1-based voice numbers (from config);
    // computeBeatCompression expects 0-based indices into song.voices.
    const layoutlineIndices = layoutlineVoices.map(v => v - 1)
    const beatCompressionMap = computeBeatCompression(song, layoutlineIndices, conf)

    const beatMaps = new Map<number, BeatCompressionMap>()
    const voiceElements: DrawableElement[] = []
    const activeVoices: number[] = []

    for (const voiceNr of activeVoiceNrs) {
      // voices are 1-based in config, 0-based in song.voices
      const voiceIdx = voiceNr - 1
      const voice = song.voices[voiceIdx]
      if (!voice) continue

      activeVoices.push(voiceNr)
      beatMaps.set(voiceNr, beatCompressionMap)

      const showFlowlines = flowlineVoices.has(voiceNr)
      const showSubflowlines = subflowlineVoices.has(voiceNr)
      const showJumplines = jumplineVoices.has(voiceNr)

      const elements = this._layoutVoice(
        voice,
        beatCompressionMap,
        voiceNr,
        layout,
        startpos,
        showFlowlines,
        showSubflowlines,
        showJumplines,
      )
      voiceElements.push(...elements)
    }

    return { activeVoices, voiceElements, beatMaps }
  }

  private _layoutVoice(
    voice: Voice,
    beatMap: BeatCompressionMap,
    _voiceNr: number,
    layout: LayoutConfig,
    startpos: number,
    showFlowlines: boolean,
    showSubflowlines: boolean,
    showJumplines: boolean,
  ): DrawableElement[] {
    const result: DrawableElement[] = []

    // Layout all playables
    for (const entity of voice.entities) {
      if (entity.type === 'Note') {
        result.push(this._layoutNote(entity as Note, beatMap, layout, startpos))
      } else if (entity.type === 'Pause') {
        const glyph = this._layoutPause(entity as Pause, beatMap, layout, startpos)
        if (glyph) result.push(glyph)
      } else if (entity.type === 'SynchPoint') {
        const sp = entity as SynchPoint
        for (const note of sp.notes) {
          result.push(this._layoutNote(note, beatMap, layout, startpos))
        }
      }
    }

    // Flowlines
    if (showFlowlines) {
      result.push(...this._layoutVoiceFlowlines(voice, beatMap, layout, startpos, 'solid'))
    }
    if (showSubflowlines) {
      result.push(...this._layoutVoiceFlowlines(voice, beatMap, layout, startpos, 'dashed'))
    }

    // Gotos (jumplines)
    if (showJumplines) {
      result.push(...this._layoutVoiceGotos(voice, beatMap, layout, startpos))
    }

    // Tuplets
    result.push(...this._layoutVoiceTuplets(voice, beatMap, layout, startpos))

    // Barnumbers
    result.push(...this._layoutBarnumbers(voice, beatMap, layout, startpos))

    return result
  }

  // ---------------------------------------------------------------------------
  // Note / Pause
  // ---------------------------------------------------------------------------

  private _layoutNote(
    note: Note,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
  ): Ellipse {
    const x = pitchToX(note.pitch, layout)
    const y = beatToY(note.beat, beatMap, layout, startpos)
    const dKey = durationToKey(note.duration)
    const style = layout.DURATION_TO_STYLE[dKey]
    const effectiveStyle = style !== undefined
      ? style
      : requireDefined(
        layout.DURATION_TO_STYLE['err'],
        'HarpnotesLayout._layoutNote(): missing fallback duration style "err"',
      )
    const color = variantToColor(note.variant, layout)

    return {
      type: 'Ellipse',
      center: [x, y],
      size: [layout.ELLIPSE_SIZE[0] * effectiveStyle.sizeFactor, layout.ELLIPSE_SIZE[1] * effectiveStyle.sizeFactor],
      fill: effectiveStyle.fill,
      dotted: effectiveStyle.dotted,
      hasbarover: effectiveStyle.hasbarover ?? false,
      color,
      lineWidth: layout.LINE_THICK,
      visible: note.visible,
      confKey: note.confKey,
      origin: note,
    }
  }

  private _layoutPause(
    pause: Pause,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
  ): Glyph | null {
    if (pause.invisible) return null

    const x = pitchToX(pause.pitch, layout)
    const y = beatToY(pause.beat, beatMap, layout, startpos)
    const dKey = durationToKey(pause.duration)
    const restStyle = layout.REST_TO_GLYPH?.[dKey] ?? layout.REST_TO_GLYPH?.['err']
    if (!restStyle) return null

    const color = variantToColor(pause.variant, layout)

    return {
      type: 'Glyph',
      center: [x, y],
      size: [layout.REST_SIZE[0] * restStyle.scale[0], layout.REST_SIZE[1] * restStyle.scale[1]],
      glyphName: restStyle.glyphName,
      dotted: restStyle.dotted,
      fill: 'filled',
      color,
      lineWidth: layout.LINE_THICK,
      visible: pause.visible,
      confKey: pause.confKey,
    }
  }

  // ---------------------------------------------------------------------------
  // Flowlines
  // ---------------------------------------------------------------------------

  private _layoutVoiceFlowlines(
    voice: Voice,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    style: 'solid' | 'dashed',
  ): FlowLine[] {
    const result: FlowLine[] = []
    const playables = voice.entities.filter(
      (e): e is PlayableEntity => e.type === 'Note' || e.type === 'Pause' || e.type === 'SynchPoint',
    )

    let prev: PlayableEntity | null = null
    for (const curr of playables) {
      if (prev && !curr.firstInPart) {
        const fromX = pitchToX(prev.pitch, layout)
        const fromY = beatToY(prev.beat, beatMap, layout, startpos)
        const toX = pitchToX(curr.pitch, layout)
        const toY = beatToY(curr.beat, beatMap, layout, startpos)

        result.push({
          type: 'FlowLine',
          from: [fromX, fromY],
          to: [toX, toY],
          style,
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: curr.visible && prev.visible,
        })
      }
      prev = curr
    }
    return result
  }

  // ---------------------------------------------------------------------------
  // Gotos (Jumplines)
  // ---------------------------------------------------------------------------

  private _layoutVoiceGotos(
    voice: Voice,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
  ): Path[] {
    const result: Path[] = []

    for (const entity of voice.entities) {
      if (entity.type !== 'Goto') continue
      const goto = entity as Goto

      const fromNote = goto.from
      const toNote = goto.to
      if (!fromNote || !toNote) continue

      const fromX = pitchToX(fromNote.pitch, layout)
      const fromY = beatToY(fromNote.beat, beatMap, layout, startpos)
      const toX = pitchToX(toNote.pitch, layout)
      const toY = beatToY(toNote.beat, beatMap, layout, startpos)

      const distance = goto.policy?.distance ?? -10
      const vertX = fromX + distance

      // Jumpline: from → vertical column → to (L-shaped path)
      result.push({
        type: 'Path',
        path: [
          [fromX, fromY],
          [vertX, fromY],
          [vertX, toY],
          [toX, toY],
        ],
        fill: false,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THICK,
        visible: true,
      })

      // Arrowhead at destination (filled triangle)
      const arrowSize = 2
      result.push({
        type: 'Path',
        path: [
          [toX, toY],
          [toX - arrowSize, toY - arrowSize],
          [toX + arrowSize, toY - arrowSize],
        ],
        fill: true,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THICK,
        visible: true,
      })
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Tuplets
  // ---------------------------------------------------------------------------

  private _layoutVoiceTuplets(
    voice: Voice,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
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
        const x1 = pitchToX(tupletStart.pitch, layout)
        const y1 = beatToY(tupletStart.beat, beatMap, layout, startpos)
        const x2 = pitchToX(p.pitch, layout)
        const y2 = beatToY(p.beat, beatMap, layout, startpos)
        const bracketY = Math.min(y1, y2) - 3

        // Bracket path
        result.push({
          type: 'Path',
          path: [
            [x1, y1 - 2],
            [x1, bracketY],
            [x2, bracketY],
            [x2, y2 - 2],
          ],
          fill: false,
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: true,
        })

        // Tuplet number annotation
        result.push({
          type: 'Annotation',
          center: [(x1 + x2) / 2, bracketY - 1],
          text: String(tupletNum),
          style: 'smaller',
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: true,
        })

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
  ): FlowLine[] {
    const result: FlowLine[] = []
    const layout = this._config.layout
    const startpos = (conf.get('extract.startpos') as number | undefined) ?? 15
    const synchlinePairs = (conf.get('extract.synchlines') as number[][] | undefined) ?? []

    for (const [v1Nr, v2Nr] of synchlinePairs) {
      if (v1Nr === undefined || v2Nr === undefined) continue
      const voice1 = song.voices[v1Nr - 1]
      const voice2 = song.voices[v2Nr - 1]
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
          from: [pitchToX(p1.pitch, layout), beatToY(beat, beatMap1, layout, startpos)],
          to:   [pitchToX(p2.pitch, layout), beatToY(beat, beatMap2, layout, startpos)],
          style: 'dotted',
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: p1.visible && p2.visible,
        })
      }
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Sheetmarks
  // ---------------------------------------------------------------------------

  private _layoutSheetmarks(layout: LayoutConfig): DrawableElement[] {
    const result: DrawableElement[] = []
    const width = layout.DRAWING_AREA_SIZE[0]
    const height = layout.DRAWING_AREA_SIZE[1]

    // Mark C strings (red) and F strings (blue) across the full pitch range
    // C = MIDI mod 12 === 0, F = MIDI mod 12 === 5
    for (let pitch = 0; pitch <= 127; pitch++) {
      const x = pitchToX(pitch, layout)
      if (x < 0 || x > width) continue

      const mod = pitch % 12
      if (mod !== 0 && mod !== 5) continue

      const isC = mod === 0
      result.push({
        type: 'Path',
        path: [[x, 0], [x, height]],
        fill: false,
        color: isC ? 'red' : 'blue',
        lineWidth: layout.LINE_THIN / 2,
        visible: true,
      })
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Legend
  // ---------------------------------------------------------------------------

  private _layoutLegend(
    metaData: SongMetaData,
    conf: Confstack,
    _extractNr: number | string,
  ): Annotation[] {
    const result: Annotation[] = []
    const layout = this._config.layout
    const legendConf = conf.get('extract.legend') as Record<string, unknown> | undefined

    const pos = (legendConf?.['pos'] as [number, number] | undefined) ?? [2, 2]
    const style = (legendConf?.['style'] as string | undefined) ?? 'regular'

    const lines: string[] = []
    if (metaData.title)    lines.push(metaData.title)
    if (metaData.composer) lines.push(metaData.composer)
    if (metaData.meter)    lines.push(metaData.meter)
    if (metaData.key)      lines.push(metaData.key)
    if (metaData.tempo)    lines.push(`♩=${metaData.tempo}`)

    if (lines.length === 0) return result

    result.push({
      type: 'Annotation',
      center: pos,
      text: lines.join('\n'),
      style,
      color: layout.color.color_default,
      lineWidth: layout.LINE_THIN,
      visible: true,
    })

    return result
  }

  // ---------------------------------------------------------------------------
  // Lyrics
  // ---------------------------------------------------------------------------

  private _layoutLyrics(
    song: Song,
    beatMaps: Map<number, BeatCompressionMap>,
    conf: Confstack,
  ): Annotation[] {
    const result: Annotation[] = []
    const layout = this._config.layout
    const startpos = (conf.get('extract.startpos') as number | undefined) ?? 15
    const activeVoiceNrs = (conf.get('extract.voices') as number[] | undefined) ?? [1]

    for (const voiceNr of activeVoiceNrs) {
      const voice = song.voices[voiceNr - 1]
      if (!voice) continue
      const beatMap = beatMaps.get(voiceNr)
      if (!beatMap) continue

      for (const entity of voice.entities) {
        if (entity.type !== 'Note' && entity.type !== 'SynchPoint') continue
        const playable = entity as PlayableEntity
        if (!playable.lyrics) continue

        const x = pitchToX(playable.pitch, layout)
        const y = beatToY(playable.beat, beatMap, layout, startpos)

        result.push({
          type: 'Annotation',
          center: [x, y + layout.ELLIPSE_SIZE[1] + 2],
          text: playable.lyrics,
          style: 'small',
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: playable.visible,
        })
      }
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Sheet annotations
  // ---------------------------------------------------------------------------

  private _layoutAnnotations(conf: Confstack, _extractNr: number | string): Annotation[] {
    const result: Annotation[] = []
    const layout = this._config.layout
    const notes = conf.get('extract.notes') as Record<string, unknown> | undefined

    if (!notes) return result

    for (const [, entry] of Object.entries(notes)) {
      const ann = entry as { pos?: [number, number]; text?: string; style?: string }
      if (!ann.pos || !ann.text) continue

      result.push({
        type: 'Annotation',
        center: ann.pos,
        text: ann.text,
        style: ann.style ?? 'regular',
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        visible: true,
      })
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Barnumbers
  // ---------------------------------------------------------------------------

  private _layoutBarnumbers(
    voice: Voice,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
  ): Annotation[] {
    const result: Annotation[] = []

    for (const entity of voice.entities) {
      if (entity.type !== 'Note' && entity.type !== 'Pause' && entity.type !== 'SynchPoint') continue
      const playable = entity as PlayableEntity
      if (!playable.measureStart || !playable.measureCount) continue

      const x = pitchToX(playable.pitch, layout)
      const y = beatToY(playable.beat, beatMap, layout, startpos)

      result.push({
        type: 'Annotation',
        center: [x - layout.ELLIPSE_SIZE[0] - 1, y],
        text: String(playable.measureCount),
        style: 'smaller',
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        visible: playable.visible,
      })
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Images
  // ---------------------------------------------------------------------------

  private _layoutImages(conf: Confstack, extractNr: number | string): Image[] {
    const result: Image[] = []
    const images = conf.get('extract.images') as Record<string, unknown> | undefined

    if (!images) return result

    for (const [nr, entry] of Object.entries(images)) {
      const img = entry as { show?: boolean; imagename?: string; pos?: [number, number]; height?: number }
      if (!img.show || !img.imagename || !img.pos || !img.height) continue

      result.push({
        type: 'Image',
        url: img.imagename,
        position: img.pos,
        height: img.height,
        color: 'black',
        lineWidth: 0,
        visible: true,
        confKey: `extract.${extractNr}.images.${nr}.pos`,
      })
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Instrument shape (stub — instrument-specific logic post-migration)
  // ---------------------------------------------------------------------------

  private _layoutInstrument(conf: Confstack, _extractNr: number | string): DrawableElement[] {
    const shape = conf.get('extract.instrument_shape') as string | undefined

    if (!shape) return []

    // Parse JSON path data and return as Path drawable
    try {
      const pathData = JSON.parse(shape) as [number, number][]
      return [{
        type: 'Path',
        path: pathData,
        fill: false,
        color: this._config.layout.color.color_default,
        lineWidth: this._config.layout.LINE_THIN,
        visible: true,
      }]
    } catch {
      return []
    }
  }

  // ---------------------------------------------------------------------------
  // Cutmarks
  // ---------------------------------------------------------------------------

  private _layoutCutmarks(pageFormat: 'A3' | 'A4', conf: Confstack): Path[] {
    if (pageFormat === 'A3') return []

    const result: Path[] = []
    const layout = this._config.layout
    const a4Pages = (conf.get('printer.a4Pages') as number[] | undefined)
      ?? this._config.printer.a4Pages
    const xSpacing = layout.X_SPACING
    const height = layout.DRAWING_AREA_SIZE[1]

    for (let i = 1; i < a4Pages.length; i++) {
      const x = i * 12 * xSpacing

      result.push({
        type: 'Path',
        path: [[x, 0], [x, height]],
        fill: false,
        color: 'grey',
        lineWidth: layout.LINE_THIN / 2,
        visible: true,
      })
    }

    return result
  }
}
