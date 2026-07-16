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
    this.pdf = new jsPDF('l', 'mm', 'a3')
    ;[this.xOffset, this.yOffset] = sheet.printerConfig?.a3_offset ?? [0, 0]
    this.drawSheet(sheet)
    return this.document().output('blob')
  }

  drawInSegments(sheet: Sheet, xSpacing: number): Blob {
    this.pdf = new jsPDF('p', 'mm', 'a4')
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
      this.drawEllipseShape(cx, cy, rx - element.lineWidth / 2, ry - element.lineWidth / 2, element.rect, 'S')
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
    if (element.style === 'dashed') pdf.setLineDashPattern([3 / 2.84], 0)
    if (element.style === 'dotted') pdf.setLineDashPattern([1.5 / 2.84], 0)
    pdf.line(this.x(element.from[0]), this.y(element.from[1]), this.x(element.to[0]), this.y(element.to[1]))
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
    this.drawSvgPath(glyph.d, cx, cy, scale, scale, true)
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
    this.drawSvgPath(pathData, 0, 0, 1, 1, element.fill)
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
    this.document().addImage(element.url, this.x(element.position[0]), this.y(element.position[1] - element.height), element.height, element.height)
  }

  private drawSvgPath(pathData: string, originX: number, originY: number, scaleX: number, scaleY: number, filled: boolean): void {
    const pdf = this.document()
    let currentX = 0
    let currentY = 0
    let startX = 0
    let startY = 0
    for (const command of this.parseSvgPath(pathData)) {
      const relative = command.command === command.command.toLowerCase()
      const values = command.values
      if (command.command.toLowerCase() === 'z') {
        pdf.lineTo(this.x(originX + startX * scaleX), this.y(originY + startY * scaleY))
        currentX = startX
        currentY = startY
        continue
      }
      for (let index = 0; index < values.length;) {
        if (command.command.toLowerCase() === 'm' || command.command.toLowerCase() === 'l') {
          const nextX = values[index]
          const nextY = values[index + 1]
          if (nextX === undefined || nextY === undefined) break
          const x = relative ? currentX + nextX : nextX
          const y = relative ? currentY + nextY : nextY
          if (command.command.toLowerCase() === 'm' && index === 0) {
            pdf.moveTo(this.x(originX + x * scaleX), this.y(originY + y * scaleY))
            startX = x
            startY = y
          } else {
            pdf.lineTo(this.x(originX + x * scaleX), this.y(originY + y * scaleY))
          }
          currentX = x
          currentY = y
          index += 2
          continue
        }
        const cp1x = values[index]
        const cp1y = values[index + 1]
        const cp2x = values[index + 2]
        const cp2y = values[index + 3]
        const nextX = values[index + 4]
        const nextY = values[index + 5]
        if (cp1x === undefined || cp1y === undefined || cp2x === undefined || cp2y === undefined || nextX === undefined || nextY === undefined) break
        const x1 = relative ? currentX + cp1x : cp1x
        const y1 = relative ? currentY + cp1y : cp1y
        const x2 = relative ? currentX + cp2x : cp2x
        const y2 = relative ? currentY + cp2y : cp2y
        const x = relative ? currentX + nextX : nextX
        const y = relative ? currentY + nextY : nextY
        pdf.curveTo(this.x(originX + x1 * scaleX), this.y(originY + y1 * scaleY), this.x(originX + x2 * scaleX), this.y(originY + y2 * scaleY), this.x(originX + x * scaleX), this.y(originY + y * scaleY))
        currentX = x
        currentY = y
        index += 6
      }
    }
    if (filled) pdf.fillStroke()
    else pdf.stroke()
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
