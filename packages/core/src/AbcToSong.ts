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
  NewPart,
  Chordsymbol,
  NoteBoundAnnotation,
  Goto,
  GotoPolicy,
  BeatMap,
  SongMetaData,
} from '@zupfnoter/types'
import type { ZupfnoterConfig } from '@zupfnoter/types'
import type { AbcModel, AbcVoice, AbcSymbol } from './AbcModel.js'
import { ABC_TYPE } from './AbcModel.js'
import { requireDefined } from './requireDefined.js'

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
  /** Remaining notes in the current tuplet group (0 = not in a tuplet). */
  tupletRemaining: number
  variantAnchor: PlayableEntity | null
  pendingVariantEntrySources: PlayableEntity[]
  pendingVariantExitSources: PlayableEntity[]
  awaitingVariantContinuation: boolean
  variantSectionNo: 0 | 1 | 2
  pendingVariantEndingText: string | null
  pendingVariantEndingDuration: number | null
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
    tupletRemaining: 0,
    variantAnchor: null,
    pendingVariantEntrySources: [],
    pendingVariantExitSources: [],
    awaitingVariantContinuation: false,
    variantSectionNo: 0,
    pendingVariantEndingText: null,
    pendingVariantEndingDuration: null,
  }
}

// ---------------------------------------------------------------------------
// AbcToSong
// ---------------------------------------------------------------------------

export class AbcToSong {
  private _beatResolution = 192
  private _shortestNote = 64
  private _config: ZupfnoterConfig | null = null

  /**
   * Transform an AbcModel into a Song.
   *
   * @param model   Output of AbcParser.parse()
   * @param config  Zupfnoter configuration (for beat resolution etc.)
   */
  transform(model: AbcModel, config: ZupfnoterConfig): Song {
    this._config = config
    this._beatResolution = config.layout.BEAT_RESOLUTION ?? 192
    this._shortestNote = config.layout.SHORTEST_NOTE ?? 64

    const restpositionConfig = config as unknown as Record<string, Record<string, unknown>>
    const restpositionDefault =
      (restpositionConfig['restposition']?.['default'] as string | undefined) ?? 'center'

    const voices = model.voices.map((v, idx) => this._transformVoice(v, idx, model, restpositionDefault))
    const beatMaps = this._buildBeatMaps(voices)
    const metaData = this._extractMetaData(model)
    const harpnoteOptions = this._extractHarpnoteOptions(model)

    return { voices, beatMaps, metaData, harpnoteOptions }
  }

  // ---------------------------------------------------------------------------
  // Voice transformation
  // ---------------------------------------------------------------------------

  private _transformVoice(voice: AbcVoice, voiceIndex: number, model: AbcModel, restpositionDefault = 'center'): Voice {
    const wmeasure = voice.voice_properties.meter.wmeasure
    const state = createVoiceState(wmeasure)

    this._investigateFirstBar(voice, state, model)

    const entities: VoiceEntity[] = []

    for (let i = 0; i < voice.symbols.length; i++) {
      const sym = requireDefined(voice.symbols[i], `AbcToSong: missing symbol at voice ${voiceIndex}, index ${i}`)
      const typeName = model.music_types[sym.type] ?? ''

      const result = this._transformSymbol(sym, i, voiceIndex, typeName, state, model)
      if (result) {
        entities.push(...(Array.isArray(result) ? result : [result]))
      }
    }

    // Befülle prevPitch/nextPitch und prevPlayable/nextPlayable auf allen Playables
    this._annotateNeighbourPitches(entities)

    // Setze Pause-Pitch basierend auf restposition-Konfiguration
    this._applyRestposition(entities, restpositionDefault)

    return {
      index: voiceIndex,
      name: voice.voice_properties.name,
      showVoice: true,
      showFlowline: true,
      showJumpline: true,
      entities,
    }
  }

  /**
   * Setzt Nachbar-Referenzen auf allen Playable-Entitäten einer Stimme:
   * - `prevPitch` / `nextPitch`: Pitch-Werte für BeatPacker (pack_method 1 + 3)
   * - `prevPlayable` / `nextPlayable`: Objekt-Referenzen für Layout-Engine
   *
   * Entspricht `prev_playable` / `next_playable` im Legacy-System.
   * Achtung: zirkuläre Referenzen — bei JSON-Serialisierung durch znId ersetzen.
   */
  private _annotateNeighbourPitches(entities: VoiceEntity[]): void {
    const playables = entities.filter(
      (e): e is PlayableEntity => 'pitch' in e && 'duration' in e,
    )
    for (let i = 0; i < playables.length; i++) {
      const p = requireDefined(playables[i], `AbcToSong._annotateNeighbourPitches(): missing playable at index ${i}`)
      const prev = playables[i - 1]
      const next = playables[i + 1]
      if (prev) {
        p.prevPitch = prev.pitch
        p.prevPlayable = prev
      }
      if (next) {
        p.nextPitch = next.pitch
        p.nextPlayable = next
      }
    }
  }

  /**
   * Setzt den Pitch jeder Pause basierend auf der restposition-Konfiguration.
   *
   * Entspricht `$conf['restposition.default']` im Legacy-System.
   * Muss nach `_annotateNeighbourPitches` aufgerufen werden.
   *
   * - `'center'`: Durchschnitt von prevPlayable.pitch und nextPlayable.pitch
   * - `'next'`:   nextPlayable.pitch (Fallback: prevPlayable.pitch)
   * - `'previous'`: prevPlayable.pitch (Fallback: nextPlayable.pitch)
   */
  private _applyRestposition(entities: VoiceEntity[], mode: string): void {
    for (const entity of entities) {
      if (entity.type !== 'Pause') continue
      const pause = entity as Pause
      const prev = pause.prevPlayable
      const next = pause.nextPlayable

      let pitch: number
      if (mode === 'next') {
        pitch = next?.pitch ?? prev?.pitch ?? 60
      } else if (mode === 'previous') {
        pitch = prev?.pitch ?? next?.pitch ?? 60
      } else {
        // 'center' (default)
        if (prev && next) {
          pitch = Math.round((prev.pitch + next.pitch) / 2)
        } else {
          pitch = prev?.pitch ?? next?.pitch ?? 60
        }
      }
      pause.pitch = pitch
    }
  }

  private _transformSymbol(
    sym: AbcSymbol,
    index: number,
    voiceIndex: number,
    typeName: string,
    state: VoiceState,
    _model: AbcModel,
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
    const { tuplet, tupletStart, tupletEnd } = this._parseTuplet(sym, state)
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
      result = [requireDefined(mappedNotes[0], 'AbcToSong._transformNote(): expected note at index 0')]
    } else {
      const first = requireDefined(mappedNotes[0], 'AbcToSong._transformNote(): expected first note in synch point')
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

    const entity = requireDefined(result[0], 'AbcToSong._transformNote(): expected transformed entity')

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
    if (state.nextRepeatStart) {
      entity.firstInPart = true
      state.repetitionStack.push(entity)
      state.nextRepeatStart = false
    }

    state.previousNote = entity

    // Chord symbols and annotations from extra
    const barMarks = this._consumePendingBarMarks(entity, state, _voiceIndex, sym)
    const extras = this._transformExtras(sym, entity, state, _voiceIndex)
    const gotos = this._resolvePendingVariantGotos(entity, state, _voiceIndex, sym)

    return [entity, ...barMarks, ...extras, ...gotos]
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
      // Initial pitch=60; overwritten by _applyRestposition() after neighbour annotation.
      pitch: 60,
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
    if (state.nextRepeatStart) {
      pause.firstInPart = true
      state.repetitionStack.push(pause)
      state.nextRepeatStart = false
    }
    const barMarks = this._consumePendingBarMarks(pause, state, voiceIndex, sym)
    const extras = this._transformExtras(sym, pause, state, voiceIndex)
    const gotos = this._resolvePendingVariantGotos(pause, state, voiceIndex, sym)
    return [pause, ...barMarks, ...extras, ...gotos]
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

    const isRepeatBar = sym.bar_type?.includes(':') ?? false
    const hasVariantStart = typeof sym.rbstart === 'number' && sym.rbstart > 0 && !isRepeatBar
    const variantLabel = sym.text?.trim() ?? ''
    const startsVariantSection = sym.bar_type === '[|:' || hasVariantStart

    // Volta bracket entry / exit gotos.
    if (hasVariantStart && state.previousNote) {
      const nextVariantNo = (state.variantSectionNo + 1) as 1 | 2
      if (state.variantSectionNo === 0) {
        state.variantAnchor = state.previousNote
        state.pendingVariantEntrySources.push(state.previousNote)
      } else if (state.variantAnchor) {
        state.pendingVariantExitSources.push(state.previousNote)
        state.pendingVariantEntrySources.push(state.variantAnchor)
      }
      state.awaitingVariantContinuation = false
      state.variantSectionNo = nextVariantNo
      state.variantNo = nextVariantNo
    }
    if (startsVariantSection && state.previousNote) {
      state.pendingVariantEndingText = variantLabel
      state.pendingVariantEndingDuration = sym.bar_type === '[|:' ? 64 : null
    }
    if (sym.rbstop && !isRepeatBar && !hasVariantStart) {
      if (state.previousNote && state.variantSectionNo > 0) {
        state.pendingVariantExitSources.push(state.previousNote)
      }
      state.awaitingVariantContinuation = state.pendingVariantExitSources.length > 0
      state.variantNo = 0
      if (state.awaitingVariantContinuation) {
        state.variantSectionNo = 0
      }
    }

    // Repeat end → Goto
    if (sym.bar_type && sym.bar_type.startsWith(':') && state.previousNote) {
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

    // Repeat start → mark the next playable as repetition anchor.
    if (sym.bar_type && sym.bar_type.endsWith(':')) {
      state.nextRepeatStart = true
    }

    if (state.previousNote) {
      result.push(...this._transformExtras(sym, state.previousNote, state, voiceIndex))
    }

    return result
  }

  private _consumePendingBarMarks(
    companion: PlayableEntity,
    state: VoiceState,
    voiceIndex: number,
    sym: AbcSymbol,
  ): VoiceEntity[] {
    if (state.pendingVariantEndingText === null) return []

    const annotation: NoteBoundAnnotation & { duration: number } = {
      type: 'NoteBoundAnnotation' as const,
      beat: this._timeToBeat(sym.time),
      time: sym.time,
      startPos: this._charposToLineCol(sym.istart),
      endPos: this._charposToLineCol(sym.iend),
      decorations: [],
      barDecorations: [],
      visible: true,
      variant: 0,
      znId: `annot-variantend-${voiceIndex}-${sym.istart}`,
      companion,
      text: state.pendingVariantEndingText,
      position: this._getDefaultNoteBoundPosition('variantend', [5, -7]),
      style: 'regular',
      policy: 'Goto',
      confKey: `notebound.variantend.v_${voiceIndex + 1}.${companion.time}`,
      duration: state.pendingVariantEndingDuration ?? companion.duration,
    }

    companion.firstInPart = true
    state.pendingVariantEndingText = null
    state.pendingVariantEndingDuration = null

    if (state.variantEndings.length === 0) {
      state.variantEndings.push([])
    }
    state.variantEndings[state.variantEndings.length - 1]?.push({ rbstart: companion })

    return [annotation]
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

  private _resolvePendingVariantGotos(
    target: PlayableEntity,
    state: VoiceState,
    voiceIndex: number,
    sym: AbcSymbol,
  ): Goto[] {
    const result: Goto[] = []
    const sources = [...state.pendingVariantEntrySources]
    state.pendingVariantEntrySources = []

    if (state.awaitingVariantContinuation && state.pendingVariantExitSources.length > 0) {
      sources.push(...state.pendingVariantExitSources)
      state.pendingVariantExitSources = []
      state.awaitingVariantContinuation = false
      state.variantAnchor = null
      state.variantSectionNo = 0
    }

    for (let idx = 0; idx < sources.length; idx++) {
      const source = requireDefined(
        sources[idx],
        `AbcToSong._resolvePendingVariantGotos(): missing source at index ${idx}`,
      )
      if (source === target) continue
        result.push({
        type: 'Goto' as const,
        beat: target.beat,
        time: sym.time,
        startPos: this._charposToLineCol(sym.istart),
        endPos: this._charposToLineCol(sym.iend),
        decorations: [],
        barDecorations: [],
        visible: true,
        variant: 0,
        znId: `goto-${voiceIndex}-${sym.istart}-${idx}`,
        from: source,
        to: target,
          policy: { isRepeat: true } as GotoPolicy,
        })
    }

    return result
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
    if (!sym.a_gch) return []
    const result: VoiceEntity[] = []
    const voiceId = voiceIndex + 1

    for (let extraIndex = 0; extraIndex < sym.a_gch.length; extraIndex++) {
      const extra = requireDefined(
        sym.a_gch[extraIndex],
        `AbcToSong._transformExtras(): missing extra at index ${extraIndex}`,
      )
      const text = extra.text ?? ''
      if (!text) continue

      // Chord symbol: abc2svg type 'g' (gchordfont), all others are annotations
      if (extra.type === 'g') {
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
        const parsedAnnotation = this._parseInlineAnnotation(text, voiceId, companion.time, extraIndex)
        if (!parsedAnnotation) continue

        const annotation: NoteBoundAnnotation = {
          type: 'NoteBoundAnnotation' as const,
          beat: this._timeToBeat(sym.time),
          time: sym.time,
          startPos: this._charposToLineCol(sym.istart),
          endPos: this._charposToLineCol(sym.iend),
          decorations: [],
          barDecorations: [],
          visible: true,
          variant: 0,
          znId: `annot-${voiceIndex}-${sym.istart}`,
          companion,
          text: parsedAnnotation.text,
          position: parsedAnnotation.position,
          style: parsedAnnotation.style,
          policy: parsedAnnotation.policy,
          confKey: parsedAnnotation.confKey,
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
      number: info['X']?.split('\n')[0],
      filename: info['F']?.split('\n')[0],
      meter: info['M']?.split('\n')[0],
      key: info['K']?.split('\n')[0],
      tempo: info['Q'] ? this._parseTempo(info['Q']) : undefined,
      tempoDisplay: info['Q']?.split('\n')[0],
      checksum: model.checksum,
    }
  }

  private _extractHarpnoteOptions(model: AbcModel): Record<string, unknown> {
    const info = model.info
    const lyrics = info['W']
      ? {
        text: info['W']
          .split('\n')
          .map((line) => line.trimEnd()),
      }
      : undefined

    return {
      ...(lyrics ? { lyrics } : {}),
    }
  }

  private _parseTempo(q: string): number | undefined {
    const match = /(\d+)/.exec(q)
    return match ? parseInt(requireDefined(match[1], 'AbcToSong._parseTempo(): missing tempo digits'), 10) : undefined
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Convert abc2svg duration units to Zupfnoter duration units (SHORTEST_NOTE scale). */
  private _convertDuration(abcDur: number): number {
    return Math.min(128, Math.round((abcDur * this._shortestNote) / ABC2SVG_DURATION_FACTOR))
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

  private _parseDecorations(_sym: AbcSymbol): string[] {
    // abc2svg stores decorations in sym.a_dd[] with specific type ids
    // Phase 2: return empty array — full decoration parsing in later iteration
    return []
  }

  private _parseTuplet(sym: AbcSymbol, state: VoiceState): { tuplet: number; tupletStart: boolean; tupletEnd: boolean } {
    const tplet = (sym as Record<string, unknown>)['tplet'] as { r?: number; p?: number } | undefined

    if (tplet) {
      // This symbol starts a new tuplet group. p = number of notes in the group.
      const groupSize = tplet.p ?? 3
      state.tupletRemaining = groupSize
    }

    if (state.tupletRemaining <= 0) {
      return { tuplet: 1, tupletStart: false, tupletEnd: false }
    }

    const tuplet = tplet ? (tplet.p ?? 3) : state.tupletRemaining
    const tupletStart = tplet !== undefined
    state.tupletRemaining--
    const tupletEnd = state.tupletRemaining === 0

    return { tuplet, tupletStart, tupletEnd }
  }

  private _parseLyrics(sym: AbcSymbol): string | null {
    const lyric = (sym as Record<string, unknown>)['lyric'] as Array<{ text?: string }> | undefined
    if (!lyric || lyric.length === 0) return null
    return lyric.map((l) => l.text ?? '').join('')
  }

  private _parseInlineAnnotation(
    rawText: string,
    voiceId: number,
    companionTime: number,
    extraIndex: number,
  ): { text: string; position: [number, number]; style: string; confKey?: string; policy?: string } | null {
    // Legacy Zupfnoter used @@... as a deprecated pre-JSON marker. The legacy
    // Song export does not materialize it as a regular NoteBoundAnnotation.
    if (rawText.trim().startsWith('@@')) {
      return null
    }

    const match = rawText.match(/^([!#<>])([^@]+)?(?:@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?))?$/)
    if (!match) {
      return {
        text: rawText,
        position: [5, -7],
        style: 'regular',
        confKey: `notebound.annotation.v_${voiceId}.${companionTime}${extraIndex > 0 ? `.${extraIndex}` : ''}`,
      }
    }

    const semantic = requireDefined(match[1], 'AbcToSong._parseInlineAnnotation(): missing semantic marker')
    const token = match[2]?.trim() ?? ''
    const inlinePosition = match[3] !== undefined && match[4] !== undefined
      ? [Number.parseFloat(match[3]), Number.parseFloat(match[4])] as [number, number]
      : undefined

    if (semantic === '<' || semantic === '>') {
      return null
    }

    if (semantic === '!') {
      return {
        text: token,
        position: inlinePosition ?? [5, -7],
        style: 'regular',
        confKey: `notebound.annotation.v_${voiceId}.${companionTime}${extraIndex > 0 ? `.${extraIndex}` : ''}`,
      }
    }

    const annotations = this._config?.annotations ?? {}
    const configured = annotations[token]
    const configuredEntry = configured && typeof configured === 'object'
      ? configured as { text?: string; pos?: [number, number]; style?: string }
      : undefined

    return {
      text: configuredEntry?.text ?? token,
      position: inlinePosition ?? configuredEntry?.pos ?? [5, -7],
      style: configuredEntry?.style ?? 'regular',
      confKey: `notebound.annotation.v_${voiceId}.${companionTime}${extraIndex > 0 ? `.${extraIndex}` : ''}`,
    }
  }

  private _getDefaultNoteBoundPosition(kind: 'annotation' | 'partname' | 'variantend', fallback: [number, number]): [number, number] {
    const config = this._config as unknown as Record<string, unknown> | null
    const defaults = config?.['defaults']
    if (!defaults || typeof defaults !== 'object') return fallback
    const notebound = (defaults as Record<string, unknown>)['notebound']
    if (!notebound || typeof notebound !== 'object') return fallback
    const section = (notebound as Record<string, unknown>)[kind]
    if (!section || typeof section !== 'object') return fallback
    const pos = (section as Record<string, unknown>)['pos']
    if (
      Array.isArray(pos) &&
      pos.length === 2 &&
      typeof pos[0] === 'number' &&
      typeof pos[1] === 'number'
    ) {
      return [pos[0], pos[1]]
    }
    return fallback
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
