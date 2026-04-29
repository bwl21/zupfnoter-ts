/**
 * Zupfnoter Konfigurationstypen.
 *
 * Entspricht `init_conf.rb` und den Konfigurations-Attributen in `harpnotes.rb`.
 * Keine Logik — nur Typdefinitionen.
 */

import type { FillStyle } from './drawing.js'

// ---------------------------------------------------------------------------
// Schrift- und Darstellungsstile
// ---------------------------------------------------------------------------

/**
 * Schriftstil-Definition für Annotationen und Legenden.
 * Entspricht `FONT_STYLE_DEF`-Einträgen in `init_conf.rb`.
 */
export interface FontStyle {
  textColor: [number, number, number]  // RGB 0–255
  fontSize: number
  fontStyle: 'normal' | 'bold' | 'italic'
}

/**
 * Schlüssel für Notendauern auf SHORTEST_NOTE=64-Skala (Legacy-kompatibel).
 * d64=ganze, d32=halbe, d16=viertel, d8=achtel, d4=16tel, d2=32tel, d1=64tel.
 * Punktierte Werte: d48=punkt.halbe, d24=punkt.viertel, d12=punkt.achtel, d6=punkt.16tel, d3=punkt.32tel.
 */
export type DurationKey =
  | 'err'   // Fehler / unbekannt
  | 'd96'   // punktierte ganze
  | 'd64'   // ganze Note
  | 'd48'   // punktierte halbe
  | 'd32'   // halbe
  | 'd24'   // punktierte viertel
  | 'd16'   // viertel
  | 'd12'   // punktierte achtel
  | 'd8'    // achtel
  | 'd6'    // punktierte 16tel
  | 'd4'    // 16tel
  | 'd3'    // punktierte 32tel
  | 'd2'    // 32tel
  | 'd1'    // 64tel

/**
 * Darstellungsstil für eine Notendauer (Ellipsengröße, Füllung, Punktierung).
 */
export interface DurationStyle {
  sizeFactor: number
  fill: FillStyle
  dotted: boolean
}

/**
 * Glyph-Name für Pausenzeichen.
 * Entspricht den Schlüsseln in `Glyph::GLYPHS` in `harpnotes.rb`.
 */
export type GlyphName =
  | 'rest_1' | 'rest_4' | 'rest_8' | 'rest_16' | 'rest_32' | 'rest_64'
  | 'fermata' | 'emphasis' | 'breath' | 'error'

/**
 * Darstellungsstil für eine Pausendauer (Skalierung, Glyph-Name, Punktierung).
 * Entspricht `REST_TO_GLYPH`-Einträgen in `init_conf.rb`.
 */
export interface RestStyle {
  /** Skalierungsfaktor [x, y] relativ zu REST_SIZE */
  scale: [number, number]
  /** Name des Glyphen */
  glyphName: GlyphName
  dotted: boolean
}

export interface DecorationAnnotationConfig {
  text: string
  pos: [number, number]
  style: string
  align?: 'left' | 'right' | 'center'
  show?: 'all'
}

// ---------------------------------------------------------------------------
// Layout-Konfiguration
// ---------------------------------------------------------------------------

/**
 * Layout-Parameter für das Harfennoten-Sheet.
 * Entspricht `layout`-Abschnitt in `init_conf.rb`.
 */
export interface LayoutConfig {
  /** Standardgröße einer Ellipse [rx, ry] in mm */
  ELLIPSE_SIZE: [number, number]
  /** Größe eines Pausenzeichens [rx, ry] in mm */
  REST_SIZE: [number, number]
  LINE_THIN: number
  LINE_MEDIUM: number
  LINE_THICK: number
  /** Vertikaler Skalierungsfaktor (mm pro Beat) */
  Y_SCALE: number
  /** Horizontaler Abstand zwischen Stimmen in mm */
  X_SPACING: number
  /** Horizontaler Offset der ersten Stimme in mm */
  X_OFFSET: number
  /** Pitch-Offset: MIDI-Pitch der untersten Saite */
  PITCH_OFFSET: number
  /** Kürzeste Note (Beat-Einheiten) für Packer */
  SHORTEST_NOTE: number
  /** Beat-Auflösung (Einheiten pro Viertelnote, typisch 384) */
  BEAT_RESOLUTION: number
  /** Beats pro Notendauer-Einheit */
  BEAT_PER_DURATION: number
  /** Zeichenfläche [Breite, Höhe] in mm */
  DRAWING_AREA_SIZE: [number, number]
  /** Millimeter pro Punkt (für PDF-Ausgabe) */
  MM_PER_POINT: number
  color: {
    color_default: string
    color_variant1: string
    color_variant2: string
  }
  FONT_STYLE_DEF: Record<string, FontStyle>
  DURATION_TO_STYLE: Record<DurationKey, DurationStyle>
  /** Mapping Notendauer → Pausenzeichen-Stil */
  REST_TO_GLYPH: Record<DurationKey, RestStyle>
  /** ABC decorations that legacy renders as text annotations instead of glyphs. */
  DECORATIIONS_AS_ANNOTATIONS: Record<string, DecorationAnnotationConfig>
  /** Instrument-Bezeichnung (z.B. 'Harp') */
  instrument: string
  packer: { pack_method: 0 | 1 | 2 | 3 | 10; pack_min_increment?: number; pack_max_spreadfactor?: number }
  /** A3-Ausgabe auf A4-Breite begrenzen */
  limit_a3: boolean
  /** Gitternetz anzeigen */
  grid: boolean
  /** Jumpline anchor offset relative to the note size. */
  jumpline_anchor: [number, number]
  /** Vertical gap for long jumplines; 0 draws an unbroken vertical line. */
  jumpline_vcut?: number
  /** Mirror before/after anchors for bottom-up instruments. */
  bottomup?: boolean
}

// ---------------------------------------------------------------------------
// Drucker-Konfiguration
// ---------------------------------------------------------------------------

/**
 * Drucker-Parameter für PDF-Ausgabe.
 * Entspricht `printer`-Abschnitt in `init_conf.rb`.
 */
export interface PrinterConfig {
  /** Offset für A3-Ausgabe [x, y] in mm */
  a3Offset: [number, number]
  /** Offset für A4-Ausgabe [x, y] in mm */
  a4Offset: [number, number]
  /** Seitennummern für A4-Ausgabe (0-basiert) */
  a4Pages: number[]
  showBorder: boolean
}

// ---------------------------------------------------------------------------
// Extrakt-Konfiguration
// ---------------------------------------------------------------------------

/**
 * Konfiguration für Taktnummern-Anzeige.
 */
export interface BarnumberConfig {
  voices?: number[]
  pos?: [number, number]
  autopos?: boolean
  apbase?: [number, number]
  apanchor?: string
  style?: string
  prefix?: string
}

/**
 * Konfiguration für die Legende.
 */
export interface LegendConfig {
  spos?: [number, number]
  pos?: [number, number]
  tstyle?: string
  align?: string
  style?: string
}

/**
 * Konfiguration für eine einzelne Annotation im Sheet.
 */
export interface AnnotationConfig {
  pos: [number, number]
  text: string
  style: string
}

export interface PositionedTextConfig {
  pos?: [number, number]
  text?: string
  style?: string
}

/**
 * Konfiguration für einen Extrakt (eine Druckansicht).
 * Entspricht `extract.<nr>`-Abschnitt in der Zupfnoter-Konfiguration.
 *
 * Extrakt 0 ist der Standard-Extrakt; alle anderen erben von Extrakt 0
 * und überschreiben nur abweichende Werte.
 */
export interface ExtractConfig {
  title?: string
  filenamepart?: string
  /** Aktive Stimmen (1-basiert) */
  voices: number[]
  /** Stimmen, für die Flusslinien gezeichnet werden */
  flowlines: number[]
  /** Stimmen, für die Sub-Flusslinien gezeichnet werden */
  subflowlines: number[]
  /** Stimmen, für die Sprunglinien gezeichnet werden */
  jumplines: number[]
  /** Paare von Stimmen, zwischen denen Synchlinien gezeichnet werden */
  synchlines: number[][]
  /** Stimmen, für die Layout-Linien (Taktstriche) gezeichnet werden */
  layoutlines: number[]
  /** Beat-Position, ab der das Layout beginnt */
  startpos: number
  barnumbers?: BarnumberConfig
  legend?: LegendConfig
  notes?: Record<string, AnnotationConfig>
  repeatsigns?: Record<string, unknown>
  lyrics?: Record<string, unknown>
  nonflowrest?: boolean
  countnotes?: Record<string, unknown>
  stringnames?: Record<string, unknown>
  notebound?: Record<string, unknown>
  /** Layout-Overrides für diesen Extrakt */
  layout?: Partial<LayoutConfig>
  /** Drucker-Overrides für diesen Extrakt */
  printer?: Partial<PrinterConfig>
}

// ---------------------------------------------------------------------------
// Gesamt-Konfiguration
// ---------------------------------------------------------------------------

/**
 * Vollständige Zupfnoter-Konfiguration (aus dem `%%%%zupfnoter`-Block im ABC).
 */
export interface ZupfnoterConfig {
  layout: LayoutConfig
  extract: Record<string, ExtractConfig>
  printer: PrinterConfig
  /** Reihenfolge der zu erzeugenden Extrakte. Legacy-default für Sheet-Fixtures ist der erste Eintrag. */
  produce?: number[]
  annotations?: Record<string, PositionedTextConfig>
  /** Preset-Schnelleinstellungen für den Konfigurations-Editor (addconf). */
  presets?: Record<string, Record<string, unknown>>
}
