import type { AnnotationTextMetrics } from '../TextMetrics.js'
import type { LayoutConfig } from '@zupfnoter/types'

/**
 * Test-only Annotationstext-Metrik, die die Legacy-Vergleichstests enger an
 * die Referenzausgabe bringt, ohne den Produktions-Fallback zu verändern.
 */
export class LegacyFixtureAnnotationTextMetrics implements AnnotationTextMetrics {
  measureAnnotation(text: string, style: string, layout: LayoutConfig): [number, number] {
    if (style === 'small_italic') {
      const widths: Record<string, number> = {
        f: 0.889,
        p: 1.7462,
      }
      const width = widths[text]
      if (width !== undefined) {
        return [width, 3.175]
      }
    }

    const fontSize = layout.FONT_STYLE_DEF[style]?.fontSize ?? 10
    const height = fontSize * 25.4 / 72
    const lines = text.replaceAll('&tilde;', '~').split('\n')
    const bold = layout.FONT_STYLE_DEF[style]?.fontStyle === 'bold'
    const width = Math.max(...lines.map((line) => this._lineWidth(line, height, bold)))
    const lineHeight = lines.length > 1 ? height * 1.075 : height
    return [width, lineHeight * lines.length]
  }

  private _lineWidth(text: string, height: number, bold: boolean): number {
    const widthUnits: Record<string, number> = {
      ' ': 280,
      '!': 278,
      '"': 350,
      '#': 550,
      '$': 550,
      '%': 889,
      '&': 660,
      "'": 190,
      '(': 330,
      ')': 330,
      '*': 389,
      '+': 580,
      ',': 280,
      '-': 330,
      '.': 280,
      '/': 280,
      ':': 280,
      ';': 280,
      '<': 580,
      '=': 580,
      '>': 580,
      '?': 550,
      '@': 1010,
      '[': 280,
      '\\': 280,
      ']': 280,
      '^': 470,
      '_': 550,
      '`': 330,
      '{': 330,
      '|': 260,
      '}': 330,
      '~': 580,
      A: 660,
      B: 660,
      C: 722,
      D: 722,
      E: 660,
      F: 611,
      G: 778,
      H: 722,
      I: 278,
      J: 500,
      K: 660,
      L: 550,
      M: 833,
      N: 722,
      O: 778,
      P: 660,
      Q: 778,
      R: 722,
      S: 660,
      T: 611,
      U: 722,
      V: 660,
      W: 944,
      X: 660,
      Y: 660,
      Z: 611,
      a: 550,
      b: 550,
      c: 500,
      d: 550,
      e: 550,
      f: 278,
      g: 550,
      h: 550,
      i: 222,
      j: 222,
      k: 500,
      l: 222,
      m: 833,
      n: 550,
      o: 550,
      p: 550,
      q: 550,
      r: 333,
      s: 500,
      t: 278,
      u: 550,
      v: 500,
      w: 722,
      x: 500,
      y: 500,
      z: 500,
      Ä: 660,
      Ö: 778,
      Ü: 722,
      ä: 550,
      ö: 550,
      ü: 550,
      ß: 611,
      '¿': 611,
    }
    const boldWidthUnits: Record<string, number> = {
      '!': 330,
      '"': 470,
      '&': 720,
      "'": 240,
      ':': 330,
      ';': 330,
      '?': 610,
      '@': 970,
      '[': 330,
      ']': 330,
      '^': 580,
      '{': 390,
      '|': 280,
      '}': 390,
      A: 722,
      B: 722,
      C: 722,
      D: 722,
      G: 778,
      H: 778,
      I: 280,
      J: 550,
      K: 720,
      L: 610,
      M: 944,
      P: 660,
      R: 722,
      U: 722,
      a: 550,
      b: 611,
      c: 550,
      d: 611,
      e: 550,
      f: 333,
      g: 611,
      h: 611,
      i: 278,
      j: 278,
      k: 550,
      l: 278,
      m: 889,
      n: 611,
      o: 611,
      p: 611,
      q: 611,
      r: 389,
      s: 550,
      t: 333,
      u: 611,
      v: 556,
      w: 778,
      x: 550,
      y: 550,
      Ä: 722,
      Ö: 778,
      Ü: 722,
      ä: 550,
      ö: 611,
      ü: 611,
      ß: 611,
      '¿': 611,
    }
    const fontUnits = bold ? { ...widthUnits, ...boldWidthUnits } : widthUnits
    const kerning: Record<string, number> = bold
      ? {
          ' T': -100,
          ' W': -80,
          Ta: -80,
          Tr: -80,
        }
      : {}
    let previous = ''
    return Array.from(text).reduce((sum, char) => {
      const unit = /\d/.test(char) ? 550 : (fontUnits[char] ?? 550)
      const kern = kerning[`${previous}${char}`] ?? 0
      previous = char
      return sum + height * (unit + kern) / 1000
    }, 0)
  }
}
