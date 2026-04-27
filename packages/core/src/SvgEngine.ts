/**
 * SvgEngine – renders a Sheet into an SVG string.
 *
 * Port of `Harpnotes::SvgEngine` from `svg_engine.rb`.
 * Produces a self-contained SVG string (no DOM dependency).
 *
 * Reference:
 *   docs/phase-0/architektur_zupfnoter.md
 *   src/svg_engine.rb (legacy)
 */

import type {
  Sheet,
  DrawableElement,
  Ellipse,
  FlowLine,
  Glyph,
  Annotation,
  Path,
  Image,
} from '@zupfnoter/types'
import { GLYPHS } from './glyphs.js'
import { requireDefined } from './requireDefined.js'

// ---------------------------------------------------------------------------
// Constants (from legacy svg_engine.rb)
// ---------------------------------------------------------------------------

const DOTTED_SIZE = 0.5   // radius of augmentation dot
const PADDING     = 5     // mm padding around drawing area

// ---------------------------------------------------------------------------
// SVG builder helpers (pure functions, no DOM)
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function attrs(obj: Record<string, string | number | undefined>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')
}

function svgEllipse(
  cx: number, cy: number,
  rx: number, ry: number,
  fill: string, stroke: string,
  strokeWidth: number,
  extra?: Record<string, string | number>,
): string {
  return `<ellipse ${attrs({ cx, cy, rx, ry, fill, stroke, 'stroke-width': strokeWidth, ...extra })} />`
}

function svgRect(
  x: number, y: number,
  w: number, h: number,
  fill: string, stroke: string,
  strokeWidth: number,
  extra?: Record<string, string | number>,
): string {
  return `<rect ${attrs({ x, y, width: w, height: h, fill, stroke, 'stroke-width': strokeWidth, ...extra })} />`
}

function svgLine(
  x1: number, y1: number,
  x2: number, y2: number,
  stroke: string, strokeWidth: number,
  dasharray?: string,
): string {
  const a: Record<string, string | number | undefined> = { x1, y1, x2, y2, stroke, 'stroke-width': strokeWidth }
  if (dasharray) a['stroke-dasharray'] = dasharray
  return `<line ${attrs(a)} />`
}

function svgPath(
  d: string,
  stroke: string, strokeWidth: number,
  fill: string,
  extra?: Record<string, string | number>,
): string {
  return `<path ${attrs({ d, stroke, 'stroke-width': strokeWidth, fill, 'stroke-linecap': 'round', ...extra })} />`
}

function svgText(
  x: number, y: number,
  text: string,
  fontSize: number,
  fontWeight: string,
  fontStyle: string,
  anchor: string,
  extra?: Record<string, string | number>,
): string {
  const lines = text.split('\n')
  if (lines.length === 1) {
    return `<text ${attrs({
      x, y,
      'font-size': fontSize,
      'font-family': 'Arial',
      'font-weight': fontWeight,
      'font-style': fontStyle,
      'text-anchor': anchor,
      ...extra,
    })}>${esc(text)}</text>`
  }
  // Multi-line: use tspan
  const lineHeight = fontSize * 1.2
  const tspans = lines.map((line, i) =>
    `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`,
  ).join('')
  return `<text ${attrs({
    x, y,
    'font-size': fontSize,
    'font-family': 'Arial',
    'font-weight': fontWeight,
    'font-style': fontStyle,
    'text-anchor': anchor,
    ...extra,
  })}>${tspans}</text>`
}

function pathFromPoints(points: [number, number][]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  const start = requireDefined(first, 'SvgEngine.pathFromPoints(): expected first point')
  return `M${start[0]},${start[1]} ` + rest.map(([x, y]) => `L${x},${y}`).join(' ')
}

function dashArray(style: 'solid' | 'dashed' | 'dotted', lineWidth: number): string | undefined {
  if (style === 'dashed') return `${lineWidth * 3},${lineWidth * 2}`
  if (style === 'dotted') return `${lineWidth},${lineWidth * 2}`
  return undefined
}

// ---------------------------------------------------------------------------
// SvgEngine
// ---------------------------------------------------------------------------

export interface SvgEngineOptions {
  /** Width of the drawing area in mm (default: 400) */
  width?: number
  /** Height of the drawing area in mm (default: 282) */
  height?: number
  /** Font size definitions per style name */
  fontStyles?: Record<string, { fontSize: number; fontStyle: string }>
}

export class SvgEngine {
  private _width: number
  private _height: number
  private _fontStyles: Record<string, { fontSize: number; fontStyle: string }>

  constructor(options: SvgEngineOptions = {}) {
    this._width  = options.width  ?? 400
    this._height = options.height ?? 282
    this._fontStyles = options.fontStyles ?? {
      regular: { fontSize: 4,   fontStyle: 'normal' },
      bold:    { fontSize: 4,   fontStyle: 'bold'   },
      large:   { fontSize: 7,   fontStyle: 'bold'   },
      small:   { fontSize: 3,   fontStyle: 'normal' },
      smaller: { fontSize: 2,   fontStyle: 'normal' },
    }
  }

  /**
   * Render a Sheet into an SVG string.
   * Corresponds to SvgEngine#draw in svg_engine.rb.
   */
  draw(sheet: Sheet): string {
    const elements: string[] = []

    // Border
    elements.push(svgRect(1, 1, this._width - 2, this._height - 2, 'none', 'black', 0.5))

    for (const child of sheet.children) {
      if (!child.visible) continue
      const svg = this._drawElement(child)
      if (svg) elements.push(svg)
    }

    return this._wrapSvg(elements.join('\n'))
  }

  /**
   * Dispatch to the appropriate draw method.
   */
  private _drawElement(el: DrawableElement): string | null {
    switch (el.type) {
      case 'Ellipse':    return this._drawEllipse(el as Ellipse)
      case 'FlowLine':   return this._drawFlowLine(el as FlowLine)
      case 'Glyph':      return this._drawGlyph(el as Glyph)
      case 'Annotation': return this._drawAnnotation(el as Annotation)
      case 'Path':       return this._drawPath(el as Path)
      case 'Image':      return this._drawImage(el as Image)
      default:           return null
    }
  }

  // ---------------------------------------------------------------------------
  // Ellipse
  // ---------------------------------------------------------------------------

  private _drawEllipse(el: Ellipse): string {
    const [cx, cy] = el.center
    const [rx, ry] = el.size
    const color = el.color
    const parts: string[] = []

    if (el.fill === 'filled') {
      parts.push(svgEllipse(cx, cy, rx, ry, color, color, el.lineWidth))
    } else {
      // White background, then border
      parts.push(svgEllipse(cx, cy, rx, ry, 'white', 'white', 0))
      parts.push(svgEllipse(cx, cy, rx - el.lineWidth / 2, ry - el.lineWidth / 2, 'white', color, el.lineWidth))
    }

    if (el.dotted) {
      parts.push(this._drawDot(cx + rx + DOTTED_SIZE + el.lineWidth, cy, color, el.lineWidth))
    }

    if (el.hasbarover) {
      parts.push(this._drawBarover(cx, cy, rx, ry, color, el.lineWidth))
    }

    return parts.join('\n')
  }

  // ---------------------------------------------------------------------------
  // Glyph (rest symbols)
  // ---------------------------------------------------------------------------

  private _drawGlyph(el: Glyph): string {
    const [cx, cy] = el.center
    const [, sh] = el.size
    const color = el.color
    const parts: string[] = []

    const glyphDef = GLYPHS[el.glyphName]
    if (!glyphDef) return ''

    const scaleFactor = (sh * 2) / glyphDef.h
    const pathStr = glyphDef.d

    // White background rect
    parts.push(svgRect(
      cx - el.size[0], cy - el.size[1],
      el.size[0] * 2, el.size[1] * 2,
      'white', 'white', 0,
    ))

    // Glyph path with transform
    parts.push(svgPath(
      pathStr,
      color, el.lineWidth, color,
      { transform: `translate(${cx},${cy}) scale(${scaleFactor})` },
    ))

    if (el.dotted) {
      parts.push(this._drawDot(cx + el.size[0] + DOTTED_SIZE + el.lineWidth, cy, color, el.lineWidth))
    }

    return parts.join('\n')
  }

  // ---------------------------------------------------------------------------
  // FlowLine
  // ---------------------------------------------------------------------------

  private _drawFlowLine(el: FlowLine): string {
    const [x1, y1] = el.from
    const [x2, y2] = el.to
    const dash = dashArray(el.style, el.lineWidth)
    return svgLine(x1, y1, x2, y2, el.color, el.lineWidth, dash)
  }

  // ---------------------------------------------------------------------------
  // Path
  // ---------------------------------------------------------------------------

  private _drawPath(el: Path): string {
    const d = pathFromPoints(el.path)
    if (!d) return ''
    const fill = el.fill ? el.color : 'none'
    return svgPath(d, el.color, el.lineWidth, fill)
  }

  // ---------------------------------------------------------------------------
  // Annotation
  // ---------------------------------------------------------------------------

  private _drawAnnotation(el: Annotation): string {
    const [x, y] = el.center
    let style = this._fontStyles[el.style]
    if (style === undefined) {
      style = requireDefined(this._fontStyles['regular'], 'SvgEngine: missing default font style "regular"')
    }
    const fontSize = style.fontSize
    const fontWeight = style.fontStyle.includes('bold') ? 'bold' : 'normal'
    const fontStyle  = style.fontStyle.includes('italic') ? 'italic' : 'normal'
    return svgText(x, y, el.text, fontSize, fontWeight, fontStyle, 'start')
  }

  // ---------------------------------------------------------------------------
  // Image
  // ---------------------------------------------------------------------------

  private _drawImage(el: Image): string {
    const [x, y] = el.position
    // height is given, width is proportional (SVG preserveAspectRatio handles it)
    return `<image href="${esc(el.url)}" x="${x}" y="${y - el.height}" height="${el.height}" preserveAspectRatio="xMinYMin meet" />`
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _drawDot(x: number, y: number, color: string, lineWidth: number): string {
    const ds = DOTTED_SIZE + lineWidth
    return [
      svgEllipse(x, y, ds, ds, 'white', 'white', 0),
      svgEllipse(x, y, DOTTED_SIZE, DOTTED_SIZE, color, color, 0),
    ].join('\n')
  }

  private _drawBarover(cx: number, cy: number, rx: number, ry: number, color: string, lineWidth: number): string {
    return svgRect(
      cx - rx, cy - ry - 1.5 * lineWidth,
      2 * rx, 0.5,
      color, color, 0,
    )
  }

  private _wrapSvg(content: string): string {
    const w = this._width + 2 * PADDING
    const h = this._height + 2 * PADDING
    return [
      `<svg xmlns="http://www.w3.org/2000/svg"`,
      `  viewBox="${-PADDING} ${-PADDING} ${w} ${h}"`,
      `  width="${w}mm" height="${h}mm">`,
      content,
      `</svg>`,
    ].join('\n')
  }
}
