/**
 * AbcToSong – transforms an AbcModel into a Song.
 *
 * This is Stufe 1 of the Zupfnoter transformation pipeline.
 * It works exclusively with AbcModel — no direct abc2svg access.
 *
 * Reference: abc2svg_to_harpnotes.rb (legacy)
 */

import type {
  Song,
  Voice,
  VoiceEntity,
  PlayableEntity,
  Note,
  Pause,
  SynchPoint,
  MeasureStart,
  NewPart,
  Chordsymbol,
  NoteBoundAnnotation,
  Goto,
  GotoPolicy,
  BeatMap,
  SongMetaData,
} from '@zupfnoter/types'
import type { ZupfnoterConfig } from '@zupfnoter/types'
import type { AbcModel, AbcVoice, AbcSymbol, AbcNote } from './AbcModel.js'
import { ABC_TYPE } from './AbcModel.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** abc2svg duration units for a whole note */
const ABC2SVG_DURATION_FACTOR = 1536

// ---------------------------------------------------------------------------
// Internal state per voice transformation
// ---------------------------------------------------------------------------

interface VoiceState {
  variantNo: 0 | 1 | 2
  tieStarted: boolean
  measureCount: number
  measureStartTime: number
  wmeasure: number
  nextMeasure: boolean
  nextRepeatStart: boolean
  repetitionStack: PlayableEntity[]
  variantEndings: Array<Array<{ rbstop?: PlayableEntity; rbstart?: PlayableEntity; distance?: number[]; repeatEnd?: boolean }>>
  pushedVariantEndingRepeat: boolean
  previousNote: PlayableEntity | null
  slurStack: string[]
  slurCounter: number
}

function createVoiceState(wmeasure: number): VoiceState {
  return {
    variantNo: 0,
    tieStarted: false,
    measureCount: 0,
    measureStartTime: 0,
    wmeasure,
    nextMeasure: false,
    nextRepeatStart: false,
    repetitionStack: [],
    variantEndings: [[]],
    pushedVariantEndingRepeat: false,
    previousNote: null,
    slurStack: [],
    slurCounter: 0,
  }
}

// ---------------------------------------------------------------------------
// AbcToSong
// ---------------------------------------------------------------------------

export class AbcToSong {
  private _beatResolution = 384
  private _shortestNote = 96

  /**
   * Transform an AbcModel into a Song.
   *
   * @param model   Output of AbcParser.parse()
   * @param config  Zupfnoter configuration (for beat resolution etc.)
   */
  transform(model: AbcModel, config: ZupfnoterConfig): Song {
    this._beatResolution = config.layout.BEAT_RESOLUTION ?? 384
    this._shortestNote = config.layout.SHORTEST_NOTE ?? 96

    const voices = model.voices.map((v, idx) => this._transformVoice(v, idx, model))
    const beatMaps = this._buildBeatMaps(voices)
    const metaData = this._extractMetaData(model)

    return { voices, beatMaps, metaData }
  }

  // ---------------------------------------------------------------------------
  // Voice transformation
  // ---------------------------------------------------------------------------

  private _transformVoice(voice: AbcVoice, voiceIndex: number, model: AbcModel): Voice {
    const wmeasure = voice.voice_properties.meter.wmeasure
    const state = createVoiceState(wmeasure)

    this._investigateFirstBar(voice, state, model)

    const entities: VoiceEntity[] = []

    for (let i = 0; i < voice.symbols.length; i++) {
      const sym = voice.symbols[i]!
      const typeName = model.music_types[sym.type] ?? ''

      const result = this._transformSymbol(sym, i, voiceIndex, typeName, state, model)
      if (result) {
        entities.push(...(Array.isArray(result) ? result : [result]))
      }
    }

    return {
      index: voiceIndex,
      name: voice.voice_properties.name,
      showVoice: true,
      showFlowline: true,
      showJumpline: true,
      entities,
    }
  }

  private _transformSymbol(
    sym: AbcSymbol,
    index: number,
    voiceIndex: number,
    typeName: string,
    state: VoiceState,
    model: AbcModel,
  ): VoiceEntity | VoiceEntity[] | null {
    switch (typeName) {
      case 'note':
        return this._transformNote(sym, index, voiceIndex, state)
      case 'rest':
        return this._transformRest(sym, index, voiceIndex, state)
      case 'bar':
        return this._transformBar(sym, index, voiceIndex, state)
      case 'part':
        return this._transformPart(sym, state)
      case 'tempo':
      case 'clef':
      case 'key':
      case 'meter':
      case 'staves':
      case 'yspace':
      case 'block':
      case 'remark':
      case 'grace':
        return null
      default:
        return null
    }
  }

  // ---------------------------------------------------------------------------
  // Note / SynchPoint
  // ---------------------------------------------------------------------------

  private _transformNote(
    sym: AbcSymbol,
    _index: number,
    _voiceIndex: number,
    state: VoiceState,
  ): VoiceEntity[] {
    const notes = sym.notes ?? []
    const duration = this._convertDuration(notes[0]?.dur ?? 384)
    const beat = this._timeToBeat(sym.time)
    const startPos = this._charposToLineCol(sym.istart)
    const endPos = this._charposToLineCol(sym.iend)
    const decorations = this._parseDecorations(sym)
    const { tuplet, tupletStart, tupletEnd } = this._parseTuplet(sym)
    const lyrics = this._parseLyrics(sym)
    const countNote = null

    const measureStart = state.nextMeasure
    if (state.nextMeasure) {
      state.measureCount++
      state.measureStartTime = sym.time
      state.nextMeasure = false
    }

    const mappedNotes: Note[] = notes.map((n) => ({
      type: 'Note' as const,
      beat,
      time: sym.time,
      startPos,
      endPos,
      decorations,
      barDecorations: [],
      visible: !(sym.invis ?? sym.invisible ?? false),
      variant: state.variantNo,
      znId: this._makeZnId(sym, _voiceIndex),
      duration,
      pitch: n.midi,
      tieStart: false,
      tieEnd: false,
      tuplet,
      tupletStart,
      tupletEnd,
      firstInPart: false,
      measureStart,
      measureCount: state.measureCount,
      jumpStarts: [],
      jumpEnds: [],
      slurStarts: [],
      slurEnds: [],
      countNote,
      lyrics,
    }))

    let result: PlayableEntity[]

    if (mappedNotes.length === 1) {
      result = [mappedNotes[0]!]
    } else {
      const first = mappedNotes[0]!
      const synch: SynchPoint = {
        type: 'SynchPoint' as const,
        beat,
        time: sym.time,
        startPos,
        endPos,
        decorations,
        barDecorations: [],
        visible: first.visible,
        variant: state.variantNo,
        znId: first.znId,
        duration,
        pitch: first.pitch,
        tieStart: false,
        tieEnd: false,
        tuplet,
        tupletStart,
        tupletEnd,
        firstInPart: false,
        measureStart,
        measureCount: state.measureCount,
        jumpStarts: [],
        jumpEnds: [],
        slurStarts: [],
        slurEnds: [],
        countNote,
        lyrics,
        notes: mappedNotes,
        synchedNotes: mappedNotes.slice(1),
      }
      result = [synch]
    }

    const entity = result[0]!

    // Handle ties
    entity.tieEnd = state.tieStarted
    state.tieStarted = sym.ti1 != null
    entity.tieStart = state.tieStarted

    // Handle slurs
    const slurStartCount = sym.slur_sls?.length ?? 0
    entity.slurStarts = Array.from({ length: slurStartCount }, () => this._pushSlur(state))
    const slurEndCount = sym.slur_end ?? 0
    entity.slurEnds = Array.from({ length: slurEndCount }, () => this._popSlur(state))

    // Repetition stack
    if (state.repetitionStack.length === 0) {
      state.repetitionStack.push(entity)
    }

    state.previousNote = entity

    // Chord symbols and annotations from extra
    const extras = this._transformExtras(sym, entity, state, _voiceIndex)

    return [entity, ...extras]
  }

  // ---------------------------------------------------------------------------
  // Rest / Pause
  // ---------------------------------------------------------------------------

  private _transformRest(
    sym: AbcSymbol,
    _index: number,
    voiceIndex: number,
    state: VoiceState,
  ): VoiceEntity[] {
    const duration = this._convertDuration(sym.dur ?? 384)
    const beat = this._timeToBeat(sym.time)
    const measureStart = state.nextMeasure

    if (state.nextMeasure) {
      state.measureCount++
      state.measureStartTime = sym.time
      state.nextMeasure = false
    }

    const pause: Pause = {
      type: 'Pause' as const,
      beat,
      time: sym.time,
      startPos: this._charposToLineCol(sym.istart),
      endPos: this._charposToLineCol(sym.iend),
      decorations: [],
      barDecorations: [],
      visible: !(sym.invis ?? sym.invisible ?? false),
      variant: state.variantNo,
      znId: this._makeZnId(sym, voiceIndex),
      duration,
      pitch: 60, // middle C as layout anchor for rests
      tieStart: false,
      tieEnd: false,
      tuplet: 1,
      tupletStart: false,
      tupletEnd: false,
      firstInPart: false,
      measureStart,
      measureCount: state.measureCount,
      jumpStarts: [],
      jumpEnds: [],
      slurStarts: [],
      slurEnds: [],
      countNote: null,
      lyrics: null,
      invisible: sym.invis ?? sym.invisible ?? false,
    }

    state.previousNote = pause
    return [pause]
  }

  // ---------------------------------------------------------------------------
  // Bar / MeasureStart + Goto
  // ---------------------------------------------------------------------------

  private _transformBar(
    sym: AbcSymbol,
    _index: number,
    voiceIndex: number,
    state: VoiceState,
  ): VoiceEntity[] {
    const result: VoiceEntity[] = []

    if (!(sym.invisible ?? false)) {
      state.nextMeasure = true
    }

    // Volta bracket start
    if (sym.rbstart === 2) {
      state.variantNo = Math.min(state.variantNo + 1, 2) as 0 | 1 | 2
    }

    // Repeat end → Goto
    if (sym.bar_type && /^:/.test(sym.bar_type) && state.previousNote) {
      const repeatStart = state.repetitionStack[state.repetitionStack.length - 1]
      if (repeatStart) {
        const goto: Goto = {
          type: 'Goto' as const,
          beat: this._timeToBeat(sym.time),
          time: sym.time,
          startPos: this._charposToLineCol(sym.istart),
          endPos: this._charposToLineCol(sym.iend),
          decorations: [],
          barDecorations: [],
          visible: true,
          variant: state.variantNo,
          znId: `goto-${voiceIndex}-${sym.istart}`,
          from: state.previousNote,
          to: repeatStart,
          policy: {} as GotoPolicy,
        }
        result.push(goto)
      }
    }

    // Repeat start → push to stack
    if (sym.bar_type && /:$/.test(sym.bar_type) && state.previousNote) {
      state.repetitionStack.push(state.previousNote)
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Part marker
  // ---------------------------------------------------------------------------

  private _transformPart(sym: AbcSymbol, state: VoiceState): VoiceEntity | null {
    if (!state.previousNote) return null

    const part: NewPart = {
      type: 'NewPart' as const,
      beat: this._timeToBeat(sym.time),
      time: sym.time,
      startPos: this._charposToLineCol(sym.istart),
      endPos: this._charposToLineCol(sym.iend),
      decorations: [],
      barDecorations: [],
      visible: true,
      variant: state.variantNo,
      znId: `part-${sym.istart}`,
      companion: state.previousNote,
      name: sym.text ?? '',
    }
    return part
  }

  // ---------------------------------------------------------------------------
  // Extra elements (chord symbols, annotations)
  // ---------------------------------------------------------------------------

  private _transformExtras(
    sym: AbcSymbol,
    companion: PlayableEntity,
    state: VoiceState,
    voiceIndex: number,
  ): VoiceEntity[] {
    if (!sym.extra) return []
    const result: VoiceEntity[] = []

    for (const extra of sym.extra) {
      const text = extra.text ?? ''
      if (!text) continue

      // Chord symbol: starts with uppercase letter (heuristic)
      if (/^[A-G]/.test(text)) {
        const chord: Chordsymbol = {
          type: 'Chordsymbol' as const,
          beat: this._timeToBeat(sym.time),
          time: sym.time,
          startPos: this._charposToLineCol(sym.istart),
          endPos: this._charposToLineCol(sym.iend),
          decorations: [],
          barDecorations: [],
          visible: true,
          variant: state.variantNo,
          znId: `chord-${voiceIndex}-${sym.istart}`,
          companion,
          text,
          position: [0, -5],
          style: 'large',
        }
        result.push(chord)
      } else {
        // Annotation
        const annotation: NoteBoundAnnotation = {
          type: 'NoteBoundAnnotation' as const,
          beat: this._timeToBeat(sym.time),
          time: sym.time,
          startPos: this._charposToLineCol(sym.istart),
          endPos: this._charposToLineCol(sym.iend),
          decorations: [],
          barDecorations: [],
          visible: true,
          variant: state.variantNo,
          znId: `annot-${voiceIndex}-${sym.istart}`,
          companion,
          text,
          position: [0, -3],
          style: 'small',
        }
        result.push(annotation)
      }
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // BeatMaps
  // ---------------------------------------------------------------------------

  private _buildBeatMaps(voices: Voice[]): BeatMap[] {
    return voices.map((voice, idx) => {
      const entries: Record<number, PlayableEntity> = {}
      for (const entity of voice.entities) {
        if (
          entity.type === 'Note' ||
          entity.type === 'Pause' ||
          entity.type === 'SynchPoint'
        ) {
          entries[entity.beat] = entity as PlayableEntity
        }
      }
      return { index: idx, entries }
    })
  }

  // ---------------------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------------------

  private _extractMetaData(model: AbcModel): SongMetaData {
    const info = model.info
    return {
      title: info['T']?.split('\n')[0],
      composer: info['C']?.split('\n')[0],
      meter: info['M']?.split('\n')[0],
      key: info['K']?.split('\n')[0],
      tempo: info['Q'] ? this._parseTempo(info['Q']) : undefined,
    }
  }

  private _parseTempo(q: string): number | undefined {
    const match = /(\d+)/.exec(q)
    return match ? parseInt(match[1]!, 10) : undefined
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Convert abc2svg duration units to Zupfnoter beat units */
  private _convertDuration(abcDur: number): number {
    return Math.round((abcDur * this._beatResolution) / ABC2SVG_DURATION_FACTOR)
  }

  /** Convert abc2svg time position to beat */
  private _timeToBeat(time: number): number {
    return Math.round((time * this._beatResolution) / ABC2SVG_DURATION_FACTOR)
  }

  /** Convert character offset to [line, column] (1-based) */
  private _charposToLineCol(_offset: number): [number, number] {
    // Phase 2: return placeholder — full implementation needs the ABC source text
    // This will be refined when AbcParser passes the source to AbcToSong
    return [1, 1]
  }

  private _makeZnId(sym: AbcSymbol, voiceIndex: number): string {
    return `${voiceIndex}-${sym.istart}`
  }

  private _parseDecorations(sym: AbcSymbol): string[] {
    // abc2svg stores decorations in sym.extra with specific type ids
    // Phase 2: return empty array — full decoration parsing in later iteration
    return []
  }

  private _parseTuplet(sym: AbcSymbol): { tuplet: number; tupletStart: boolean; tupletEnd: boolean } {
    const tplet = (sym as Record<string, unknown>)['tplet'] as { r?: number; p?: number } | undefined
    if (!tplet) return { tuplet: 1, tupletStart: false, tupletEnd: false }
    return {
      tuplet: tplet.p ?? 3,
      tupletStart: true,
      tupletEnd: false,
    }
  }

  private _parseLyrics(sym: AbcSymbol): string | null {
    const lyric = (sym as Record<string, unknown>)['lyric'] as Array<{ text?: string }> | undefined
    if (!lyric || lyric.length === 0) return null
    return lyric.map((l) => l.text ?? '').join('')
  }

  private _pushSlur(state: VoiceState): string {
    const id = `slur-${state.slurCounter++}`
    state.slurStack.push(id)
    return id
  }

  private _popSlur(state: VoiceState): string {
    return state.slurStack.pop() ?? `slur-end-${state.slurCounter++}`
  }

  private _investigateFirstBar(voice: AbcVoice, state: VoiceState, model: AbcModel): void {
    const barTypeId = model.music_type_ids['bar'] ?? ABC_TYPE.BAR
    const bars = voice.symbols.filter(
      (s) => s.type === barTypeId && !(s.invisible ?? false),
    )
    if (bars.length > 0 && bars[0] && state.wmeasure > 0) {
      state.measureStartTime = bars[0].time - state.wmeasure
      if (state.measureStartTime === 0) {
        state.nextMeasure = true
      }
    }
  }
}
