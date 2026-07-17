import { describe, expect, it } from 'vitest'

import { pdfOutputFilename } from '../../PdfOutputName.js'

describe('pdfOutputFilename', () => {
  it('uses the legacy filebase, filenamepart, and lowercase page-format suffix', () => {
    expect(pdfOutputFilename('749_advent-is-a-leuchtn', '-', 'A3'))
      .toBe('749_advent-is-a-leuchtn_-_a3.pdf')
    expect(pdfOutputFilename('749_advent-is-a-leuchtn', '-A', 'A4'))
      .toBe('749_advent-is-a-leuchtn_-A_a4.pdf')
  })
})
