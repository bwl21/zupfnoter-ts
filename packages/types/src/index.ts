/**
 * @zupfnoter/types – Public API
 *
 * Re-exportiert alle Typen der drei Domänen:
 * - music:   Harpnotes.Music (Song, Note, Pause, Voice, ...)
 * - drawing: Harpnotes.Drawing (Sheet, Ellipse, FlowLine, ...)
 * - config:  ZupfnoterConfig, LayoutConfig, ExtractConfig, ...
 */

export type {
  // Basis
  MusicEntity,
  // Spielbare Entitäten
  Playable,
  Note,
  Pause,
  SynchPoint,
  // Nicht-spielbare Entitäten
  NonPlayable,
  MeasureStart,
  NewPart,
  NoteBoundAnnotation,
  Chordsymbol,
  Goto,
  GotoPolicy,
  // Union-Typen
  PlayableEntity,
  NonPlayableEntity,
  VoiceEntity,
  // Song-Struktur
  Voice,
  BeatMap,
  SongMetaData,
  Song,
} from './music.js'

export type {
  FillStyle,
  Drawable,
  Ellipse,
  FlowLine,
  Path,
  Annotation,
  Glyph,
  Image,
  DrawableElement,
  Sheet,
} from './drawing.js'

export type {
  FontStyle,
  DurationKey,
  DurationStyle,
  GlyphName,
  RestStyle,
  LayoutConfig,
  PrinterConfig,
  BarnumberConfig,
  LegendConfig,
  AnnotationConfig,
  ExtractConfig,
  ZupfnoterConfig,
} from './config.js'
