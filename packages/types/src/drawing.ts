/**
 * Harpnotes Drawing Model – Stufe 3 der Transformationskette.
 *
 * Entspricht `Harpnotes::Drawing` in `harpnotes.rb`.
 * Keine Logik — nur Typdefinitionen.
 */

import type { Note, Pause, PlayableEntity } from './music.js'

// ---------------------------------------------------------------------------
// Basis
// ---------------------------------------------------------------------------

/** Füllstil einer Ellipse oder eines Glyphs */
export type FillStyle = 'filled' | 'empty'

/**
 * Gemeinsame Basis aller zeichenbaren Elemente.
 * Entspricht `Harpnotes::Drawing::Drawable`.
 */
export interface Drawable {
  color: string
  lineWidth: number
  confKey?: string
  visible: boolean
}

// ---------------------------------------------------------------------------
// Konkrete Drawables
// ---------------------------------------------------------------------------

/**
 * Ellipse — repräsentiert eine Note oder Pause im Sheet.
 * Entspricht `Harpnotes::Drawing::Ellipse`.
 */
export interface Ellipse extends Drawable {
  readonly type: 'Ellipse'
  /** Mittelpunkt [x, y] in mm */
  center: [number, number]
  /** Radien [rx, ry] in mm */
  size: [number, number]
  fill: FillStyle
  dotted: boolean
  /** Balken über der Ellipse (für halbe Noten) */
  hasbarover: boolean
  /** Rückverweis auf die zugehörige Note oder Pause */
  origin?: Note | Pause
}

/**
 * Verbindungslinie zwischen zwei Noten (Fluss, Subfluss).
 * Entspricht `Harpnotes::Drawing::FlowLine`.
 */
export interface FlowLine extends Drawable {
  readonly type: 'FlowLine'
  from: [number, number]
  to: [number, number]
  style: 'solid' | 'dashed' | 'dotted'
}

/**
 * Beliebiger Pfad (Sprunglinien, Tuplet-Klammern).
 * Entspricht `Harpnotes::Drawing::Path`.
 *
 * `path` ist ein Array von Punkten [x, y] in mm.
 */
export interface Path extends Drawable {
  readonly type: 'Path'
  path: [number, number][]
  fill: boolean
}

/**
 * Textannotation (Legende, Taktnummern, Liedtext, Beschriftungen).
 * Entspricht `Harpnotes::Drawing::Annotation`.
 */
export interface Annotation extends Drawable {
  readonly type: 'Annotation'
  center: [number, number]
  text: string
  style: string
  size?: [number, number]
  origin?: PlayableEntity
}

/**
 * Pausenzeichen (Glyph aus einer Schriftart).
 * Entspricht `Harpnotes::Drawing::Glyph`.
 */
export interface Glyph extends Drawable {
  readonly type: 'Glyph'
  center: [number, number]
  size: [number, number]
  glyphName: string
  dotted: boolean
  fill: FillStyle
}

/**
 * Eingebettetes Bild (z.B. Instrumentenform).
 * Entspricht `Harpnotes::Drawing::Image`.
 */
export interface Image extends Drawable {
  readonly type: 'Image'
  url: string
  position: [number, number]
  height: number
}

// ---------------------------------------------------------------------------
// Union-Typ und Sheet
// ---------------------------------------------------------------------------

export type DrawableElement = Ellipse | FlowLine | Path | Annotation | Glyph | Image

/**
 * Das vollständige Drawing-Modell (Ergebnis von Stufe 2: Song → Sheet).
 * Entspricht `Harpnotes::Drawing::Sheet`.
 */
export interface Sheet {
  children: DrawableElement[]
  activeVoices: number[]
}
