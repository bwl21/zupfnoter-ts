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

function playableCenter(
  playable: PlayableEntity,
  beatMap: BeatCompressionMap,
  layout: LayoutConfig,
  startpos: number,
): [number, number] {
  return [
    pitchToX(playable.pitch, layout),
    beatToY(playable.beat, beatMap, layout, startpos),
  ]
}

function playableSize(playable: PlayableEntity, layout: LayoutConfig): [number, number] {
  if (playable.type === 'Pause') {
    const dKey = durationToKey(playable.duration)
    const restStyle = layout.REST_TO_GLYPH[dKey] ?? layout.REST_TO_GLYPH['err']
    if (!restStyle) return layout.REST_SIZE
    return [layout.REST_SIZE[0] * restStyle.scale[0], layout.REST_SIZE[1] * restStyle.scale[1]]
  }

  const dKey = durationToKey(playable.duration)
  const style = layout.DURATION_TO_STYLE[dKey] ?? requireDefined(
    layout.DURATION_TO_STYLE['err'],
    'HarpnotesLayout.playableSize(): missing fallback duration style "err"',
  )
  return [layout.ELLIPSE_SIZE[0] * style.sizeFactor, layout.ELLIPSE_SIZE[1] * style.sizeFactor]
}

function addPoint(point: [number, number], offset: [number, number]): [number, number] {
  return [point[0] + offset[0], point[1] + offset[1]]
}

function orientationX(delta: number): -1 | 1 {
  return delta < 0 ? -1 : 1
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

function makeSheetmarkPath(center: [number, number]): [number, number][] {
  const [x, y] = center
  return [
    [x, y],
    [x - 1, y + 4],
    [x + 1, y + 4],
    [x, y],
  ]
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
    const layout = conf.get('layout') as LayoutConfig

    // 1. Images
    const resImages = this._layoutImages(conf, extractNr)

    // 2. Voices (notes, pauses, flowlines, gotos, tuplets, barnumbers)
    const { activeVoices, voiceElements, beatMaps } = this._layoutVoices(song, conf)

    // 3. Synchlines
    const resSynchLines = this._layoutSynchLines(song, beatMaps, conf)

    // 4. Legend
    const resLegend = this._layoutLegend(song.metaData, conf, extractNr)

    // 5. System annotations
    const resZnAnnotations = this._layoutZnAnnotations(song.metaData)

    // 6. Lyrics
    const resLyrics = this._layoutLyrics(song, beatMaps, conf)

    // 7. Sheet annotations
    const resAnnotations = this._layoutAnnotations(conf, extractNr)

    // 8. Sheetmarks
    const resSheetmarks = this._layoutSheetmarks(conf)

    // 9. Cutmarks
    const resCutmarks = this._layoutCutmarks(pageFormat, conf)

    // 10. Instrument shape
    const resInstrument = this._layoutInstrument(conf, extractNr)

    const children: DrawableElement[] = [
      ...resImages,
      ...voiceElements,
      ...resSynchLines,
      ...resLegend,
      ...resZnAnnotations,
      ...resLyrics,
      ...resAnnotations,
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
    const layout = conf.get('layout') as LayoutConfig
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
      const nonflowrest = (conf.get('extract.nonflowrest') as boolean | undefined) ?? false
      const synchedPlayables = this._buildSynchedPlayableSet(song, activeVoiceNrs, conf)

      const elements = this._layoutVoice(
        voice,
        beatCompressionMap,
        voiceNr,
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
    conf: Confstack,
  ): Set<PlayableEntity> {
    const result = new Set<PlayableEntity>()
    const activeVoices = new Set(activeVoiceNrs)
    const synchlinePairs = (conf.get('extract.synchlines') as number[][] | undefined) ?? []

    for (const [leftVoiceNr, rightVoiceNr] of synchlinePairs) {
      if (leftVoiceNr === undefined || rightVoiceNr === undefined) continue
      if (!activeVoices.has(leftVoiceNr) || !activeVoices.has(rightVoiceNr)) continue

      const leftVoice = song.voices[leftVoiceNr - 1]
      const rightVoice = song.voices[rightVoiceNr - 1]
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
    conf: Confstack,
    layout: LayoutConfig,
    startpos: number,
    showFlowlines: boolean,
    showSubflowlines: boolean,
    showJumplines: boolean,
    nonflowrest: boolean,
    synchedPlayables: Set<PlayableEntity>,
  ): DrawableElement[] {
    const result: DrawableElement[] = []
    const repeatSignVoices = new Set((conf.get('extract.repeatsigns.voices') as number[] | undefined) ?? [])
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
        result.push(this._layoutNote(note, beatMap, layout, startpos, visibleByPlayable.get(note)))
      } else if (entity.type === 'Pause') {
        const pause = entity as Pause
        const glyph = this._layoutPause(pause, beatMap, layout, startpos, visibleByPlayable.get(pause))
        if (glyph) result.push(glyph)
      } else if (entity.type === 'SynchPoint') {
        const sp = entity as SynchPoint
        for (const note of sp.notes) {
          result.push(this._layoutNote(note, beatMap, layout, startpos, visibleByPlayable.get(sp)))
        }
      }
    }

    // Flowlines
    if (showFlowlines) {
      result.push(...this._layoutVoiceFlowlines(voice, beatMap, layout, startpos, 'solid', visibleByPlayable))
    }
    if (showSubflowlines) {
      result.push(...this._layoutVoiceFlowlines(voice, beatMap, layout, startpos, 'dashed', visibleByPlayable))
    }

    // Gotos (jumplines)
    if (showJumplines) {
      result.push(...this._layoutVoiceGotos(voice, beatMap, layout, startpos, repeatSignVoices.has(voiceNr), conf))
    }

    // Tuplets
    result.push(...this._layoutVoiceTuplets(voice, beatMap, layout, startpos))

    const { barnumbers, countnotes } = this._layoutBarnumbersCountnotes(
      voice,
      beatMap,
      layout,
      startpos,
      voiceNr,
      conf,
    )
    result.push(...barnumbers, ...countnotes)

    result.push(...this._layoutVoiceRepeatSigns(voice, beatMap, layout, startpos, voiceNr, conf))
    result.push(...this._layoutVoiceNoteboundAnnotations(voice, beatMap, layout, startpos, voiceNr, conf))

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
    visible = note.visible,
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
      visible,
      confKey: note.confKey,
      origin: note,
    }
  }

  private _layoutPause(
    pause: Pause,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    visible = pause.visible,
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
      visible,
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
    visibleByPlayable: Map<PlayableEntity, boolean>,
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
          visible: (visibleByPlayable.get(curr) ?? curr.visible) && (visibleByPlayable.get(prev) ?? prev.visible),
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
    hideRepeatGotos: boolean,
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

      const paths = this._makeLegacyJumplinePaths(goto, fromNote, toNote, beatMap, layout, startpos, conf)
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
    conf: Confstack,
  ): Path[] {
    let distance = this._resolveJumplineDistance(goto, conf)
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

    return [
      {
        type: 'Path',
        path: [p1, p2, lineCutEnd, vcp3, p3, p4Line],
        fill: false,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THICK,
        visible: true,
      },
      {
        type: 'Path',
        path: [
          p4,
          addPoint(p4, [2.5 * endOrientation, 1]),
          addPoint(p4, [2.5 * endOrientation, -1]),
        ],
        fill: true,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THICK,
        visible: true,
      },
      {
        type: 'Path',
        path: verticalCut === 0
          ? []
          : [
            vcp2,
            addPoint(vcp2, [0.5, 1.5 * verticalOrientation]),
            addPoint(vcp2, [-0.5, 1.5 * verticalOrientation]),
          ],
        fill: true,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THICK,
        visible: true,
      },
    ]
  }

  private _resolveJumplineDistance(goto: Goto, conf: Confstack): number {
    const confKey = goto.confKey ?? goto.policy?.confKey
    if (confKey) {
      const configuredDistance = conf.get(`extract.${confKey}`) ?? conf.get(confKey)
      if (typeof configuredDistance === 'number') return configuredDistance

      const legacyKey = confKey.replace(/(.*)\.(\d+)\.(\d+)\.(\w+)$/, '$1.$2.$4')
      if (legacyKey !== confKey) {
        const legacyConfiguredDistance = conf.get(`extract.${legacyKey}`) ?? conf.get(legacyKey)
        if (typeof legacyConfiguredDistance === 'number') return legacyConfiguredDistance
      }
    }

    return goto.policy?.distance ?? 1
  }

  private _computeJumplineVerticalCut(
    fromNote: PlayableEntity,
    toNote: PlayableEntity,
    configuredVerticalCut: number,
  ): number {
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

  private _layoutSheetmarks(conf: Confstack): DrawableElement[] {
    const result: DrawableElement[] = []
    const layout = conf.get('layout') as LayoutConfig
    const vpos = (conf.get('extract.stringnames.vpos') as number[] | undefined) ?? []
    const style = (conf.get('extract.stringnames.style') as string | undefined) ?? 'small'
    const labels = parseStringNamesText(conf.get('extract.stringnames.text') as string | undefined)
    const marks = (conf.get('extract.stringnames.marks.hpos') as number[] | undefined) ?? []
    const markVpos = (conf.get('extract.stringnames.marks.vpos') as number[] | undefined) ?? []

    for (const pitch of marks) {
      const x = pitchToX(pitch, layout)
      for (const y of markVpos) {
        result.push({
          type: 'Path',
          path: makeSheetmarkPath([x, y]),
          fill: true,
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: true,
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
            color: layout.color.color_default,
            lineWidth: layout.LINE_THIN,
            visible: true,
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
    const legendConf = conf.get('extract.legend') as Record<string, unknown> | undefined

    const titlePos = (legendConf?.['pos'] as [number, number] | undefined) ?? [320, 7]
    const titleStyle = (legendConf?.['tstyle'] as string | undefined) ?? 'large'
    const secondaryPos = (legendConf?.['spos'] as [number, number] | undefined) ?? [320, 27]
    const secondaryStyle = (legendConf?.['style'] as string | undefined) ?? 'regular'
    const extractTitle = (conf.get('extract.title') as string | undefined) ?? String(extractNr)

    if (metaData.title) {
      result.push({
        type: 'Annotation',
        center: titlePos,
        text: metaData.title,
        style: titleStyle,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        visible: true,
      })
    }

    const meter = metaData.meter ? `Takt: ${metaData.meter}${metaData.tempoDisplay ? ` (${metaData.tempoDisplay})` : ''}` : undefined
    const key = metaData.key ? `Tonart: ${metaData.key}` : undefined
    const secondaryText = [extractTitle, metaData.composer ?? '', meter, key]
      .filter((entry) => entry !== undefined)
      .join('\n')

    if (secondaryText) {
      result.push({
        type: 'Annotation',
        center: secondaryPos,
        text: secondaryText,
        style: secondaryStyle,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        visible: true,
      })
    }

    return result
  }

  private _layoutZnAnnotations(metaData: SongMetaData): Annotation[] {
    const filename = metaData.filename
    if (!filename) return []

    return [
      {
        type: 'Annotation',
        center: [150, 289],
        text: `${filename} - created by Zupfnoter`,
        style: 'smaller',
        color: this._config.layout.color.color_default,
        lineWidth: this._config.layout.LINE_THIN,
        visible: true,
      },
      {
        type: 'Annotation',
        center: [325, 289],
        text: 'Zupfnoter: https://www.zupfnoter.de',
        style: 'smaller',
        color: this._config.layout.color.color_default,
        lineWidth: this._config.layout.LINE_THIN,
        visible: true,
      },
    ]
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
    const layout = conf.get('layout') as LayoutConfig
    const startpos = (conf.get('extract.startpos') as number | undefined) ?? 15
    const activeVoiceNrs = (conf.get('extract.voices') as number[] | undefined) ?? [1]
    const lyricsConf = (conf.get('extract.lyrics') as Record<string, { verses?: number[]; pos?: [number, number]; style?: string }> | undefined) ?? {}
    const rawLyrics = song.harpnoteOptions?.['lyrics']

    if (rawLyrics && Object.keys(lyricsConf).length > 0) {
      const lyricsText = (rawLyrics as { text?: string[] }).text ?? []
      const verses = lyricsText.join('\n').replace(/\t/g, ' ').replace(/ +/g, ' ').split(/\n\n+/).map((entry) => entry.trim())

      for (const [key, entry] of Object.entries(lyricsConf)) {
        if (key === 'versepos' || !entry.pos) continue

        const text = (entry.verses ?? [])
          .map((verseNo) => {
            if (verseNo === 0) return verses[9998]
            if (verseNo < 0) return verses[verseNo]
            return verses[verseNo - 1]
          })
          .filter((verse): verse is string => typeof verse === 'string' && verse.length > 0)
          .join('\n\n')

        if (!text) continue
        result.push({
          type: 'Annotation',
          center: entry.pos,
          text,
          style: entry.style ?? 'regular',
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: true,
        })
      }

      return result
    }

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
    const layout = conf.get('layout') as LayoutConfig
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

  private _layoutBarnumbersCountnotes(
    voice: Voice,
    beatMap: BeatCompressionMap,
    layout: LayoutConfig,
    startpos: number,
    voiceNr: number,
    conf: Confstack,
  ): { barnumbers: Annotation[]; countnotes: Annotation[] } {
    const barnumbers: Annotation[] = []
    const countnotes: Annotation[] = []
    const barnumberVoices = new Set((conf.get('extract.barnumbers.voices') as number[] | undefined) ?? [])
    const countnoteVoices = new Set((conf.get('extract.countnotes.voices') as number[] | undefined) ?? [])
    let measureStartBeat: number | null = null

    for (const entity of voice.entities) {
      if (entity.type !== 'Note' && entity.type !== 'Pause' && entity.type !== 'SynchPoint') continue
      const playable = entity as PlayableEntity
      if (playable.measureStart || measureStartBeat === null) {
        measureStartBeat = playable.beat
      }

      const x = pitchToX(playable.pitch, layout)
      const y = beatToY(playable.beat, beatMap, layout, startpos)

      if (countnoteVoices.has(voiceNr)) {
        const countnoteText = this._countnoteText(playable, measureStartBeat, voiceNr, conf)
        const offset = this._countnoteOffset(playable, layout, voiceNr, conf)
        countnotes.push({
          type: 'Annotation',
          center: [x + offset[0], y + offset[1]],
          text: countnoteText,
          style: (conf.get('extract.countnotes.style') as string | undefined) ?? 'smaller',
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: playable.visible,
        })
      }

      if (barnumberVoices.has(voiceNr) && playable.measureStart && playable.measureCount) {
        const offset = this._barnumberOffset(playable, layout, voiceNr, conf)

        barnumbers.push({
          type: 'Annotation',
          center: [x + offset[0], y + offset[1]],
          text: `${(conf.get('extract.barnumbers.prefix') as string | undefined) ?? ''}${playable.measureCount}`,
          style: (conf.get('extract.barnumbers.style') as string | undefined) ?? 'small_bold',
          color: layout.color.color_default,
          lineWidth: layout.LINE_THIN,
          visible: playable.visible,
        })
      }
    }

    return { barnumbers, countnotes }
  }

  private _countnoteText(
    playable: PlayableEntity,
    measureStartBeat: number,
    voiceNr: number,
    conf: Confstack,
  ): string {
    const fallback = playable.countNote ?? computeCountnoteText(playable, measureStartBeat)
    const leftPattern = conf.get('extract.countnotes.cntextleft') as string | undefined
    const rightPattern = conf.get('extract.countnotes.cntextright') as string | undefined
    const patterns = [leftPattern, rightPattern].filter((pattern): pattern is string => pattern !== undefined)
    if (patterns.length === 0) return fallback

    const side = this._countnoteSide(playable, voiceNr, conf)
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
    conf: Confstack,
  ): [number, number] {
    const overrideKey = `extract.notebound.countnote.v_${voiceNr}.t_${playable.time}`
    const overridePos = conf.get(`${overrideKey}.pos`) as [number, number] | undefined
    if (overridePos) return overridePos

    const fixedPos = (conf.get('extract.countnotes.pos') as [number, number] | undefined) ?? [3, -2]
    const autoPos = (conf.get('extract.countnotes.autopos') as boolean | undefined) ?? true
    if (!autoPos) return fixedPos

    const side = this._countnoteSide(playable, voiceNr, conf)
    const bottomup = (conf.get('layout.bottomup') as boolean | undefined) ?? layout.bottomup ?? false
    const apanchor = (conf.get('extract.countnotes.apanchor') as string | undefined) ?? 'box'
    const apbase = (conf.get('extract.countnotes.apbase') as [number, number] | undefined) ?? [1, -0.5]
    const size = playableSize(playable, layout)
    const sizeWithDot: [number, number] = [
      size[0] + (playable.type === 'Note' && playable.duration % 3 === 0 ? 1 : 0),
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
    conf: Confstack,
  ): 'l' | 'r' {
    const overrideKey = `extract.notebound.countnote.v_${voiceNr}.t_${playable.time}`
    const overrideAlign = conf.get(`${overrideKey}.align`) as 'l' | 'r' | 'auto' | undefined
    if (overrideAlign && overrideAlign !== 'auto') return overrideAlign

    const layout = conf.get('layout') as LayoutConfig
    const bottomup = (conf.get('layout.bottomup') as boolean | undefined) ?? layout.bottomup ?? false
    const previous = playable.prevPlayable ?? playable
    const next = playable.nextPlayable ?? playable
    const previousX = pitchToX(previous.pitch, layout)
    const currentX = pitchToX(playable.pitch, layout)
    const nextX = pitchToX(next.pitch, layout)
    const sides = bottomup
      ? computeNotePosition(nextX, currentX, previousX).reverse() as ['l' | 'r', 'l' | 'r']
      : computeNotePosition(previousX, currentX, nextX)
    return sides[1]
  }

  private _barnumberOffset(
    playable: PlayableEntity,
    layout: LayoutConfig,
    voiceNr: number,
    conf: Confstack,
  ): [number, number] {
    const overrideKey = `extract.notebound.barnumber.v_${voiceNr}.t_${playable.time}`
    const overridePos = conf.get(`${overrideKey}.pos`) as [number, number] | undefined
    if (overridePos) return overridePos

    const fixedPos = (conf.get('extract.barnumbers.pos') as [number, number] | undefined) ?? [6, -4]
    const autoPos = (conf.get('extract.barnumbers.autopos') as boolean | undefined) ?? true
    if (!autoPos) return fixedPos

    const overrideAlign = conf.get(`${overrideKey}.align`) as 'l' | 'r' | 'auto' | undefined
    const bottomup = (conf.get('layout.bottomup') as boolean | undefined) ?? layout.bottomup ?? false
    const apanchor = (conf.get('extract.barnumbers.apanchor') as string | undefined) ?? 'box'
    const apbase = (conf.get('extract.barnumbers.apbase') as [number, number] | undefined) ?? [1, 1]
    const size = playableSize(playable, layout)
    const sizeWithDot: [number, number] = [
      size[0] + (playable.type === 'Note' && playable.duration % 3 === 0 ? 1 : 0),
      size[1],
    ]
    const previous = playable.prevPlayable ?? playable
    const next = playable.nextPlayable ?? playable
    const previousX = pitchToX(previous.pitch, layout)
    const currentX = pitchToX(playable.pitch, layout)
    const nextX = pitchToX(next.pitch, layout)
    const [defaultSide] = bottomup
      ? computeNotePosition(nextX, currentX, previousX).reverse() as ['l' | 'r', 'l' | 'r']
      : computeNotePosition(previousX, currentX, nextX)
    const side = overrideAlign && overrideAlign !== 'auto' ? overrideAlign : defaultSide
    const tieOffset = side === 'r' && (playable.tieStart || playable.tieEnd) ? 1 : 0
    const dsizeY = apanchor === 'center' ? 0 : size[1]
    const x = tieOffset + (side === 'l' ? -(size[0] + apbase[0]) : sizeWithDot[0] + apbase[0])
    const y = bottomup ? dsizeY + apbase[1] : -(dsizeY + apbase[1] + 2.7)
    return [x, y]
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

  private _layoutCutmarks(pageFormat: 'A3' | 'A4', conf: Confstack): Annotation[] {
    if (pageFormat === 'A3') return []

    const result: Annotation[] = []
    const layout = conf.get('layout') as LayoutConfig
    const a4Pages = (conf.get('printer.a4Pages') as number[] | undefined)
      ?? this._config.printer.a4Pages
    const xSpacing = layout.X_SPACING
    if (a4Pages.length <= 1) return result

    for (let i = 1; i < a4Pages.length; i++) {
      const x = 0.25 * xSpacing + layout.X_OFFSET + 12 * xSpacing * i

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
    conf: Confstack,
  ): Annotation[] {
    const repeatVoices = new Set((conf.get('extract.repeatsigns.voices') as number[] | undefined) ?? [])
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
        conf,
      )
      const end = this._makeRepeatSignAnnotation(
        goto,
        'end',
        beatMap,
        layout,
        startpos,
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
    conf: Confstack,
  ): Annotation {
    const companion = pointRole === 'begin' ? goto.to : goto.from
    const attachSide = this._repeatSignAttachSide(goto, pointRole)
    const pos = (
      conf.get(`extract.repeatsigns.${attachSide}.pos`) as [number, number] | undefined
    ) ?? (attachSide === 'left' ? [-7, -2] : [5, -2])
    const text = (
      conf.get(`extract.repeatsigns.${attachSide}.text`) as string | undefined
    ) ?? (attachSide === 'left' ? '|:' : ':|')
    const style = (
      conf.get(`extract.repeatsigns.${attachSide}.style`) as string | undefined
    ) ?? 'bold'

    return {
      type: 'Annotation',
      center: [
        pitchToX(companion.pitch, layout) + pos[0],
        beatToY(companion.beat, beatMap, layout, startpos) + pos[1],
      ],
      text,
      style,
      color: layout.color.color_default,
      lineWidth: layout.LINE_THIN,
      visible: goto.visible,
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
    conf: Confstack,
  ): Annotation[] {
    const result: Annotation[] = []

    for (const entity of voice.entities) {
      if (entity.type !== 'NoteBoundAnnotation' && entity.type !== 'NewPart') continue

      const companion = entity.companion
      const center: [number, number] = [
        pitchToX(companion.pitch, layout),
        beatToY(companion.beat, beatMap, layout, startpos),
      ]

      let text = ''
      let style = 'regular'
      let offset: [number, number] = [5, -7]
      let confBase = ''

      if (entity.type === 'NoteBoundAnnotation') {
        const annotation = entity as NoteBoundAnnotation
        text = annotation.text
        style = annotation.style
        offset = annotation.position
        confBase = annotation.confKey ?? `notebound.annotation.v_${voiceNr}.${companion.time}`
      } else {
        const part = entity as NewPart
        text = part.name
        style = 'bold'
        offset = [-4, -7]
        confBase = `notebound.partname.v_${voiceNr}.${companion.time}`
      }

      const configuredOffset = conf.get(`${confBase}.pos`) as [number, number] | undefined
      const configuredStyle = conf.get(`${confBase}.style`) as string | undefined
      const show = conf.get(`${confBase}.show`) as boolean | undefined
      if (show === false) continue

      result.push({
        type: 'Annotation',
        center: [center[0] + (configuredOffset ?? offset)[0], center[1] + (configuredOffset ?? offset)[1]],
        text,
        style: configuredStyle ?? style,
        color: layout.color.color_default,
        lineWidth: layout.LINE_THIN,
        visible: companion.visible,
      })
    }

    return result
  }
}
