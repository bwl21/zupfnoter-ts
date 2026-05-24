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

const DOTTED_SIZE = 0.5
const PADDING = 5
const LEGACY_PAGE_WIDTH = 420
const LEGACY_PAGE_HEIGHT = 297
const LEGACY_RENDER_WIDTH = 2200
const LEGACY_RENDER_HEIGHT = 1400

// ---------------------------------------------------------------------------
// SVG builder helpers
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
    .map(([k, v]) => `${k}="${typeof v === 'string' ? esc(v) : v}"`)
    .join(' ')
}

function svgGroup(
  content: string,
  extra?: Record<string, string | number | undefined>,
): string {
  const renderedAttrs = attrs(extra ?? {})
  return renderedAttrs.length > 0 ? `<g ${renderedAttrs}>${content}</g>` : `<g>${content}</g>`
}

function svgEllipse(
  cx: number, cy: number,
  rx: number, ry: number,
  fill: string, stroke: string,
  strokeWidth: number,
  extra?: Record<string, string | number | undefined>,
): string {
  return `<ellipse ${attrs({ cx, cy, rx, ry, fill, stroke, 'stroke-width': strokeWidth, ...extra })} />`
}

function svgRect(
  x: number, y: number,
  w: number, h: number,
  fill: string, stroke: string,
  strokeWidth: number,
  extra?: Record<string, string | number | undefined>,
): string {
  return `<rect ${attrs({ x, y, width: w, height: h, fill, stroke, 'stroke-width': strokeWidth, ...extra })} />`
}

function svgLine(
  x1: number, y1: number,
  x2: number, y2: number,
  stroke: string, strokeWidth: number,
  dasharray?: string,
  extra?: Record<string, string | number | undefined>,
): string {
  const a: Record<string, string | number | undefined> = {
    x1,
    y1,
    x2,
    y2,
    fill: 'none',
    stroke,
    'stroke-width': strokeWidth,
    ...extra,
  }
  if (dasharray) a['stroke-dasharray'] = dasharray
  return `<line ${attrs(a)} />`
}

function svgPath(
  d: string,
  stroke: string,
  strokeWidth: number,
  fill: string,
  extra?: Record<string, string | number | undefined>,
  linecap?: string,
): string {
  return `<path ${attrs({
    d,
    fill,
    stroke,
    'stroke-width': strokeWidth,
    'stroke-linecap': linecap ?? 'round',
    ...extra,
  })} />`
}

function svgText(
  x: number, y: number,
  text: string,
  fontSize: number,
  fontWeight: string,
  fontStyle: string,
  anchor: string,
  extra?: Record<string, string | number | undefined>,
  legacy = false,
): string {
  const textAttrs: Record<string, string | number | undefined> = {
    x,
    y,
    fill: 'black',
    stroke: 'none',
    'font-size': legacy ? fontSize / 3 : fontSize,
    'font-family': 'Arial',
    'font-weight': fontWeight,
    'font-style': fontStyle,
    'text-anchor': anchor,
    ...extra,
  }
  if (legacy) {
    textAttrs.transform = `scale(1.05, 1) translate(0,${-fontSize / 8})`
    textAttrs.x = x / 1.05
  }
  const renderedText = legacy
    ? text
        .replace(/ +\n/g, '\n')
        .replace(/\n\n/g, '\n \n')
        .replace(/(\\?)(~)/g, (match) => (match.startsWith('\\') ? match.slice(1) : '\u00a0'))
    : text
  const lines = renderedText.split('\n')
  const tspans = legacy
    ? lines.map((line) => `<tspan dy="1.2em" x="${x / 1.05}">${esc(line)}</tspan>`).join('')
    : lines.length === 1
      ? esc(renderedText)
      : lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : fontSize * 1.2}">${esc(line)}</tspan>`).join('')
  return `<text ${attrs(textAttrs)}>${tspans}</text>`
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

function dashArrayLegacy(style: 'solid' | 'dashed' | 'dotted'): string | undefined {
  if (style === 'dashed') return `${3 / 2.84} ${3 / 2.84}`
  if (style === 'dotted') return `${1.5 / 2.84} ${1.5 / 2.84}`
  return undefined
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function sanitizeForId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${value}`
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

interface ElementMeta {
  id: string
  classes: string
  dataRole: string
  dataType: string
  dataAnchor: string
  dataAnchorKey: string
  dataIndex: number
  znId?: string
  confKey?: string
}

export class SvgEngine {
  private _width: number
  private _height: number
  private _fontStyles: Record<string, { fontSize: number; fontStyle: string }>
  private _useLegacyFrame: boolean

  constructor(options: SvgEngineOptions = {}) {
    this._useLegacyFrame = options.width === undefined && options.height === undefined
    this._width = options.width ?? LEGACY_PAGE_WIDTH
    this._height = options.height ?? LEGACY_PAGE_HEIGHT
    this._fontStyles = options.fontStyles ?? {
      regular: { fontSize: 12, fontStyle: 'normal' },
      bold: { fontSize: 12, fontStyle: 'bold' },
      large: { fontSize: 20, fontStyle: 'bold' },
      small_bold: { fontSize: 9, fontStyle: 'bold' },
      small_italic: { fontSize: 9, fontStyle: 'italic' },
      small: { fontSize: 9, fontStyle: 'normal' },
      smaller: { fontSize: 6, fontStyle: 'normal' },
    }
  }

  /**
   * Render a Sheet into an SVG string.
   * Corresponds to SvgEngine#draw in svg_engine.rb.
   */
  draw(sheet: Sheet): string {
    const layers: string[] = []
    if (this._useLegacyFrame) {
      layers.push(svgGroup(
        [
          svgRect(1, 1, this._width - 2, this._height - 2, 'none', 'black', 0.2, {
            class: 'zupfnoter-border',
            'data-role': 'border',
            'data-kind': 'sheet-border',
          }),
          svgRect(0, 0, this._width, this._height, 'none', 'black', 0.2, {
            class: 'zupfnoter-border',
            'data-role': 'border',
            'data-kind': 'sheet-border-outer',
          }),
        ].join('\n'),
        { class: 'zupfnoter-layer zupfnoter-layer--border', 'data-layer': 'border' },
      ))
    } else {
      layers.push(svgGroup(
        svgRect(1, 1, this._width - 2, this._height - 2, 'none', 'black', 0.5, {
          class: 'zupfnoter-border',
          'data-role': 'border',
          'data-kind': 'sheet-border',
        }),
        { class: 'zupfnoter-layer zupfnoter-layer--border', 'data-layer': 'border' },
      ))
    }

    const content = sheet.children
      .map((child, index) => {
        if (!child.visible) return ''
        return this._drawElement(child, index)
      })
      .filter((svg): svg is string => svg.length > 0)
      .join('\n')

    layers.push(svgGroup(content, {
      class: 'zupfnoter-layer zupfnoter-layer--content',
      'data-layer': 'content',
      'data-active-voices': sheet.activeVoices.join(','),
    }))

    return this._wrapSvg(layers.join('\n'))
  }

  /**
   * Dispatch to the appropriate draw method.
   */
  private _drawElement(el: DrawableElement, index: number): string {
    switch (el.type) {
      case 'Ellipse':
        return this._drawEllipse(el as Ellipse, index)
      case 'FlowLine':
        return this._drawFlowLine(el as FlowLine, index)
      case 'Glyph':
        return this._drawGlyph(el as Glyph, index)
      case 'Annotation':
        return this._drawAnnotation(el as Annotation, index)
      case 'Path':
        return this._drawPath(el as Path, index)
      case 'Image':
        return this._drawImage(el as Image, index)
      default:
        return ''
    }
  }

  private _buildMeta(
    kind: string,
    role: string,
    index: number,
    anchorKey: string,
    confKey?: string,
    znId?: string,
  ): ElementMeta {
    const normalizedAnchorKey = anchorKey.trim().length > 0 ? anchorKey : `${kind}:${index}`
    const normalizedZnId = znId?.trim()
    const anchorSource = normalizedZnId && normalizedZnId.length > 0
      ? normalizedZnId
      : (confKey?.trim().length ?? 0) > 0
        ? requireDefined(confKey, 'SvgEngine._buildMeta(): missing confKey after length check')
        : normalizedAnchorKey
    const slug = sanitizeForId(anchorSource)
    const idBase = slug.length > 0 ? slug : stableHash(anchorSource)
    const anchor = `zn-${sanitizeForId(kind)}-${idBase}-${index}`
    return {
      id: anchor,
      classes: [
        'zupfnoter-element',
        `zupfnoter-element--${sanitizeForId(kind)}`,
        `zupfnoter-role--${sanitizeForId(role)}`,
      ].join(' '),
      dataRole: role,
      dataType: kind,
      dataAnchor: anchor,
      dataAnchorKey: anchorSource,
      dataIndex: index,
      znId: normalizedZnId && normalizedZnId.length > 0 ? normalizedZnId : undefined,
      confKey,
    }
  }

  private _wrapElement(meta: ElementMeta, content: string, hitbox?: string): string {
    const groupAttrs: Record<string, string | number | undefined> = {
      id: meta.id,
      class: meta.classes,
      'data-role': meta.dataRole,
      'data-type': meta.dataType,
      'data-anchor': meta.dataAnchor,
      'data-anchor-key': meta.dataAnchorKey,
      'data-index': meta.dataIndex,
      'data-zn-id': meta.znId,
    }
    if (meta.confKey !== undefined) groupAttrs['data-conf-key'] = meta.confKey
    const inner = [content, hitbox].filter((part): part is string => part !== undefined && part.length > 0).join('\n')
    return svgGroup(inner, groupAttrs)
  }

  private _hitboxRect(
    x: number,
    y: number,
    width: number,
    height: number,
    meta: ElementMeta,
    padding = 0,
  ): string {
    return `<rect ${attrs({
      x: x - padding,
      y: y - padding,
      width: width + padding * 2,
      height: height + padding * 2,
      id: `${meta.id}-hitbox`,
      class: `${meta.classes} zupfnoter-hitbox`,
      'data-role': 'hitbox',
        'data-hitbox-for': meta.dataAnchor,
        'data-hitbox-target': meta.dataAnchor,
        'data-zn-id': meta.znId,
        'pointer-events': 'all',
        'aria-hidden': 'true',
      })} />`
  }

  // ---------------------------------------------------------------------------
  // Ellipse
  // ---------------------------------------------------------------------------

  private _drawEllipse(el: Ellipse, index: number): string {
    const [cx, cy] = el.center
    const [rx, ry] = el.size
    const color = el.color
    const meta = this._buildMeta(
      'Ellipse',
      el.fill === 'filled' ? 'notehead' : 'notehead-outline',
      index,
      el.confKey ?? `ellipse:${formatNumber(cx)}:${formatNumber(cy)}:${formatNumber(rx)}:${formatNumber(ry)}:${el.fill}:${el.dotted ? 'dotted' : 'plain'}:${el.hasbarover ? 'bar' : 'nobar'}`,
      el.confKey,
      el.znId,
    )

    const parts: string[] = []

    if (el.fill === 'filled') {
      parts.push(svgEllipse(cx, cy, rx, ry, color, color, this._useLegacyFrame ? 0 : el.lineWidth, {
        class: 'zupfnoter-shape zupfnoter-shape--ellipse zupfnoter-shape--filled',
      }))
    } else {
      parts.push(svgEllipse(cx, cy, rx, ry, 'white', 'white', 0, {
        class: 'zupfnoter-shape zupfnoter-shape--ellipse zupfnoter-shape--background',
      }))
      parts.push(svgEllipse(cx, cy, rx - el.lineWidth / 2, ry - el.lineWidth / 2, 'white', color, el.lineWidth, {
        class: 'zupfnoter-shape zupfnoter-shape--ellipse zupfnoter-shape--outline',
      }))
    }

    if (el.dotted) {
      parts.push(this._drawDot(cx + rx + DOTTED_SIZE + el.lineWidth, cy, color, el.lineWidth))
    }

    if (el.hasbarover) {
      parts.push(this._drawBarover(cx, cy, rx, ry, color, el.lineWidth))
    }

    const hitboxPad = Math.max(0.5, el.lineWidth + (el.dotted ? 0.5 : 0.25) + (el.hasbarover ? 0.5 : 0))
    return this._wrapElement(meta, parts.join('\n'), this._hitboxRect(cx - rx, cy - ry, 2 * rx, 2 * ry, meta, hitboxPad))
  }

  // ---------------------------------------------------------------------------
  // Glyph (rest symbols)
  // ---------------------------------------------------------------------------

  private _drawGlyph(el: Glyph, index: number): string {
    const [cx, cy] = el.center
    const [, sh] = el.size
    const color = el.color
    const glyphDef = GLYPHS[el.glyphName]
    if (!glyphDef) return ''

    const meta = this._buildMeta(
      'Glyph',
      'rest',
      index,
      el.confKey ?? `glyph:${el.glyphName}:${formatNumber(cx)}:${formatNumber(cy)}:${formatNumber(el.size[0])}:${formatNumber(el.size[1])}:${el.dotted ? 'dotted' : 'plain'}`,
      el.confKey,
      el.znId,
    )

    const scaleFactor = (sh * 2) / glyphDef.h
    const pathStr = glyphDef.d
    const parts: string[] = []

    parts.push(svgRect(
      cx - el.size[0], cy - el.size[1],
      el.size[0] * 2, el.size[1] * 2,
      'white', 'white', 0,
      { class: 'zupfnoter-shape zupfnoter-shape--glyph-background' },
    ))

    parts.push(svgPath(
      pathStr,
      color,
      el.lineWidth,
      color,
      {
        class: 'zupfnoter-shape zupfnoter-shape--glyph',
        transform: `translate(${cx},${cy}) scale(${scaleFactor})`,
      },
    ))

    if (el.dotted) {
      parts.push(this._drawDot(cx + el.size[0] + DOTTED_SIZE + el.lineWidth, cy, color, el.lineWidth))
    }

    return this._wrapElement(meta, parts.join('\n'), this._hitboxRect(cx - el.size[0], cy - el.size[1], el.size[0] * 2, el.size[1] * 2, meta, 0.5))
  }

  // ---------------------------------------------------------------------------
  // FlowLine
  // ---------------------------------------------------------------------------

  private _drawFlowLine(el: FlowLine, index: number): string {
    const [x1, y1] = el.from
    const [x2, y2] = el.to
    const dash = this._useLegacyFrame ? dashArrayLegacy(el.style) : dashArray(el.style, el.lineWidth)
    const meta = this._buildMeta(
      'FlowLine',
      el.style === 'solid' ? 'flowline' : `flowline-${el.style}`,
      index,
      el.confKey ?? `flowline:${formatNumber(x1)}:${formatNumber(y1)}:${formatNumber(x2)}:${formatNumber(y2)}:${el.style}:${formatNumber(el.lineWidth)}`,
      el.confKey,
      el.znId,
    )
    const content = this._useLegacyFrame
      ? svgPath(
          `M${formatNumber(x1)},${formatNumber(y1)}L${formatNumber(x2)},${formatNumber(y2)}`,
          el.color,
          el.lineWidth,
          'none',
          {
            class: 'zupfnoter-shape zupfnoter-shape--flowline',
            'data-flow-style': el.style,
            'stroke-dasharray': dash,
          },
          'butt',
        )
      : svgLine(x1, y1, x2, y2, el.color, el.lineWidth, dash, {
          class: 'zupfnoter-shape zupfnoter-shape--flowline',
          'data-flow-style': el.style,
        })
    return this._wrapElement(meta, content)
  }

  // ---------------------------------------------------------------------------
  // Path
  // ---------------------------------------------------------------------------

  private _drawPath(el: Path, index: number): string {
    const d = el.pathData ?? pathFromPoints(el.path)
    if (!d) return ''
    const meta = this._buildMeta(
      'Path',
      el.fill ? 'path-filled' : 'path-outline',
      index,
      el.confKey ?? `path:${el.path.map(([x, y]) => `${formatNumber(x)},${formatNumber(y)}`).join('|')}:${el.fill ? 'filled' : 'empty'}:${formatNumber(el.lineWidth)}`,
      el.confKey,
      el.znId,
    )
    const fill = el.fill ? el.color : 'none'
    const content = svgPath(d, el.color, el.lineWidth, fill, {
      class: 'zupfnoter-shape zupfnoter-shape--path',
      'data-filled': el.fill ? 'true' : 'false',
    })
    return this._wrapElement(meta, content)
  }

  // ---------------------------------------------------------------------------
  // Annotation
  // ---------------------------------------------------------------------------

  private _drawAnnotation(el: Annotation, index: number): string {
    const [x, y] = el.center
    let style = this._fontStyles[el.style]
    if (style === undefined) {
      style = requireDefined(this._fontStyles.regular, 'SvgEngine: missing default font style "regular"')
    }
  const meta = this._buildMeta(
      'Annotation',
      'annotation',
      index,
      el.confKey ?? `annotation:${formatNumber(x)}:${formatNumber(y)}:${el.style}:${el.text}`,
      el.confKey,
      el.znId,
    )
    const anchor = el.align === 'center'
      ? 'middle'
      : el.align === 'right'
        ? 'end'
        : 'start'
    return this._wrapElement(
      meta,
      svgText(x, y, el.text, style.fontSize, style.fontStyle.includes('bold') ? 'bold' : 'normal', style.fontStyle.includes('italic') ? 'italic' : 'normal', anchor, {
        class: 'zupfnoter-shape zupfnoter-shape--annotation',
        'data-style': el.style,
      }, this._useLegacyFrame),
    )
  }

  // ---------------------------------------------------------------------------
  // Image
  // ---------------------------------------------------------------------------

  private _drawImage(el: Image, index: number): string {
    const [x, y] = el.position
    const meta = this._buildMeta(
      'Image',
      'image',
      index,
      el.confKey ?? `image:${el.url}:${formatNumber(x)}:${formatNumber(y)}:${formatNumber(el.height)}`,
      el.confKey,
      el.znId,
    )
    const content = `<image ${attrs({
      href: el.url,
      x,
      y: y - el.height,
      height: el.height,
      preserveAspectRatio: 'xMinYMin meet',
      fill: 'none',
      stroke: 'none',
      class: 'zupfnoter-shape zupfnoter-shape--image',
    })} />`
    return this._wrapElement(meta, content)
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _drawDot(x: number, y: number, color: string, lineWidth: number): string {
    const ds = DOTTED_SIZE + lineWidth
    return [
      svgEllipse(x, y, ds, ds, 'white', 'white', 0, {
        class: 'zupfnoter-shape zupfnoter-shape--dot zupfnoter-shape--dot-background',
      }),
      svgEllipse(x, y, DOTTED_SIZE, DOTTED_SIZE, color, color, 0, {
        class: 'zupfnoter-shape zupfnoter-shape--dot zupfnoter-shape--dot-ink',
      }),
    ].join('\n')
  }

  private _drawBarover(cx: number, cy: number, rx: number, ry: number, color: string, lineWidth: number): string {
    return svgRect(
      cx - rx,
      cy - ry - 1.5 * lineWidth,
      2 * rx,
      0.5,
      color,
      color,
      0,
      {
        class: 'zupfnoter-shape zupfnoter-shape--barover',
      },
    )
  }

  private _wrapSvg(content: string): string {
    if (this._useLegacyFrame) {
      return [
        `<svg xmlns="http://www.w3.org/2000/svg"`,
        `  width="${LEGACY_RENDER_WIDTH}" height="${LEGACY_RENDER_HEIGHT}"`,
        `  viewBox="0, 0, ${LEGACY_PAGE_WIDTH}, ${LEGACY_PAGE_HEIGHT}"`,
        `  class="zupfnoter-svg" data-engine="SvgEngine">`,
        content,
        `</svg>`,
      ].join('\n')
    }

    const w = this._width + 2 * PADDING
    const h = this._height + 2 * PADDING
    return [
      `<svg xmlns="http://www.w3.org/2000/svg"`,
      `  viewBox="${-PADDING} ${-PADDING} ${w} ${h}"`,
      `  width="${w}mm" height="${h}mm"`,
      `  class="zupfnoter-svg" data-engine="SvgEngine">`,
      content,
      `</svg>`,
    ].join('\n')
  }
}
