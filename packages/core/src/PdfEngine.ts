import { jsPDF } from 'jspdf'
import type { Sheet } from '@zupfnoter/types'
import { SvgEngine } from './SvgEngine.js'

/** jsPDF-Ausgabe für A3 und segmentierte A4-Druckbögen. */
export class PdfEngine {
  async draw(sheet: Sheet): Promise<Blob> {
    const pdf = new jsPDF('l', 'mm', 'a3')
    const [x, y] = sheet.printerConfig?.a3_offset ?? [0, 0]
    await pdf.addSvgAsImage(this.renderSvg(sheet), x, y, 420, 297)
    return pdf.output('blob')
  }

  async drawInSegments(sheet: Sheet, xSpacing: number): Promise<Blob> {
    const pdf = new jsPDF('p', 'mm', 'a4')
    const [xOffset, yOffset] = sheet.printerConfig?.a4_offset ?? [0, 0]
    const pages = sheet.printerConfig?.a4_pages ?? [0, 1, 2]
    const svg = this.renderSvg(sheet)
    for (const [index, page] of pages.entries()) {
      if (index > 0) pdf.addPage('a4', 'p')
      const x = 30 + xOffset - page * 12 * xSpacing
      await pdf.addSvgAsImage(svg, x, yOffset, 420, 297)
    }
    return pdf.output('blob')
  }

  private renderSvg(sheet: Sheet): string {
    return new SvgEngine({ showBorder: sheet.printerConfig?.show_border ?? false }).draw(sheet)
  }
}
