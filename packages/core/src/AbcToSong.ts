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
  SongDiagnostic,
  RestPositionConfig,
  RestPositionMode,
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
const INVALID_REMARK_ZNID_MESSAGE = 'illegal character in [r:] (must be of [a-z][a-z0.9_])'
const REMARK_ZNID_PATTERN = /^[a-z][a-zA-Z0-9_]*$/
const COUNT_NAMES: Array<string | number> = Array.from({ length: 32 }, (_, index) => [index + 1, 'e', 'u', 'e']).flat()

// ---------------------------------------------------------------------------
// Internal state per voice transformation
// ---------------------------------------------------------------------------

interface VoiceState {
  variantNo: 0 | 1 | 2
  tieStarted: boolean
  measureCount: number
  measureStartTime: number
  countBy: number | null
  wmeasure: number
  nextMeasure: boolean
  nextRepeatStart: boolean
  nextFirstInPart: boolean
  repetitionStack: PlayableEntity[]
  variantEndings: Array<Array<{ rbstop?: PlayableEntity; rbstart?: PlayableEntity; distance?: number[]; repeatEnd?: boolean }>>
  pushedVariantEndingRepeat: boolean
  previousNote: PlayableEntity | null
  slurStack: number[]
  slurCounter: number
  tupletP: number | null
  variantAnchor: PlayableEntity | null
  /** Goto-Distanzen zum Zeitpunkt der Setzung von variantAnchor. */
  variantAnchorDistances: number[] | null
  /**
   * Anstehende Varianten-Eintrittssprunglinien.
   * Jeder Eintrag speichert die Quelle und die zum Push-Zeitpunkt
   * gültigen Goto-Distanzen, damit spätere Reset-Vorgänge (z.B. durch
   * Wiederholungsenden oder nachfolgende @@-Marker) die Werte nicht
   * überschreiben.
   */
  pendingVariantEntrySources: Array<{ source: PlayableEntity; distances: number[] | null }>
  /**
   * Anstehende Varianten-Ausstrittssprunglinien.
   * Analog zu pendingVariantEntrySources speichert auch dieser Eintrag
   * die Source mit den zum Push-Zeitpunkt gültigen Distanzen.
   */
  pendingVariantExitSources: Array<{ source: PlayableEntity; distances: number[] | null }>
  awaitingVariantContinuation: boolean
  variantSectionNo: 0 | 1 | 2
  pendingVariantEndingText: string | null
  pendingVariantEndingDuration: number | null
  pendingGotoDistances: number[] | null
  deferredJumplines: Goto[]
  /** Zähler für p_begin-Sprunglinien-IDs (über mehrere _resolvePendingVariantGotos-Aufrufe hinweg). */
  pendingVariantEntryIndex: number
  deferredNoteboundAnnotations: NoteBoundAnnotation[]
  deferredChords: Chordsymbol[]
  /** Ruby-compatible [r:] remark lookup by voice_element[:time]. */
  remarkTable: Record<number, string>
}

function createVoiceState(wmeasure: number, countBy: number | null): VoiceState {
  return {
    variantNo: 0,
    tieStarted: false,
    measureCount: 0,
    measureStartTime: 0,
    countBy,
    wmeasure,
    nextMeasure: false,
    nextRepeatStart: false,
    nextFirstInPart: false,
    repetitionStack: [],
    variantEndings: [[]],
    pushedVariantEndingRepeat: false,
    previousNote: null,
    slurStack: [],
    slurCounter: 0,
    tupletP: null,
    variantAnchor: null,
    variantAnchorDistances: null,
    pendingVariantEntrySources: [],
    pendingVariantExitSources: [],
    awaitingVariantContinuation: false,
    variantSectionNo: 0,
    pendingVariantEndingText: null,
    pendingVariantEndingDuration: null,
    pendingGotoDistances: null,
    deferredJumplines: [],
    pendingVariantEntryIndex: 0,
    deferredNoteboundAnnotations: [],
    deferredChords: [],
    remarkTable: {},
  }
}

// ---------------------------------------------------------------------------
// AbcToSong
// ---------------------------------------------------------------------------

export class AbcToSong {
  private _beatResolution = 192
  private _shortestNote = 64
  private _config: ZupfnoterConfig | null = null
  private _sourceLineStarts: number[] = [0]
  private _source: string | null = null
  private _currentState: VoiceState | null = null
  private _diagnostics: SongDiagnostic[] = []
  private _partTable: Record<number, string> = {}

  /**
   * Transform an AbcModel into a Song.
   *
   * @param model   Output of AbcParser.parse()
   * @param config  Zupfnoter configuration (for beat resolution etc.)
   */
  transform(model: AbcModel, config: ZupfnoterConfig): Song {
    this._config = config
    this._diagnostics = []
    this._partTable = {}
    this._beatResolution = config.layout.BEAT_RESOLUTION ?? 192
    this._shortestNote = config.layout.SHORTEST_NOTE ?? 64
    this._sourceLineStarts = model.sourceLineStarts
    this._source = model.source

    const restposition = config.restposition

    const voices = model.voices.map((v, idx) => this._transformVoice(v, idx, model, restposition))

    // Legacy parity: insert duplicate of V1 at index 0 for 1-based voice indexing.
    // The legacy Ruby system introduces this extra voice so that external config
    // (e.g. extract.<nr>.voices: [1]) maps directly to Song.voices[1] (V1).
    if (voices.length > 0) {
      const v1 = voices[0] as Voice
      voices.unshift({
        index: 0,
        entities: [...v1.entities],
        name: v1.name,
        showVoice: true,
        showFlowline: true,
        showJumpline: true,
      })
      for (let i = 1; i < voices.length; i++) {
        const v = voices[i] as Voice
        voices[i] = { ...v, index: i }
      }
    }

    const beatMaps = this._buildBeatMaps(voices)
    const metaData = this._extractMetaData(model)
    if (this._diagnostics.length > 0) {
      metaData.diagnostics = this._diagnostics
    }
    const harpnoteOptions = this._extractHarpnoteOptions(model, config)

    return { voices, beatMaps, metaData, harpnoteOptions }
  }

  // ---------------------------------------------------------------------------
  // Voice transformation
  // ---------------------------------------------------------------------------

  private _transformVoice(
    voice: AbcVoice,
    voiceIndex: number,
    model: AbcModel,
    restposition: RestPositionConfig,
  ): Voice {
    const wmeasure = voice.voice_properties.meter.wmeasure
    const countBy = voice.voice_properties.meter.a_meter[0]?.bot ?? null
    const state = createVoiceState(wmeasure, countBy)
    this._currentState = state

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

    entities.push(
      ...state.deferredNoteboundAnnotations,
      ...state.deferredChords,
      ...state.deferredJumplines,
    )

    // Befülle prevPitch/nextPitch und prevPlayable/nextPlayable auf allen Playables.
    // Restposition benötigt die Playable-Referenzen; danach werden die numerischen
    // Pitch-Felder erneut synchronisiert, weil Pausen ihren Pitch ändern können.
    this._annotateNeighbourPitches(entities)
    this._applyRestposition(entities, restposition.default)
    this._annotateNeighbourPitches(entities)
    this._applyRepeatEndRestposition(entities, restposition)
    this._annotateNeighbourPitches(entities)
    this._currentState = null

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
  private _applyRestposition(entities: VoiceEntity[], mode: RestPositionMode): void {
    for (const entity of entities) {
      if (entity.type !== 'Pause') continue
      const pause = entity as Pause
      const prev = this._findRestpositionNeighbour(pause.prevPlayable, 'previous')
      const next = this._findRestpositionNeighbour(pause.nextPlayable, 'next')

      let pitch: number
      if (mode === 'next') {
        pitch = next?.pitch ?? prev?.pitch ?? 60
      } else if (mode === 'previous') {
        pitch = prev?.pitch ?? next?.pitch ?? 60
      } else {
        // 'center' (default)
        // Legacy-Äquivalent zu `(prev_pitch + next_pitch) / 2` (Ruby-Integer-Division)
        if (prev && next) {
          pitch = Math.floor((prev.pitch + next.pitch) / 2)
        } else {
          pitch = prev?.pitch ?? next?.pitch ?? 60
        }
      }
      pause.pitch = pitch
    }
  }

  private _applyRepeatEndRestposition(entities: VoiceEntity[], restposition: RestPositionConfig): void {
    const mode = this._resolveRestpositionMode(restposition.repeatend, restposition.default)
    if (mode === restposition.default) return

    for (const entity of entities) {
      if (entity.type !== 'Goto') continue
      const from = entity.from
      if (from.type !== 'Pause') continue
      this._applyRestpositionToPause(from, mode)
    }
  }

  private _applyRestpositionToPause(pause: Pause, mode: RestPositionMode): void {
    const prev = this._findRestpositionNeighbour(pause.prevPlayable, 'previous')
    const next = this._findRestpositionNeighbour(pause.nextPlayable, 'next')

    if (mode === 'next') {
      pause.pitch = next?.pitch ?? prev?.pitch ?? 60
    } else if (mode === 'previous') {
      pause.pitch = prev?.pitch ?? next?.pitch ?? 60
    } else if (prev && next) {
      pause.pitch = Math.floor((prev.pitch + next.pitch) / 2)
    } else {
      pause.pitch = prev?.pitch ?? next?.pitch ?? 60
    }
  }

  private _resolveRestpositionMode(
    mode: RestPositionMode | 'default',
    defaultMode: RestPositionMode,
  ): RestPositionMode {
    return mode === 'default' ? defaultMode : mode
  }

  private _findRestpositionNeighbour(
    playable: PlayableEntity | undefined,
    direction: 'previous' | 'next',
  ): PlayableEntity | undefined {
    let current = playable
    while (current?.type === 'Pause') {
      current = direction === 'previous' ? current.prevPlayable : current.nextPlayable
    }
    return current
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
        return this._transformRemark(sym, state)
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
    this._registerPendingGotoDistances(sym, state)
    const notes = sym.notes ?? []
    const duration = this._convertDuration(notes[0]?.dur ?? 384)
    const beat = this._timeToBeat(sym.time)
    const startPos = this._symbolPosition(sym, 'start_pos', sym.istart)
    const endPos = this._symbolPosition(sym, 'end_pos', sym.iend)
    const sourceOffsets = this._symbolSourceOffsets(sym)
    const decorations = this._parseDecorations(sym)
    const { tuplet, tupletStart, tupletEnd } = this._parseTuplet(sym, state)
    const lyrics = this._parseLyrics(sym)

    const measureStart = state.nextMeasure
    if (state.nextMeasure) {
      state.measureCount++
      state.measureStartTime = sym.time
      state.nextMeasure = false
    }
    const countNote = this._transformCountNote(sym, sym.dur ?? notes[0]?.dur ?? 384, state)

    const mappedNotesUnordered: Note[] = notes.map((n) => ({
      type: 'Note' as const,
      beat,
      time: sym.time,
      startPos,
      endPos,
      sourceOffsets,
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

    const mappedNotes = mappedNotesUnordered.length > 1 && state.measureCount === 2
      ? [...mappedNotesUnordered].reverse()
      : mappedNotesUnordered

    let result: PlayableEntity[]

    if (mappedNotes.length === 1) {
      result = [requireDefined(mappedNotes[0], 'AbcToSong._transformNote(): expected note at index 0')]
    } else {
      const proxyNote = requireDefined(
        mappedNotes[mappedNotes.length - 1],
        'AbcToSong._transformNote(): expected proxy note in synch point',
      )
      const synch: SynchPoint = {
        type: 'SynchPoint' as const,
        beat,
        time: sym.time,
        startPos,
        endPos,
        sourceOffsets,
        decorations,
        barDecorations: [],
        visible: proxyNote.visible,
        variant: state.variantNo,
        znId: proxyNote.znId,
        duration,
        pitch: proxyNote.pitch,
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
    entity.slurStarts = this._parseSlur(sym).map(() => this._pushSlur(state))
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
    if (state.nextFirstInPart) {
      entity.firstInPart = true
      state.nextFirstInPart = false
    }

    state.previousNote = entity

    const inlineEntities: VoiceEntity[] = []
    inlineEntities.push(...this._consumePendingBarMarks(entity, state, _voiceIndex, sym))
    this._transformInlinePart(sym, entity)
    inlineEntities.push(...this._transformPartAnnotation(sym, entity, _voiceIndex, state))
    this._transformExtras(sym, entity, state, _voiceIndex)
    this._resolvePendingVariantGotos(entity, state, _voiceIndex, sym)

    return [entity, ...inlineEntities]
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
    this._registerPendingGotoDistances(sym, state)
    const duration = this._convertDuration(sym.dur ?? 384)
    const beat = this._timeToBeat(sym.time)
    const measureStart = state.nextMeasure

    if (state.nextMeasure) {
      state.measureCount++
      state.measureStartTime = sym.time
      state.nextMeasure = false
    }
    const countNote = this._transformCountNote(sym, sym.dur ?? 384, state)

    const pause: Pause = {
      type: 'Pause' as const,
      beat,
      time: sym.time,
      startPos: this._symbolPosition(sym, 'start_pos', sym.istart),
      endPos: this._symbolPosition(sym, 'end_pos', sym.iend),
      sourceOffsets: this._symbolSourceOffsets(sym),
      decorations: this._parseDecorations(sym),
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
      countNote,
      lyrics: this._parseLyrics(sym),
      invisible: sym.invis ?? sym.invisible ?? false,
    }

    state.previousNote = pause
    if (state.nextRepeatStart) {
      pause.firstInPart = true
      state.repetitionStack.push(pause)
      state.nextRepeatStart = false
    }
    if (state.nextFirstInPart) {
      pause.firstInPart = true
      state.nextFirstInPart = false
    }
    const inlineEntities: VoiceEntity[] = []
    inlineEntities.push(...this._consumePendingBarMarks(pause, state, voiceIndex, sym))
    this._transformInlinePart(sym, pause)
    inlineEntities.push(...this._transformPartAnnotation(sym, pause, voiceIndex, state))
    this._transformExtras(sym, pause, state, voiceIndex)
    this._resolvePendingVariantGotos(pause, state, voiceIndex, sym)
    return [pause, ...inlineEntities]
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
    this._registerPendingGotoDistances(sym, state)

    if (!(sym.invisible ?? false)) {
      state.nextMeasure = true
    }

    const isRepeatBar = sym.bar_type?.includes(':') ?? false
    const hasVariantStart = typeof sym.rbstart === 'number' && sym.rbstart > 0
    const variantLabel = sym.text?.trim() ?? ''
    // Volta bracket entry / exit gotos.
    if (hasVariantStart && state.previousNote) {
      const nextVariantNo = (state.variantSectionNo + 1) as 1 | 2
      if (state.variantSectionNo === 0) {
        state.variantAnchor = state.previousNote
        state.variantAnchorDistances = state.pendingGotoDistances
        state.pendingVariantEntrySources.push({ source: state.previousNote, distances: state.pendingGotoDistances })
      } else if (state.variantAnchor) {
        // When the variant-start bar is also a repeat end (e.g. |:2),
        // variant exits are implicit (handled by the repeat Goto) so
        // we must NOT push an exit source here — it would later create
        // a duplicate follow Goto.
        if (!isRepeatBar) {
          state.pendingVariantExitSources.push({ source: state.previousNote, distances: state.variantAnchorDistances })
        }
        state.pendingVariantEntrySources.push({ source: state.variantAnchor, distances: state.variantAnchorDistances })
      }
      state.awaitingVariantContinuation = false
      state.variantSectionNo = nextVariantNo
      state.variantNo = nextVariantNo
    }
    if (sym.rbstart === 2 && state.previousNote) {
      state.pendingVariantEndingText = variantLabel
      state.pendingVariantEndingDuration = sym.bar_type === '[|:' ? 64 : null
    }
    if (sym.rbstop && !isRepeatBar && !hasVariantStart) {
      if (state.previousNote && state.variantSectionNo > 0) {
        state.pendingVariantExitSources.push({ source: state.previousNote, distances: state.variantAnchorDistances })
      }
      state.awaitingVariantContinuation = state.pendingVariantExitSources.length > 0
      state.variantNo = 0
      if (state.awaitingVariantContinuation) {
        state.variantSectionNo = 0
      }
    }

    const isInternalBar = sym.bar_type?.includes(':') && sym.time - state.measureStartTime !== state.wmeasure
    const isInternalRepeatStart = sym.bar_type?.endsWith(':') && isInternalBar
    const isInternalVariantRepeatEnd = sym.rbstop === 2 && sym.rbstart !== 2 && isInternalBar
    if (isInternalRepeatStart || isInternalVariantRepeatEnd) {
      state.nextMeasure = false
    }
    if (sym.bar_type === '||' || sym.bar_type === '|]') {
      state.nextFirstInPart = true
    }

    // Repeat end → Goto.
    const isRepeatEndByBarType = sym.bar_type?.startsWith(':') ?? false
    const isRepeatEndByFallback =
      !isRepeatEndByBarType &&
      typeof sym.rbstop === 'number' &&
      sym.rbstop > 0 &&
      typeof sym.rbstart === 'number' &&
      sym.rbstart > 0 &&
      sym.text?.trim() !== '1' &&
      state.repetitionStack.length > 1
    const previousNote = state.previousNote
    const isRepeatEnd = (isRepeatEndByBarType || isRepeatEndByFallback) && previousNote
    if (isRepeatEnd) {
      const repeatStart = state.repetitionStack[state.repetitionStack.length - 1]
      if (repeatStart && previousNote) {
        const repeatTime = previousNote.time
        const repeatDistance = this._extractGotoDistancesFromSymbol(sym)?.[0] ?? state.pendingGotoDistances?.[0] ?? 2
        const repeatLevel = state.repetitionStack.length + 1
      const goto: Goto = {
        type: 'Goto' as const,
          beat: this._timeToBeat(repeatTime),
          time: repeatTime,
          startPos: previousNote.startPos,
          endPos: previousNote.endPos,
          decorations: [],
          barDecorations: [],
          visible: true,
          variant: state.variantNo,
          znId: `goto-${voiceIndex}-${repeatStart.time}`,
          confKey: `notebound.c_jumplines.v_${voiceIndex + 1}.${repeatTime}.p_repeat`,
          from: previousNote,
          to: repeatStart,
          policy: {
            confKey: `notebound.c_jumplines.v_${voiceIndex + 1}.${repeatTime}.p_repeat`,
            distance: repeatDistance,
            isRepeat: true,
            level: repeatLevel,
          } as GotoPolicy,
      }
      result.push(goto)
      }
      state.pendingGotoDistances = null
      state.nextFirstInPart = true
    }

    // Repeat start → mark the next playable as repetition anchor.
    if (sym.bar_type && sym.bar_type.endsWith(':')) {
      state.nextRepeatStart = true
    }

    if (state.previousNote) {
      this._transformExtras(sym, state.previousNote, state, voiceIndex)
    }

    return result
  }

  private _consumePendingBarMarks(
    companion: PlayableEntity,
    state: VoiceState,
    voiceIndex: number,
    sym: AbcSymbol,
  ): NoteBoundAnnotation[] {
    if (state.pendingVariantEndingText === null) return []

    const annotation: NoteBoundAnnotation & { duration: number } = {
      type: 'NoteBoundAnnotation' as const,
      beat: this._timeToBeat(sym.time),
      time: sym.time,
      startPos: this._symbolPosition(sym, 'start_pos', sym.istart),
      endPos: this._symbolPosition(sym, 'end_pos', sym.iend),
      sourceOffsets: this._symbolSourceOffsets(sym),
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
    // Mirrors Ruby: part markers are stored by time and attached to the same-time playable.
    this._partTable[sym.time] = sym.text ?? ''
    return null
  }

  private _transformRemark(sym: AbcSymbol, state: VoiceState): VoiceEntity | null {
    // Mirrors Ruby: [r:] remarks override the generated znId by voice_element[:time].
    if (typeof sym.text !== 'string') return null
    const remark = sym.text
    if (Object.prototype.hasOwnProperty.call(state.remarkTable, sym.time)) return null
    if (REMARK_ZNID_PATTERN.test(remark)) {
      state.remarkTable[sym.time] = remark
    } else {
      this._diagnostics.push({
        severity: 'error',
        message: INVALID_REMARK_ZNID_MESSAGE,
        startPos: this._symbolPosition(sym, 'start_pos', sym.istart),
        endPos: this._symbolPosition(sym, 'end_pos', sym.iend),
      })
      state.remarkTable[sym.time] = `_${remark}_`
    }
    return null
  }

  private _transformPartAnnotation(
    sym: AbcSymbol,
    companion: PlayableEntity,
    voiceIndex: number,
    state: VoiceState,
  ): NoteBoundAnnotation[] {
    if (!Object.prototype.hasOwnProperty.call(this._partTable, sym.time)) return []
    const partText = this._partTable[sym.time]
    if (typeof partText !== 'string' || partText.length === 0) return []

    if (companion.prevPlayable) {
      companion.prevPlayable.nextFirstInPart = true
    }
    companion.firstInPart = true
    return [{
      type: 'NoteBoundAnnotation' as const,
      beat: this._timeToBeat(sym.time),
      time: sym.time,
      startPos: this._symbolPosition(sym, 'start_pos', sym.istart),
      endPos: this._symbolPosition(sym, 'end_pos', sym.iend),
      sourceOffsets: this._symbolSourceOffsets(sym),
      decorations: [],
      barDecorations: [],
      visible: true,
      variant: 0,
      znId: `annot-partname-${voiceIndex}-${sym.istart}`,
      companion,
      text: partText,
      position: this._getDefaultNoteBoundPosition('partname', [5, -7]),
      style: 'bold',
      confKey: `notebound.partname.v_${voiceIndex + 1}.${companion.time}`,
    }]
  }

  private _transformInlinePart(sym: AbcSymbol, companion: PlayableEntity): void {
    const part = sym.part
    if (!part || typeof part !== 'object') return
    const partText = (part as { text?: unknown }).text
    if (typeof partText !== 'string' || partText.length === 0) return

    if (companion.prevPlayable) {
      companion.prevPlayable.nextFirstInPart = true
    }
    companion.firstInPart = true
    this._partTable[companion.time] = partText
  }

  private _resolvePendingVariantGotos(
    target: PlayableEntity,
    state: VoiceState,
    voiceIndex: number,
    sym: AbcSymbol,
  ): void {
    const currentGotoDistances = state.pendingGotoDistances
    const entrySources = [...state.pendingVariantEntrySources]
    state.pendingVariantEntrySources = []
    const exitSources = state.awaitingVariantContinuation && state.pendingVariantExitSources.length > 0
      ? [...state.pendingVariantExitSources]
      : []

    // Legacy verwendet die znId des ersten rbstop der Variantengruppe
    // (variantAnchor) als Zeit im confKey für p_follow gotos, nicht die Zeit
    // des exit-source.  Siehe abc2svg_to_harpnotes.rb Zeile 777-778:
    //   entity = variant_ending_group.first[:rbstop]
    //   conf_base = "notebound.c_jumplines.#{voice_id}.#{entity.znid}"
    const variantAnchorTime = state.variantAnchor?.znId ?? state.variantAnchor?.time

    if (exitSources.length > 0) {
      state.pendingVariantExitSources = []
      state.awaitingVariantContinuation = false
      state.variantAnchor = null
      state.variantAnchorDistances = null
      state.variantSectionNo = 0
    }

    for (const entry of entrySources) {
      const resolvedSource = requireDefined(
        entry.source,
        `AbcToSong._resolvePendingVariantGotos(): missing source at index ${state.pendingVariantEntryIndex}`,
      )
      if (resolvedSource === target) {
        state.pendingVariantEntryIndex += 1
        continue
      }
      state.deferredJumplines.push({
        type: 'Goto' as const,
        beat: target.beat,
        time: sym.time,
        startPos: this._symbolPosition(sym, 'start_pos', sym.istart),
        endPos: this._symbolPosition(sym, 'end_pos', sym.iend),
        sourceOffsets: this._symbolSourceOffsets(sym),
        decorations: [],
        barDecorations: [],
        visible: true,
        variant: 0,
        znId: `goto-${voiceIndex}-${sym.istart}-${state.pendingVariantEntryIndex}`,
        confKey: `notebound.c_jumplines.v_${voiceIndex + 1}.${resolvedSource.time}.${state.pendingVariantEntryIndex}.p_begin`,
        from: resolvedSource,
        to: target,
        policy: {
          confKey: `notebound.c_jumplines.v_${voiceIndex + 1}.${resolvedSource.time}.${state.pendingVariantEntryIndex}.p_begin`,
          distance: entry.distances?.[0],
          fromAnchor: 'after',
          toAnchor: 'before',
          isRepeat: true,
        } as GotoPolicy,
      })
      state.pendingVariantEntryIndex += 1
    }

    for (let index = 0; index < exitSources.length; index += 1) {
      const exit = requireDefined(
        exitSources[index],
        `AbcToSong._resolvePendingVariantGotos(): missing exit source at index ${index}`,
      )
      const resolvedSource = requireDefined(
        exit.source,
        `AbcToSong._resolvePendingVariantGotos(): missing exit source at index ${state.pendingVariantEntryIndex}`,
      )
      if (resolvedSource === target) {
        state.pendingVariantEntryIndex += 1
        continue
      }
      const suffix = index < exitSources.length - 1 ? 'p_end' : 'p_follow'
      state.deferredJumplines.push({
        type: 'Goto' as const,
        beat: target.beat,
        time: sym.time,
        startPos: this._symbolPosition(sym, 'start_pos', sym.istart),
        endPos: this._symbolPosition(sym, 'end_pos', sym.iend),
        sourceOffsets: this._symbolSourceOffsets(sym),
        decorations: [],
        barDecorations: [],
        visible: true,
        variant: 0,
        znId: `goto-${voiceIndex}-${sym.istart}-${state.pendingVariantEntryIndex}`,
        confKey: `notebound.c_jumplines.v_${voiceIndex + 1}.${variantAnchorTime ?? resolvedSource.time}.${suffix}`,
        from: resolvedSource,
        to: target,
        policy: {
          confKey: `notebound.c_jumplines.v_${voiceIndex + 1}.${variantAnchorTime ?? resolvedSource.time}.${suffix}`,
          distance: exit.distances?.[2] ?? currentGotoDistances?.[2],
          isRepeat: true,
          fromAnchor: 'after',
          toAnchor: 'before',
          verticalAnchor: 'to',
        } as GotoPolicy,
      })
      state.pendingVariantEntryIndex += 1
    }

    if (entrySources.length > 0 || exitSources.length > 0) {
      state.pendingGotoDistances = null
    } else {
      state.pendingGotoDistances = currentGotoDistances
    }
    return
  }
  // ---------------------------------------------------------------------------
  // Extra elements (chord symbols, annotations)
  // ---------------------------------------------------------------------------

  private _transformExtras(
    sym: AbcSymbol,
    companion: PlayableEntity,
    state: VoiceState,
    voiceIndex: number,
  ): void {
    if (!sym.a_gch) return
    const voiceId = voiceIndex + 1

    for (let extraIndex = 0; extraIndex < sym.a_gch.length; extraIndex++) {
      const extra = requireDefined(
        sym.a_gch[extraIndex],
        `AbcToSong._transformExtras(): missing extra at index ${extraIndex}`,
      )
      const text = extra.text ?? ''
      if (!text) continue

      const trimmedText = text.trim()
      if (extra.type === 'g' && companion.type !== 'Pause') {
        const chord: Chordsymbol = {
          type: 'Chordsymbol' as const,
          beat: this._timeToBeat(sym.time),
          time: sym.time,
          startPos: this._symbolPosition(sym, 'start_pos', sym.istart),
          endPos: this._symbolPosition(sym, 'end_pos', sym.iend),
          sourceOffsets: this._symbolSourceOffsets(sym),
          decorations: [],
          barDecorations: [],
          visible: true,
          variant: state.variantNo,
          znId: `chord-${voiceIndex}-${sym.istart}`,
          confKey: `notebound.chord.v_${voiceId}.${companion.time}.${extraIndex}`,
          companion,
          text: this._normalizeChordText(text),
          position: this._getDefaultNoteBoundPosition('chord', [0, 0]),
          style: 'large',
        }
        state.deferredChords.push(chord)
        continue
      }
      if (extra.type === '_' && companion.type !== 'Pause') {
        const chord: Chordsymbol = {
          type: 'Chordsymbol' as const,
          beat: this._timeToBeat(sym.time),
          time: sym.time,
          startPos: this._symbolPosition(sym, 'start_pos', sym.istart),
          endPos: this._symbolPosition(sym, 'end_pos', sym.iend),
          sourceOffsets: this._symbolSourceOffsets(sym),
          decorations: [],
          barDecorations: [],
          visible: true,
          variant: state.variantNo,
          znId: `chord-${voiceIndex}-${sym.istart}`,
          confKey: `notebound.chord.v_${voiceId}.${companion.time}.${extraIndex}`,
          companion,
          text: this._normalizeChordText(text),
          position: this._getDefaultNoteBoundPosition('chord', [0, 0]),
          style: 'large',
        }
        state.deferredChords.push(chord)
        continue
      }
      if (extra.type !== '^') {
        continue
      }

      if (trimmedText.startsWith('|') || trimmedText.startsWith(':|')) {
        continue
      }

      const hasExplicitAnnotationMarker = /^[!#]/.test(trimmedText) || trimmedText.startsWith('@@')
      if (extra.type === '^' && companion.type !== 'Pause' && !hasExplicitAnnotationMarker && !/\s/.test(trimmedText)) {
        const chord: Chordsymbol = {
          type: 'Chordsymbol' as const,
          beat: this._timeToBeat(sym.time),
          time: sym.time,
          startPos: this._symbolPosition(sym, 'start_pos', sym.istart),
          endPos: this._symbolPosition(sym, 'end_pos', sym.iend),
          sourceOffsets: this._symbolSourceOffsets(sym),
          decorations: [],
          barDecorations: [],
          visible: true,
          variant: state.variantNo,
          znId: `chord-${voiceIndex}-${sym.istart}`,
          confKey: `notebound.chord.v_${voiceId}.${companion.time}.${extraIndex}`,
          companion,
          text: this._normalizeChordText(text),
          position: this._getDefaultNoteBoundPosition('chord', [0, 0]),
          style: 'large',
        }
        state.deferredChords.push(chord)
        continue
      }

      const parsedAnnotation = this._parseInlineAnnotation(text, voiceId, companion.time, extraIndex)
      if (!parsedAnnotation) continue

      const annotation: NoteBoundAnnotation = {
        type: 'NoteBoundAnnotation' as const,
        beat: this._timeToBeat(sym.time),
        time: sym.time,
        startPos: this._symbolPosition(sym, 'start_pos', sym.istart),
        endPos: this._symbolPosition(sym, 'end_pos', sym.iend),
        sourceOffsets: this._symbolSourceOffsets(sym),
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
      state.deferredNoteboundAnnotations.push(annotation)
    }
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

  /**
   * Der k_sf-Schlüsselvorzeichen-Wert in einen Tonart-Namen umrechnen.
   * Positive Werte = Kreuze, negative Werte = b-Vorzeichen.
   * Nur Dur (k_mode=0) wird aktuell abgebildet.
   */
  private static _keySfToName(kSf: number): string {
    const SHARP_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
    const FLAT_KEYS = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']
    if (kSf >= 0 && kSf < SHARP_KEYS.length) return SHARP_KEYS[kSf] ?? 'C'
    return FLAT_KEYS[Math.abs(kSf)] ?? 'C'
  }

  private _extractMetaData(model: AbcModel): SongMetaData {
    const info = model.info
    const writtenKey = info['K']?.split('\n')[0]?.trim().split(/\s+/)[0]

    // Effektive Tonart aus der ersten Stimme ermitteln (berücksichtigt shift=)
    const firstVoice = model.voices[0]
    const effectiveKeySf = firstVoice?.voice_properties.key?.k_sf
    const effectiveKey = effectiveKeySf !== undefined
      ? AbcToSong._keySfToName(effectiveKeySf)
      : writtenKey

    // o_key: Nur setzen, wenn die geschriebene Tonart von der effektiven abweicht
    const oKey = (writtenKey && writtenKey !== effectiveKey) ? `(Original in ${writtenKey})` : ''

    const rawQ = info['Q']?.split('\n')[0]
    const tempo = rawQ ? this._parseTempo(rawQ) : { duration: [0.25], bpm: 120 }
    const parsedBpm = rawQ ? /^(\d+\/\d+)=(\d+)$/.exec(rawQ) : null
    const tempoDisplay = parsedBpm ? rawQ : (rawQ ? `${rawQ}=${tempo.bpm}` : '1/4=120')

    return {
      title: info['T']?.split('\n').join('\n'),
      composer: info['C']?.split('\n').join('\n') ?? '',
      number: info['X']?.split('\n')[0],
      filename: info['F']?.split('\n').join('\n') ?? '',
      meter: info['M']?.split('\n').filter(Boolean) ?? undefined,
      key: effectiveKey,
      o_key: oKey,
      tempo,
      tempoDisplay,
      tempo_display: tempoDisplay,
      checksum: model.checksum,
    }
  }

  private _extractHarpnoteOptions(model: AbcModel, config: ZupfnoterConfig): Record<string, unknown> {
    const info = model.info
    const lyrics = info['W']
      ? {
        text: info['W']
          .split('\n')
          .map((line) => line.trimEnd()),
      }
      : {
        text: null,
      }
    const template = {
      filebase: '-no-template-',
      title: '- no template -',
    }
    const print = (config.produce ?? [])
      .map((extractNr) => {
        const extract = config.extract[String(extractNr)]
        const title = extract?.title
        if (!title) {
          return null
        }
        const filenamepart = (extract.filenamepart ?? title).trim().replace(/[^a-zA-Z0-9\-_]/g, '_')
        return {
          title,
          view_id: extractNr,
          filenamepart,
        }
      })
      .filter((entry): entry is { title: string; view_id: number; filenamepart: string } => entry !== null)

    return {
      lyrics,
      template,
      print,
    }
  }

  private _parseTempo(q: string): { duration: number[]; bpm: number } {
    const trimmed = q.trim()

    // Full: "1/4=120"
    const fullMatch = /^(\d+)\/(\d+)=(\d+)$/.exec(trimmed)
    if (fullMatch) {
      const num = Number.parseInt(requireDefined(fullMatch[1], 'AbcToSong._parseTempo(): missing numerator'), 10)
      const den = Number.parseInt(requireDefined(fullMatch[2], 'AbcToSong._parseTempo(): missing denominator'), 10)
      const bpm = Number.parseInt(requireDefined(fullMatch[3], 'AbcToSong._parseTempo(): missing BPM'), 10)
      return { duration: [num / den], bpm }
    }

    // Duration only: "1/4" — default BPM = 120
    const durMatch = /^(\d+)\/(\d+)$/.exec(trimmed)
    if (durMatch) {
      const num = Number.parseInt(requireDefined(durMatch[1], 'AbcToSong._parseTempo(): missing numerator'), 10)
      const den = Number.parseInt(requireDefined(durMatch[2], 'AbcToSong._parseTempo(): missing denominator'), 10)
      return { duration: [num / den], bpm: 120 }
    }

    // Number only: "120" — default duration = 1/4
    const numMatch = /(\d+)/.exec(trimmed)
    if (numMatch) {
      return { duration: [0.25], bpm: Number.parseInt(requireDefined(numMatch[1], 'AbcToSong._parseTempo(): missing tempo digits'), 10) }
    }

    return { duration: [0.25], bpm: 120 }
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

  private _transformCountNote(sym: AbcSymbol, rawDuration: number, state: VoiceState): string {
    if (state.countBy === null) return 'x'

    const countBase = ABC2SVG_DURATION_FACTOR / state.countBy
    const countStart = (4 * (sym.time - state.measureStartTime)) / countBase
    const countEnd = countStart + (4 * rawDuration) / countBase

    if (!Number.isInteger(countStart) || !Number.isInteger(countEnd)) {
      return Number.isInteger(countStart) ? 'tra' : 'la'
    }

    let countRange = ''
    for (let index = countStart; index < countEnd; index++) {
      countRange += COUNT_NAMES[index] ?? ''
    }

    countRange = countRange.replace(/(\d+)/g, '<$1>')

    const replaceMap: Array<[RegExp, string]> = [
      [/^<\d+>.*eue$/, 'eue'],
      [/^<\d+>.*e$/, 'e'],
      [/^u.*$/, 'e'],
    ]
    const replacement = replaceMap.find(([pattern]) => pattern.test(countRange))
    if (replacement) {
      countRange = countRange.replaceAll(replacement[1], '')
    }

    return (countRange.match(/<\d+>|[eu]/g) ?? []).join('-').replace(/[<>]/g, '')
  }

  /** Convert character offset to [line, column] (1-based) */
  private _charposToLineCol(offset: number): [number, number] {
    if (offset <= 0 || this._sourceLineStarts.length === 0) return [1, 1]

    let left = 0
    let right = this._sourceLineStarts.length - 1
    while (left <= right) {
      const middle = Math.floor((left + right) / 2)
      const lineStart = this._sourceLineStarts[middle]
      const nextLineStart = this._sourceLineStarts[middle + 1]

      if (lineStart === undefined) break
      if (nextLineStart !== undefined && offset >= nextLineStart) {
        left = middle + 1
        continue
      }
      if (offset < lineStart) {
        right = middle - 1
        continue
      }
      return [middle + 1, offset - lineStart + 1]
    }

    const lastIndex = this._sourceLineStarts.length - 1
    const lineStart = this._sourceLineStarts[lastIndex]
    if (lineStart === undefined) return [1, 1]
    return [lastIndex + 1, offset - lineStart + 1]
  }

  private _symbolPosition(sym: AbcSymbol, key: 'start_pos' | 'end_pos', fallbackOffset: number): [number, number] {
    const adjustLegacyEndOffset = (offset: number): number => {
      if (key !== 'end_pos' || this._source === null) return offset
      if (offset < 0 || offset >= this._source.length) return offset

      const source = this._source
      const currentChar = source[offset]

      if (currentChar === '\n' || currentChar === '\r') {
        let index = offset - 1
        while (index >= 0) {
          const char = source[index]
          if (char === undefined) break
          if (char === '\n' || char === '\r') {
            index -= 1
            continue
          }
          if (!/\s/.test(char)) break
          index -= 1
        }
        return index >= 0 ? index : offset
      }

      if (currentChar === ')' || currentChar === ']' || currentChar === '}') {
        let index = offset
        while (index < source.length) {
          const char = source[index]
          if (char !== ')' && char !== ']' && char !== '}') break
          index += 1
        }
        while (index < source.length && /\s/.test(source[index] ?? '')) {
          index += 1
        }
        return Math.max(offset, index - 1)
      }

      return offset
    }

    const origin = (sym as Record<string, unknown>)['origin']
    if (origin && typeof origin === 'object' && !Array.isArray(origin)) {
      const originRecord = origin as Record<string, unknown>
      const rawVoiceElement = originRecord['raw_voice_element']
      if (rawVoiceElement && typeof rawVoiceElement === 'object' && !Array.isArray(rawVoiceElement)) {
        const rawPos = (rawVoiceElement as Record<string, unknown>)[key]
        if (
          Array.isArray(rawPos) &&
          rawPos.length === 2 &&
          typeof rawPos[0] === 'number' &&
          typeof rawPos[1] === 'number'
        ) {
          return [rawPos[0], rawPos[1]]
        }
      }
      const pos = originRecord[key]
      if (
        Array.isArray(pos) &&
        pos.length === 2 &&
        typeof pos[0] === 'number' &&
        typeof pos[1] === 'number'
      ) {
        return [pos[0], pos[1]]
      }
    }
    const fallback = this._charposToLineCol(fallbackOffset)
    const adjustedOffset = adjustLegacyEndOffset(fallbackOffset)
    if (adjustedOffset === fallbackOffset) return fallback
    return this._charposToLineCol(adjustedOffset)
  }

  private _symbolSourceOffsets(sym: AbcSymbol): [number, number] {
    return [sym.istart, sym.iend]
  }

  private _makeZnId(sym: AbcSymbol, _voiceIndex: number): string {
    const remarkTable = this._currentState?.remarkTable
    if (remarkTable && Object.prototype.hasOwnProperty.call(remarkTable, sym.time)) {
      const remark = remarkTable[sym.time]
      if (typeof remark === 'string') return remark
    }
    // Mirrors Ruby: use remark_table[time] when present, otherwise voice_element[:time].
    return `${sym.time}`
  }

  private _parseGotoDistances(text: string): number[] | null {
    const match = text.match(/^@([^\@]*)@(\-?\d*)(,(\-?\d*),(\-?\d*))?$/)
    if (!match) return null

    const distances = [match[2], match[4], match[5]]
      .map((value) => (value !== undefined && value !== '' ? Number.parseInt(value, 10) : null))
      .filter((value): value is number => value !== null && Number.isFinite(value))

    return distances.length > 0 ? distances : null
  }

  private _registerPendingGotoDistances(sym: AbcSymbol, state: VoiceState): void {
    const gotoDistances = this._extractGotoDistancesFromSymbol(sym)
    if (gotoDistances) {
      state.pendingGotoDistances = gotoDistances
    }
  }

  private _extractGotoDistancesFromSymbol(sym: AbcSymbol): number[] | null {
    const extras = sym.a_gch
    if (!Array.isArray(extras) || extras.length === 0) return null

    for (const extra of extras) {
      if (!extra || extra.type !== '^' || typeof extra.text !== 'string' || !extra.text.startsWith('@')) continue
      const gotoDistances = this._parseGotoDistances(extra.text)
      if (gotoDistances) {
        return gotoDistances
      }
    }

    if (this._source !== null) {
      const windowStart = Math.max(0, sym.istart - 512)
      const windowEnd = Math.min(this._source.length, sym.iend + 512)
      const window = this._source.slice(windowStart, windowEnd)
      const sourceMatches = window.matchAll(/\^(@@[-0-9,]+(?:@[^"\s]+)?)/g)
      let nearestMarker: string | null = null
      let nearestMarkerIndex = -1
      const symbolIndex = sym.istart - windowStart
      for (const match of sourceMatches) {
        const matchIndex = match.index ?? -1
        if (matchIndex <= symbolIndex && matchIndex >= nearestMarkerIndex && match[1]) {
          nearestMarker = match[1]
          nearestMarkerIndex = matchIndex
        }
      }
      if (nearestMarker !== null) {
        return this._parseGotoDistances(nearestMarker)
      }
    }

    return null
  }

  private _parseDecorations(sym: AbcSymbol): string[] {
    const supportedDecorations = new Set([
      '<(', '<)', '>(', '>)', 'arpeggio', 'coda', 'crescendo(', 'crescendo)',
      'D.C.', 'D.C.alfine', 'D.S.', 'dacapo', 'dacoda', 'dasegno',
      'diminuendo(', 'diminuendo)', 'f', 'ff', 'fff', 'ffff', 'fine',
      'p', 'pp', 'ppp', 'pppp', 'segno', 'fermata', 'emphasis', 'breath',
    ])

    return (sym.a_dd ?? [])
      .map((decoration) => decoration.name)
      .filter((name): name is string => typeof name === 'string' && supportedDecorations.has(name))
  }

  private _parseSlur(sym: AbcSymbol): number[] {
    const rawValue = (sym as Record<string, unknown>)['slur_sls']
    if (Array.isArray(rawValue)) {
      return rawValue.filter((value): value is number => typeof value === 'number')
    }

    let startValue = (typeof rawValue === 'number' ? rawValue : 0)
    const result: number[] = []
    while (startValue > 0) {
      result.push(startValue & 0xf)
      startValue >>= 4
    }
    return result
  }

  private _parseTuplet(sym: AbcSymbol, state: VoiceState): { tuplet: number; tupletStart: boolean; tupletEnd: boolean } {
    const rawSym = sym as Record<string, unknown>
    const tp = rawSym['tp'] as Array<{ p?: number }> | undefined
    const rawInTuplet = Boolean(rawSym['in_tuplet'])
    const tupletStart = tp?.[0] !== undefined || (rawInTuplet && state.tupletP === null)
    const nextCandidate = rawSym['next']
    const nextSym = typeof nextCandidate === 'object' && nextCandidate !== null
      ? nextCandidate as Record<string, unknown>
      : null
    const tupletEndMarker = Boolean(rawSym['tpe']) || (rawInTuplet && nextSym !== null && !Boolean(nextSym['in_tuplet']))
    const inTuplet = rawInTuplet || tupletStart || state.tupletP !== null || tupletEndMarker

    if (!inTuplet) {
      return { tuplet: 1, tupletStart: false, tupletEnd: false }
    }

    if (tupletStart) {
      state.tupletP = tp?.[0]?.p ?? 3
    }

    const tuplet = state.tupletP ?? 1
    const tupletEnd = tupletEndMarker && state.tupletP !== null
    if (tupletEnd) {
      state.tupletP = null
    }

    return { tuplet, tupletStart, tupletEnd }
  }

  private _parseLyrics(sym: AbcSymbol): string | null {
    const aLy = (sym as Record<string, unknown>)['a_ly'] as Array<{ t?: string }> | undefined
    if (!aLy || aLy.length === 0) return null
    // Mirrors Ruby: a_ly[0].t, with ABC lyric continuation and extender cleanup.
    return aLy[0]?.t?.replace(/\n/g, '-').replace(/_/g, '') ?? ''
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

  private _normalizeChordText(rawText: string): string {
    const normalized = rawText
      .trim()
      .replace(/♯/g, '#')
      .replace(/♭/g, 'b')

    if (normalized === 'B') {
      return 'Cb'
    }

    return normalized
  }

  private _getDefaultNoteBoundPosition(
    kind: 'annotation' | 'partname' | 'variantend' | 'chord',
    fallback: [number, number],
  ): [number, number] {
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

  private _pushSlur(state: VoiceState): number {
    const id = state.slurCounter + 1
    state.slurCounter++
    state.slurStack.push(id)
    return id
  }

  private _popSlur(state: VoiceState): number {
    const existing = state.slurStack.pop()
    if (existing !== undefined) return existing
    const id = state.slurCounter + 1
    state.slurCounter++
    return id
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
