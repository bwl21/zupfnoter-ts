import { jsPDF } from 'jspdf'
import type { Annotation, DrawableElement, Ellipse, FlowLine, Glyph, Image, Path, Sheet } from '@zupfnoter/types'
import { GLYPHS } from './glyphs.js'

const COLORS: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  grey: [128, 128, 128],
  lightgrey: [211, 211, 211],
  darkgrey: [169, 169, 169],
  dimgrey: [105, 105, 105],
}

const DOTTED_SIZE = 0.5
const DEFAULT_COLOR: [number, number, number] = [0, 0, 0]

interface SvgPathCommand {
  command: 'M' | 'm' | 'L' | 'l' | 'C' | 'c' | 'Z' | 'z'
  values: number[]
}

type PdfLine = number[]

/**
 * Direkte jsPDF-Ausgabe aus dem Sheet.
 *
 * Port von `pdf_engine.rb`: Die PDF-Ausgabe wird bewusst nicht über das SVG
 * oder ein Canvas gerastert und läuft daher gleich in Browser und Node.js.
 */
export class PdfEngine {
  private pdf: jsPDF | undefined
  private xOffset = 0
  private yOffset = 0

  draw(sheet: Sheet): Blob {
    this.pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', precision: 2 })
    ;[this.xOffset, this.yOffset] = sheet.printerConfig?.a3_offset ?? [0, 0]
    this.drawSheet(sheet)
    return this.document().output('blob')
  }

  drawInSegments(sheet: Sheet, xSpacing: number): Blob {
    this.pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', precision: 2 })
    const [xOffset, yOffset] = sheet.printerConfig?.a4_offset ?? [0, 0]
    const pages = sheet.printerConfig?.a4_pages ?? [0, 1, 2]

    for (const [index, page] of pages.entries()) {
      if (index > 0) this.document().addPage('a4', 'p')
      this.xOffset = 30 + xOffset - page * 12 * xSpacing
      this.yOffset = yOffset
      this.drawSheet(sheet)
    }

    return this.document().output('blob')
  }

  private drawSheet(sheet: Sheet): void {
    const pdf = this.document()
    if (sheet.printerConfig?.show_border === true) {
      pdf.rect(this.x(1), this.y(1), 418, 295, 'S')
      pdf.rect(this.x(0), this.y(0), 420, 297, 'S')
    }

    for (const child of sheet.children) {
      if (!child.visible) continue
      pdf.setLineWidth(child.lineWidth)
      this.drawElement(child, sheet)
    }
  }

  private drawElement(element: DrawableElement, sheet: Sheet): void {
    switch (element.type) {
      case 'Ellipse': this.drawEllipse(element); break
      case 'FlowLine': this.drawFlowLine(element); break
      case 'Glyph': this.drawGlyph(element); break
      case 'Path': this.drawPath(element); break
      case 'Annotation': this.drawAnnotation(element, sheet); break
      case 'Image': this.drawImage(element); break
    }
  }

  private drawEllipse(element: Ellipse): void {
    const pdf = this.document()
    const color = this.color(element.color)
    const [cx, cy] = element.center
    const [rx, ry] = element.size
    this.setDrawColor(color)
    this.setFillColor(element.fill === 'filled' ? color : this.color('white'))
    pdf.setLineWidth(0)
    this.drawEllipseShape(cx, cy, rx, ry, element.rect, element.fill === 'filled' ? 'F' : 'FD')

    if (element.fill === 'empty') {
      pdf.setLineWidth(element.lineWidth)
      this.drawEllipseShape(cx, cy, rx - element.lineWidth / 2, ry - element.lineWidth / 2, element.rect, 'FD')
    }
    if (element.dotted) this.drawDot(element.center, element.size, element.lineWidth, color)
    if (element.hasbarover) {
      this.setFillColor(color)
      pdf.rect(this.x(cx - rx), this.y(cy - ry - 1.3 * element.lineWidth), rx * 2, 0.2, 'F')
    }
  }

  private drawEllipseShape(cx: number, cy: number, rx: number, ry: number, rect: boolean, style: 'F' | 'FD' | 'S'): void {
    const pdf = this.document()
    if (rect) {
      pdf.rect(this.x(cx - rx), this.y(cy - ry), rx * 2, ry * 2, style)
      return
    }
    pdf.ellipse(this.x(cx), this.y(cy), rx, ry, style)
  }

  private drawDot(center: [number, number], size: [number, number], lineWidth: number, color: [number, number, number]): void {
    const pdf = this.document()
    const x = center[0] + size[0] + DOTTED_SIZE + lineWidth
    const y = center[1]
    const surround = DOTTED_SIZE + lineWidth
    // The dot is a filled mark, not an outlined continuation of the notehead.
    // Empty noteheads leave their line width active here; resetting it keeps
    // PDF output consistent with SVG and the legacy PDF engine.
    pdf.setLineWidth(0)
    this.setDrawColor(this.color('white'))
    this.setFillColor(this.color('white'))
    pdf.ellipse(this.x(x), this.y(y), surround, surround, 'FD')
    this.setDrawColor(color)
    this.setFillColor(color)
    pdf.ellipse(this.x(x), this.y(y), DOTTED_SIZE, DOTTED_SIZE, 'FD')
  }

  private drawFlowLine(element: FlowLine): void {
    const pdf = this.document()
    this.setDrawColor(this.color(element.color))
    if (element.style === 'dashed') pdf.setLineDashPattern([3 / 2.84, 3 / 2.84], 3 / 2.84)
    if (element.style === 'dotted') pdf.setLineDashPattern([1.5 / 2.84, 1.5 / 2.84], 1.5 / 2.84)
    pdf.lines([[
      element.to[0] - element.from[0],
      element.to[1] - element.from[1],
    ]], this.x(element.from[0]), this.y(element.from[1]))
    pdf.setLineDashPattern([], 0)
  }

  private drawGlyph(element: Glyph): void {
    const glyph = GLYPHS[element.glyphName] ?? GLYPHS.error
    if (glyph === undefined) throw new Error('PdfEngine: missing error glyph')
    const color = this.color(element.color)
    const scale = (element.size[1] * 2) / glyph.h
    const [cx, cy] = element.center
    const pdf = this.document()

    this.setDrawColor(this.color('white'))
    this.setFillColor(this.color('white'))
    this.drawEllipseShape(cx, cy, element.size[0], element.size[1], true, 'FD')
    this.setDrawColor(color)
    this.setFillColor(color)
    pdf.setLineWidth(0.0001)
    this.drawGlyphPath(glyph.d, [cx, cy], [scale, scale])
    if (element.dotted) this.drawDot(element.center, element.size, element.lineWidth, color)
  }

  private drawPath(element: Path): void {
    const pathData = element.pathData ?? this.pathDataFromPoints(element.path)
    if (pathData === '') return
    const color = this.color(element.color)
    const pdf = this.document()
    this.setDrawColor(color)
    this.setFillColor(element.fill ? color : this.color('white'))
    pdf.setLineCap('round')
    this.drawPathData(pathData, element.fill)
  }

  private drawAnnotation(element: Annotation, sheet: Sheet): void {
    const style = sheet.layoutConfig?.FONT_STYLE_DEF[element.style]
      ?? sheet.layoutConfig?.FONT_STYLE_DEF.regular
    const fontSize = style?.fontSize ?? 12
    const fontStyle = style?.fontStyle ?? 'normal'
    const textColor = style?.textColor ?? this.color('black')
    const mmPerPoint = sheet.layoutConfig?.MM_PER_POINT ?? 0.3
    const text = element.text.replace(/(\\?)(~)/g, (_match, escaped: string) => escaped === '\\' ? '~' : ' ')
    const align = element.align ?? 'left'
    const pdf = this.document()
    this.setTextColor(textColor)
    pdf.setFont('helvetica', fontStyle)
    pdf.setFontSize(fontSize * 0.983)
    pdf.text(text.split('\n'), this.x(element.center[0]), this.y(element.center[1] + fontSize * mmPerPoint), { align })
  }

  private drawImage(element: Image): void {
    const mimeHeader = element.url.slice(0, element.url.indexOf(',')).trim().toLowerCase()
    const format = /^data:image\/(?:jpeg|jpg)(?:;|$)/.test(mimeHeader) ? 'jpeg'
      : /^data:image\/png(?:;|$)/.test(mimeHeader) ? 'png'
        : undefined
    if (format === undefined) throw new Error(`PdfEngine: unsupported image format (${mimeHeader || 'unknown'})`)
    this.document().addImage(
      element.url,
      format,
      this.x(element.position[0]),
      this.y(element.position[1]),
      0,
      element.height,
    )
  }

  private drawGlyphPath(pathData: string, center: [number, number], scale: [number, number]): void {
    let current: [number, number] | undefined
    let pathOpen = false
    const pdf = this.document()
    for (const command of this.parseSvgPath(pathData)) {
      if (command.command === 'M') {
        const x = command.values[0]
        const y = command.values[1]
        if (x === undefined || y === undefined) continue
        if (pathOpen) pdf.fillStroke()
        const next: [number, number] = [center[0] + x * scale[0], center[1] + y * scale[1]]
        pdf.moveTo(this.x(next[0]), this.y(next[1]))
        current = [x, y]
        pathOpen = true
      } else if (command.command === 'l' || command.command === 'm' || command.command === 'c') {
        if (current === undefined) continue
        if (command.command === 'm') {
          const dx = command.values[0]
          const dy = command.values[1]
          if (dx === undefined || dy === undefined) continue
          current = [current[0] + dx, current[1] + dy]
          pdf.moveTo(this.x(center[0] + current[0] * scale[0]), this.y(center[1] + current[1] * scale[1]))
          continue
        }
        if (command.command === 'l') {
          for (let index = 0; index + 1 < command.values.length; index += 2) {
            const dx = command.values[index] ?? 0
            const dy = command.values[index + 1] ?? 0
            current = [current[0] + dx, current[1] + dy]
            pdf.lineTo(this.x(center[0] + current[0] * scale[0]), this.y(center[1] + current[1] * scale[1]))
          }
          continue
        }
        for (let index = 0; index + 5 < command.values.length; index += 6) {
          const control1: [number, number] = [
            current[0] + (command.values[index] ?? 0),
            current[1] + (command.values[index + 1] ?? 0),
          ]
          const control2: [number, number] = [
            current[0] + (command.values[index + 2] ?? 0),
            current[1] + (command.values[index + 3] ?? 0),
          ]
          const end: [number, number] = [
            current[0] + (command.values[index + 4] ?? 0),
            current[1] + (command.values[index + 5] ?? 0),
          ]
          pdf.curveTo(
            this.x(center[0] + control1[0] * scale[0]),
            this.y(center[1] + control1[1] * scale[1]),
            this.x(center[0] + control2[0] * scale[0]),
            this.y(center[1] + control2[1] * scale[1]),
            this.x(center[0] + end[0] * scale[0]),
            this.y(center[1] + end[1] * scale[1]),
          )
          current = end
        }
      } else if (command.command === 'z') {
        if (!pathOpen) continue
        pdf.close()
        pdf.fillStroke()
        pathOpen = false
      }
    }
    if (pathOpen) pdf.fillStroke()
  }

  private drawPathData(pathData: string, filled: boolean): void {
    const style = filled ? 'FD' : 'S'
    let lines: PdfLine[] = []
    let start: [number, number] | undefined
    for (const command of this.parseSvgPath(pathData)) {
      if (command.command === 'M') {
        this.drawLines(lines, start, [1, 1], style, false)
        const x = command.values[0]
        const y = command.values[1]
        if (x !== undefined && y !== undefined) start = [x, y]
        lines = []
      } else if (command.command === 'L') {
        const x = command.values[0]
        const y = command.values[1]
        if (x === undefined || y === undefined || start === undefined) continue
        const newStart = this.pathEnd(start, lines)
        this.drawLines(lines, start, [1, 1], style, false)
        start = newStart
        lines = [[x - newStart[0], y - newStart[1]]]
      } else if (command.command === 'l' || command.command === 'c') {
        lines.push(command.values)
      } else if (command.command === 'z') {
        this.drawLines(lines, start, [1, 1], 'FD', true)
        lines = []
      }
    }
    this.drawLines(lines, start, [1, 1], style, false)
  }

  private pathEnd(start: [number, number], lines: PdfLine[]): [number, number] {
    return lines.reduce<[number, number]>((end, line) => {
      const x = line[line.length - 2]
      const y = line[line.length - 1]
      return x === undefined || y === undefined ? end : [end[0] + x, end[1] + y]
    }, start)
  }

  private drawLines(lines: PdfLine[], start: [number, number] | undefined, scale: [number, number], style: 'FD' | 'S', close: boolean): void {
    if (start === undefined || lines.length === 0) return
    this.document().lines(lines, this.x(start[0]), this.y(start[1]), scale, style, close)
  }

  private parseSvgPath(pathData: string): SvgPathCommand[] {
    const tokens = [...pathData.matchAll(/[MmLlCcZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)].map((match) => match[0] ?? '')
    const commands: SvgPathCommand[] = []
    let command: SvgPathCommand['command'] | undefined
    let values: number[] = []
    for (const token of tokens) {
      if (/^[MmLlCcZz]$/.test(token)) {
        if (command !== undefined) commands.push({ command, values })
        command = token as SvgPathCommand['command']
        values = []
      } else {
        values.push(Number(token))
      }
    }
    if (command !== undefined) commands.push({ command, values })
    return commands
  }

  private pathDataFromPoints(points: [number, number][]): string {
    const first = points[0]
    if (first === undefined) return ''
    return `M${first[0]} ${first[1]}${points.slice(1).map(([x, y]) => `L${x} ${y}`).join('')}`
  }

  private color(name: string): [number, number, number] {
    return COLORS[name] ?? DEFAULT_COLOR
  }

  private setDrawColor([red, green, blue]: [number, number, number]): void {
    this.document().setDrawColor(red, green, blue)
  }

  private setFillColor([red, green, blue]: [number, number, number]): void {
    this.document().setFillColor(red, green, blue)
  }

  private setTextColor([red, green, blue]: [number, number, number]): void {
    this.document().setTextColor(red, green, blue)
  }

  private x(value: number): number { return value + this.xOffset }
  private y(value: number): number { return value + this.yOffset }

  private document(): jsPDF {
    if (this.pdf === undefined) throw new Error('PdfEngine: document has not been initialized')
    return this.pdf
  }
}
