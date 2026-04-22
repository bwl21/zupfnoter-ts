/**
 * Harpnotes Music Model – Stufe 2 der Transformationskette.
 *
 * Entspricht `Harpnotes::Music` in `harpnotes.rb`.
 * Keine Logik — nur Typdefinitionen.
 */

// ---------------------------------------------------------------------------
// Basis
// ---------------------------------------------------------------------------

/**
 * Gemeinsame Basis aller Musikentitäten.
 * Entspricht `Harpnotes::Music::MusicEntity`.
 */
export interface MusicEntity {
  /** Zeitposition für vertikale Platzierung im Sheet */
  beat: number
  /** Position in der Zeitdomäne (abc2svg-Einheiten, 1536 = ganze Note) */
  time: number
  /** Start-Position im ABC-Quelltext [Zeile, Spalte] */
  startPos: [number, number]
  /** End-Position im ABC-Quelltext [Zeile, Spalte] */
  endPos: [number, number]
  decorations: string[]
  barDecorations: string[]
  visible: boolean
  /** Wiederholungsvariante: 0 = keine, 1 = erste, 2 = zweite */
  variant: 0 | 1 | 2
  /** Zupfnoter-ID für Konfigurationsreferenz */
  znId: string
  confKey?: string
}

// ---------------------------------------------------------------------------
// Spielbare Entitäten
// ---------------------------------------------------------------------------

/**
 * Spielbare Musikentität (hat Dauer, Tonhöhe, Beat).
 * Entspricht `Harpnotes::Music::Playable`.
 */
export interface Playable extends MusicEntity {
  duration: number
  pitch: number
  tieStart: boolean
  tieEnd: boolean
  /** Tuplet-Zahl: 1 = kein Tuplet, 3 = Triole, 5 = Quintole */
  tuplet: number
  tupletStart: boolean
  tupletEnd: boolean
  firstInPart: boolean
  measureStart: boolean
  /** Taktnummer (für Taktnummern-Anzeige) */
  measureCount: number
  jumpStarts: string[]
  jumpEnds: string[]
  slurStarts: string[]
  slurEnds: string[]
  countNote: string | null
  lyrics: string | null
}

/**
 * Einzelne Note.
 * Entspricht `Harpnotes::Music::Note`.
 */
export interface Note extends Playable {
  readonly type: 'Note'
}

/**
 * Pause (Rest).
 * Entspricht `Harpnotes::Music::Pause`.
 */
export interface Pause extends Playable {
  readonly type: 'Pause'
  /** Unsichtbare Pause (ABC: x-Notation) */
  invisible: boolean
}

/**
 * Akkord / synchrone Noten (mehrere Noten auf demselben Beat).
 * Entspricht `Harpnotes::Music::SynchPoint`.
 */
export interface SynchPoint extends Playable {
  readonly type: 'SynchPoint'
  notes: Note[]
  synchedNotes: Note[]
}

// ---------------------------------------------------------------------------
// Nicht-spielbare Entitäten
// ---------------------------------------------------------------------------

/**
 * Nicht-spielbare Entität — hat einen Companion (zugehöriges Playable).
 * Entspricht `Harpnotes::Music::NonPlayable`.
 */
export interface NonPlayable extends MusicEntity {
  companion: PlayableEntity
}

/**
 * Taktanfang-Markierung.
 * Entspricht `Harpnotes::Music::MeasureStart`.
 */
export interface MeasureStart extends NonPlayable {
  readonly type: 'MeasureStart'
}

/**
 * Beginn eines neuen Abschnitts (ABC: P:).
 * Entspricht `Harpnotes::Music::NewPart`.
 */
export interface NewPart extends NonPlayable {
  readonly type: 'NewPart'
  name: string
}

/**
 * Notenbezogene Annotation (Text über/unter einer Note).
 * Entspricht `Harpnotes::Music::NoteBoundAnnotation`.
 */
export interface NoteBoundAnnotation extends NonPlayable {
  readonly type: 'NoteBoundAnnotation'
  text: string
  /** Position relativ zur Note [x, y] in mm */
  position: [number, number]
  style: string
  policy?: string
}

/**
 * Akkordsymbol (Harmonie-Bezeichnung über einer Note).
 * Entspricht `Harpnotes::Music::Chordsymbol`.
 */
export interface Chordsymbol extends NonPlayable {
  readonly type: 'Chordsymbol'
  text: string
  position: [number, number]
  style: string
  policy?: string
}

/**
 * Sprung / Wiederholung (Pfeil im Sheet).
 * Entspricht `Harpnotes::Music::Goto`.
 * Achtung: erbt direkt von MusicEntity, nicht von NonPlayable.
 */
export interface Goto extends MusicEntity {
  readonly type: 'Goto'
  /** Endpunkt des Sprungs (Wiederholung von hier) */
  from: PlayableEntity
  /** Startpunkt des Sprungs (Wiederholung bis hier) */
  to: PlayableEntity
  policy: GotoPolicy
}

export interface GotoPolicy {
  confKey?: string
  level?: number
  distance?: number
}

// ---------------------------------------------------------------------------
// Union-Typen
// ---------------------------------------------------------------------------

export type PlayableEntity = Note | Pause | SynchPoint
export type NonPlayableEntity = MeasureStart | NewPart | NoteBoundAnnotation | Chordsymbol | Goto
export type VoiceEntity = PlayableEntity | NonPlayableEntity

// ---------------------------------------------------------------------------
// Voice, BeatMap, Song
// ---------------------------------------------------------------------------

/**
 * Eine Stimme im Stück.
 * Entspricht `Harpnotes::Music::Voice`.
 */
export interface Voice {
  index: number
  name?: string
  showVoice: boolean
  showFlowline: boolean
  showJumpline: boolean
  entities: VoiceEntity[]
}

/**
 * Beat-Map einer Stimme: Beat-Nummer → Playable.
 * Entspricht `Harpnotes::Music::BeatMap`.
 */
export interface BeatMap {
  index: number
  entries: Record<number, PlayableEntity>
}

/**
 * Metadaten des Musikstücks (aus ABC-Headern).
 */
export interface SongMetaData {
  title?: string
  composer?: string
  filename?: string
  meter?: string
  key?: string
  tempo?: number
}

/**
 * Das vollständige Musikmodell (Ergebnis von Stufe 1: ABC → Song).
 * Entspricht `Harpnotes::Music::Song`.
 */
export interface Song {
  voices: Voice[]
  beatMaps: BeatMap[]
  metaData: SongMetaData
  harpnoteOptions?: Record<string, unknown>
  checksum?: string
}
