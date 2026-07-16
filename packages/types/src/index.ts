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
  SongDiagnostic,
  Song,
} from './music.js'

export type {
  SelectionOrigin,
  SelectionTextRange,
  SelectionLineColumn,
  SheetObjectAddressability,
  SheetObjectIndexEntry,
  SheetObjectIndex,
  SelectionProjectionKind,
  SelectionTarget,
  SelectionVoiceScope,
  SelectionTargetCapabilities,
  SelectionProjection,
  SelectionProjectionOptions,
  SelectionSource,
  SelectionState,
  SelectionEvent,
} from './selection.js'

export type {
  PlaybackStatus,
  PlaybackMode,
  PlaybackState,
  PlaybackHighlight,
  PlaybackFlowStep,
  PlaybackPlayerEvent,
} from './playback.js'

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
  Markdown,
  FontStyle,
  DurationKey,
  DurationStyle,
  BeamStyle,
  GlyphName,
  RestStyle,
  RestPositionMode,
  RestPositionConfig,
  LayoutConfig,
  PrinterConfig,
  BarnumberConfig,
  LegendConfig,
  AnnotationConfig,
  ExtractConfig,
  ZupfnoterConfig,
} from './config.js'

export type {
  StorageConnectionStatus,
  StorageConnection,
  StorageProviderDescriptor,
  StorageDocument,
} from './storage.js'
