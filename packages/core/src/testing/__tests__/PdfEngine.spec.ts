import { describe, expect, it } from 'vitest'

import type { Sheet } from '@zupfnoter/types'
import { PdfEngine } from '../../PdfEngine.js'

const sheet: Sheet = {
  activeVoices: [1],
  children: [{
    type: 'Ellipse',
    center: [20, 30],
    size: [3, 2],
    fill: 'filled',
    dotted: false,
    rect: false,
    hasbarover: false,
    color: 'black',
    lineWidth: 0.2,
    visible: true,
  }],
  printerConfig: {
    a3_offset: [2, 3],
    a4_offset: [-1, 4],
    a4_pages: [1, 2],
    show_border: true,
  },
  layoutConfig: {
    FONT_STYLE_DEF: {
      regular: { textColor: [0, 0, 0], fontSize: 12, fontStyle: 'normal' },
    },
    MM_PER_POINT: 0.3,
  },
}

async function pdfText(pdf: Blob): Promise<string> {
  return new TextDecoder('latin1').decode(await pdf.arrayBuffer())
}

describe('PdfEngine', () => {
  it('draws a valid A3 PDF directly from the sheet', async () => {
    const text = await pdfText(new PdfEngine().draw(sheet))

    expect(text.startsWith('%PDF-')).toBe(true)
    expect((text.match(/\/Type \/Page\b/g) ?? [])).toHaveLength(1)
  })

  it('creates one A4 page for every configured segment', async () => {
    const text = await pdfText(new PdfEngine().drawInSegments(sheet, 11.5))

    expect(text.startsWith('%PDF-')).toBe(true)
    expect((text.match(/\/Type \/Page\b/g) ?? [])).toHaveLength(2)
  })

  it('keeps the Legacy fill-and-stroke sequence for empty ellipses', async () => {
    const text = await pdfText(new PdfEngine().draw({
      ...sheet,
      children: [{
        ...sheet.children[0],
        fill: 'empty',
      }],
    }))

    expect((text.match(/\nB\n/g) ?? [])).toHaveLength(2)
  })

  it('uses the Legacy dash sequence for dashed flow lines', async () => {
    const text = await pdfText(new PdfEngine().draw({
      ...sheet,
      children: [{
        type: 'FlowLine',
        from: [10, 10],
        to: [30, 10],
        style: 'dashed',
        color: 'black',
        lineWidth: 0.2,
        visible: true,
      }],
    }))

    expect(text).toMatch(/\[(\d+\.\d+) \1\] \1 d/)
  })
})
